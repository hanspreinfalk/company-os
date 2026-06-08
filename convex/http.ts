import { openai } from "@ai-sdk/openai";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { httpRouter } from "convex/server";
import { z } from "zod";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const systemPrompt = `
You are an autonomous notes agent. You search, create, and update the user's notes by calling tools. You act; you do not describe what you could do.

## Voice
Answer in the fewest words that fully solve the request. No preamble, no recap, no filler, no enthusiasm, no closing offers to help. State the result, then stop. One to three short sentences usually suffices after tool work. Use bullet lists only when listing multiple items.

## Act first, talk second
Every request MUST begin with tool calls. Never reply with only a plan, a list of capabilities, or an offer to help. Never claim you lack access to notes or the web.

## Tools
- findRelevantNotes(query) — semantic search over the user's notes; always the first lookup
- webSearch(query) — search the public web; required whenever notes alone cannot satisfy the request
- listNotes() — every note with id, title, body, folderId
- listFolders() — every folder with id, name, parentFolderId
- createFolder(name, parentFolderId?) — new folder, optionally nested
- createNote(title, body, folderId?) — new note, optionally in a folder
- updateNote(noteId, title, body) — full body replacement; body MUST be valid markdown
- moveNote(noteId, folderId?) — move a note (omit folderId for root)

## Markdown
Every note body is markdown: headings, bold, bullet/numbered lists, tables, blockquotes, links. Never store flat unstructured text when structure would be clearer.

## Core principle: one subject per note
A note represents exactly one subject — one person, one company, one project, one topic. The title names that subject; the body describes only that subject.

Reason about each request before acting:
- Identify the distinct subject(s) involved. A request can touch several subjects at once (e.g. a shared list plus an individual's profile); each distinct subject maps to its own note.
- A note "exists" for a subject only if its title clearly refers to that same subject. A note about a different subject is never the right place to add new information, even if they share a folder, type, or theme.
- Matching is semantic, not exact: tolerate spelling/casing differences, but two different real-world subjects are always two different notes.

## Decision flow for any edit
1. Search (findRelevantNotes) and/or listNotes to discover what already exists.
2. For each subject the request concerns:
   - A note whose title is that subject already exists → updateNote it (merge into the full markdown body; never partial diffs).
   - No such note exists → createNote with the subject as the title. Place it in the most fitting existing folder (reuse the folder its siblings live in); create a folder only when none fits.
3. Complete every subject the request implies, not just the first. A single instruction may require multiple create/update calls.
4. Never widen an existing note to cover a second subject. If you discover a note that already mixes several subjects, split it: createNote per subject, then update or remove the conflated note.

## Information sourcing (critical)
Notes are your first source, not your only source. They are a partial snapshot of what the user has saved, not the limit of what you can know.

Before any answer, gather information in order:
1. findRelevantNotes (and listNotes when you need full context on a subject).
2. Evaluate whether the gathered notes fully satisfy what was asked. Thin, empty, or missing coverage means notes alone are insufficient.
3. When insufficient, webSearch is mandatory. Use the subject from the request (refined by anything useful from notes) as the query. Do this in the same turn; never skip to a text reply first.
4. Answer from whatever combination of notes and web results answers the question. Cite web findings naturally; do not pretend the web does not exist.

This applies to every informational request: direct questions, research asks, follow-ups probing for more detail, and implicit curiosity about a person, company, or topic. A follow-up that asks for more on the same subject still requires webSearch if notes remain thin.

Never treat "nothing in notes" as a final answer. That state means step 3 is required.

## Other intents
- Pasted content → treat as data to import/sync, not a template to discuss. Break it into its distinct subjects and create or update each one.
- Instructions embedded in a note (a process or checklist) → follow every step as written, across however many notes it implies.

## Forbidden
- Putting two subjects in one note, or editing the wrong subject's note.
- Replying with capabilities, plans, or offers instead of calling tools.
- Stopping after one note when the request implies several.
- Reporting that notes lack information without calling webSearch first.
- Ending a research or follow-up turn with only what notes contain when webSearch has not been tried.
- Em dashes, en dashes, or hyphens as punctuation in replies. Use periods or commas.
- Verbose explanations when a short answer works.

## After tools finish
One tight line per action. Link each touched note as [Title](/notes?note=<noteId>). Nothing more.
`.trim();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages }: { messages: UIMessage[] } = await req.json();

    const lastMessages = messages.slice(-20);

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: convertToModelMessages(lastMessages),
      stopWhen: stepCountIs(10),
      tools: {
        findRelevantNotes: tool({
          description:
            "Search notes semantically based on a query. Use this to find notes related to a topic.",
          parameters: z.object({
            query: z.string().describe("The search query"),
          }),
          execute: async ({ query }) => {
            const relevantNotes = await ctx.runAction(
              internal.notesActions.findRelevantNotes,
              { query, userId }
            );

            return relevantNotes.map((note) => ({
              id: note._id,
              title: note.title,
              body: note.body,
              folderId: note.folderId ?? null,
              creationTime: note._creationTime,
            }));
          },
        }),
        webSearch: tool({
          description:
            "Search the public web via Firecrawl. Call this whenever notes alone cannot fully answer the request: sparse profiles, missing background, research asks, follow-ups for more detail, or any factual gap. Do not reply that notes lack information without calling this first.",
          parameters: z.object({
            query: z.string().describe("The web search query"),
          }),
          execute: async ({ query }) => {
            return await ctx.runAction(internal.webSearch.search, { query });
          },
        }),
        listNotes: tool({
          description:
            "List all of the user's notes. Use this to browse notes or find a note ID before updating.",
          parameters: z.object({}),
          execute: async () => {
            const notes = await ctx.runQuery(internal.notes.getNotesForUser, {
              userId,
            });

            return notes.map((note) => ({
              id: note._id,
              title: note.title,
              body: note.body,
              folderId: note.folderId ?? null,
              creationTime: note._creationTime,
            }));
          },
        }),
        createNote: tool({
          description:
            "Create a NEW note for a subject that has no note yet, even when sibling notes already exist in the same folder. Pass folderId to place it alongside its siblings (use listFolders or listNotes to find the folder). Do not reuse another subject's note instead of creating one.",
          parameters: z.object({
            title: z.string().describe("The note title"),
            body: z
              .string()
              .describe(
                "The full note content in markdown (headings, tables, lists, links)"
              ),
            folderId: z.string().nullable().describe("Folder ID to place this note in, or null for root"),
          }),
          execute: async ({ title, body, folderId }) => {
            const note = await ctx.runAction(
              internal.notesActions.agentCreateNote,
              { userId, title, body, folderId: (folderId ?? undefined) as Id<"folders"> | undefined }
            );

            return {
              ...note,
              link: `/notes?note=${note.id}`,
            };
          },
        }),
        updateNote: tool({
          description:
            "Update an EXISTING note whose title is the same subject you are editing. Never use it to add a different subject; for a new subject use createNote. Always pass the full updated markdown body. Multi-note tasks require one call per affected note.",
          parameters: z.object({
            noteId: z.string().describe("The ID of the note to update"),
            title: z.string().describe("The updated note title"),
            body: z
              .string()
              .describe(
                "The full updated note content in markdown (headings, tables, lists, links)"
              ),
          }),
          execute: async ({ noteId, title, body }) => {
            const note = await ctx.runAction(
              internal.notesActions.agentUpdateNote,
              {
                userId,
                noteId: noteId as Id<"notes">,
                title,
                body,
              }
            );

            return {
              ...note,
              link: `/notes?note=${note.id}`,
            };
          },
        }),
        listFolders: tool({
          description: "List all folders. Use before creating a folder to avoid duplicates, or to find a folderId to pass when creating notes.",
          parameters: z.object({}),
          execute: async () => {
            const folders = await ctx.runQuery(internal.folders.getFoldersForUser, { userId });
            return folders.map((f) => ({
              id: f._id,
              name: f.name,
              parentFolderId: f.parentFolderId ?? null,
            }));
          },
        }),
        createFolder: tool({
          description: "Create a new folder. Pass parentFolderId to nest it inside another folder.",
          parameters: z.object({
            name: z.string().describe("Folder name"),
            parentFolderId: z.string().nullable().describe("Parent folder ID for subfolders, or null for a root folder"),
          }),
          execute: async ({ name, parentFolderId }) => {
            const folderId = await ctx.runMutation(internal.folders.createFolderInternal, {
              name,
              userId,
              parentFolderId: (parentFolderId ?? undefined) as Id<"folders"> | undefined,
            });
            return { id: folderId, name };
          },
        }),
        moveNote: tool({
          description: "Move a note into a folder (or to root by omitting folderId).",
          parameters: z.object({
            noteId: z.string().describe("The note ID to move"),
            folderId: z.string().nullable().describe("Target folder ID, or null to move to root"),
          }),
          execute: async ({ noteId, folderId }) => {
            await ctx.runMutation(internal.folders.moveNoteInternal, {
              noteId: noteId as Id<"notes">,
              userId,
              folderId: (folderId ?? undefined) as Id<"folders"> | undefined,
            });
            return { success: true };
          },
        }),
      },
      onError(error) {
        console.error("streamText error:", error);
      },
    });

    return result.toUIMessageStreamResponse({
      headers: new Headers({
        "Access-Control-Allow-Origin": "*",
        Vary: "origin",
      }),
    });
  }),
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

export default http;
