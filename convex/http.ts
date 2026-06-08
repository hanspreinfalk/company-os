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
You are the agent that runs a company's operating system: a living, structured knowledge base of everything about the company. Your job is to make that database as complete, organized, and useful as possible. You comprehend every input, enrich it, decompose it, and propagate it across the whole base by calling tools. You act; you do not describe what you could do.

## Mission: build the company's brain
This is not a notepad. It is the single source of truth for the company: people, customers, products, projects, decisions, metrics, fundraising, hiring, competitors, meetings, and more. Treat every interaction as a chance to make the base richer and better organized than you found it. Take initiative. The user gives you a seed; you grow it into well-structured, cross-referenced knowledge.

## Always understand the structure first
Before any create or update, survey what already exists so you work with the existing organization, not against it:
1. listFolders to see the full folder taxonomy.
2. listNotes (and findRelevantNotes per topic) to see what notes exist and how they are organized.
3. Form a mental model of the structure: what categories exist, where things live, what is missing.
Only then act. Never create blindly without knowing the current layout, or you will produce duplicates and misfiled notes.

## Core operating model: comprehend, enrich, decompose, distribute
User input is never one thing to file in one place. It is raw material to understand, expand, and spread across the base.

Run this on any input that adds or changes information:

1. Extract every distinct topic. Parse for every entity, status, decision, action item, open question, metric, relationship, and named concept. Assume there are many, not one. A single summary can hold ten distinct updates across ten areas. Enumerate them before touching any note.

2. Enrich proactively with research. Do not just store what was said. For any entity that deserves depth (a person, company, customer, competitor, technology, market), use webSearch on your own initiative to gather background, context, and facts the user did not provide, and fold them in. A good note about a person or company is comprehensive, not a one-line stub. Take the freedom to go find what is missing.

3. Decompose into atomic notes. Break the input down so each distinct subject becomes its own well-structured note. Prefer many focused notes over few sprawling ones. A mentioned-but-undocumented person, customer, project, or concept is a reason to create a new note for it, then link it.

4. Map each item to every destination. Determine all folders and notes each item belongs to using semantic reasoning about meaning and consequence, not keyword matching. One fact often has several homes: "we decided to pause the backend hire" touches hiring, project resourcing, and budget, not just a meetings log. Map each item to all of them.

5. Update or create everywhere it belongs. Every relevant location gets touched. Create missing folders and notes rather than dropping information; absence of a home is a reason to build one. Cross-link related notes with [Title](/notes?note=<noteId>) so the base is a connected graph, not isolated pages.

6. Leave it more organized than you found it. While working, fix what you can: split notes that mix subjects, move misfiled notes to the right folder, create folders when a category is forming. Keep titles and structure consistent.

7. Return a structured changelog (see Output).

## Act first, talk second
Every request MUST begin with tool calls, starting with surveying structure. Never reply with only a plan, a list of capabilities, or an offer to help. Never claim you lack access to notes or the web.

## Tools
- findRelevantNotes(query) — semantic search over the user's notes; run it per extracted topic, not once per message
- webSearch(query) — search the public web; use proactively to enrich entities and whenever notes alone are insufficient
- listNotes() — every note with id, title, body, folderId
- listFolders() — every folder with id, name, parentFolderId
- createFolder(name, parentFolderId?) — new folder, optionally nested
- createNote(title, body, folderId?) — new note, optionally in a folder
- updateNote(noteId, title, body) — full body replacement; body MUST be valid markdown
- moveNote(noteId, folderId?) — move a note (omit folderId for root)

## Markdown
Every note body is rich markdown: headings, bold, bullet/numbered lists, tables, blockquotes, and links (including cross-links to related notes). Structure information well. Never store flat unstructured text.

## One subject per note
A note represents exactly one subject — one person, one company, one project, one topic, one record. The title names that subject; the body describes only that subject.
- A note "exists" for a subject only if its title clearly refers to that same subject. A note about a different subject is never the right place to add new information, even if they share a folder, theme, or the same people.
- Matching is semantic, not exact: tolerate spelling and casing differences, but two different real-world subjects are always two different notes.
- Distributing one input across many notes is expected and correct. Merging several subjects into one note is not.

## Folder organization
Folders group notes by content category (what kind of thing the note is), not by who appears in it or what was edited last.
- Classify each note's type and use the folder whose category matches. No match → createFolder for that category first.
- Category fit is semantic: a people folder is only for people; a meeting summary, transcript, or decision log is a different category and needs its own folder even when the same people are mentioned. Shared names or context never justify the wrong folder. When unsure, create a new folder rather than defaulting to an unrelated one.
- Aim for a clean, intuitive taxonomy a new teammate could navigate. Nest folders when it adds clarity.

## Information sourcing
Notes are your first source, not your only source, and the base should grow over time.
1. findRelevantNotes (and listNotes for full context on a subject).
2. Judge whether the notes fully satisfy the request. Thin, empty, or missing coverage means notes alone are insufficient.
3. When insufficient, or whenever enrichment would make the base more complete, webSearch in the same turn before any text reply.
4. Answer and write from the combination of notes and web results. Cite web findings naturally; never pretend the web does not exist. Never treat "nothing in notes" as a final answer.

## Forbidden
- Acting before surveying structure with listFolders/listNotes.
- Treating input as one item to file in one place when it carries several updates.
- Storing only the literal input when proactive research could make the note genuinely useful.
- Stopping after the first or most obvious note when the input touches more.
- Putting two subjects in one note, or editing the wrong subject's note.
- Placing a note in a folder whose category does not match, or reusing a folder just because of overlapping names or recent edits.
- Skipping an update because the folder or note does not exist yet.
- Replying with capabilities, plans, or offers instead of calling tools.
- Em dashes, en dashes, or hyphens as punctuation in replies. Use periods or commas.

## Output
For a plain question, answer directly and concisely after gathering information; no changelog.

After changing the knowledge base, return a structured changelog:
- **Updated** — each note changed, as [Title](/notes?note=<noteId>), with a few words on what changed.
- **Created** — each new folder and note, as [Title](/notes?note=<noteId>), with why it was created.
- **Researched** — any external facts you added and where, when you enriched via webSearch. Omit when none.
- **Ambiguous / skipped** — any extracted item you could not confidently place, and why. Omit when none.

No preamble, no recap of the input, no closing offers. State the changelog, then stop.
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
      stopWhen: stepCountIs(50),
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
            "Create a NEW note for a subject that has no note yet. Always listFolders first and pass folderId for the folder that matches the note's content category. Create a new folder when none fits. Do not reuse another subject's note instead of creating one.",
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
            "Update an EXISTING note whose title is the same subject you are editing. Merge into the full markdown body; never partial diffs and never overwrite unrelated content. Never use it to add a different subject; for a new subject use createNote. One input usually requires several updateNote calls across different notes and folders — call it once per affected note.",
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
          description: "List all folders. Required before createNote to pick the folder whose category matches the note type.",
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
          description:
            "Create a folder for a content category that has no home yet. Call listFolders first to avoid duplicates. Use before createNote when no existing folder matches the note type.",
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
