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

## Step 1 (mandatory): survey before writing
Your FIRST tool calls on any write are listFolders and listNotes. You may not call createNote, createFolder, updateNote, or moveNote until you have seen the current folders and notes. Skipping this produces misfiled notes and duplicates.

## Step 2 (mandatory): place every note by its own category
This is the rule that matters most. Notes keep getting misfiled because the category is chosen by loose association. Stop doing that.

For each note, before writing it, decide its folder with this procedure:
1. Name the note's category from the note's OWN content: what kind of document is this? (a person profile, a company overview, a pricing sheet, a meeting record, a customer record, a fundraising doc, a product spec, etc.)
2. A folder is correct ONLY if its category IS that same kind of thing. Read what already lives in the folder: if those notes are a different kind of document, it is the wrong folder, no matter how related the topics feel.
3. If no existing folder is that exact category, you MUST createFolder for it and place the note there. A loosely related folder is never an acceptable substitute for the right one.
4. Topic overlap, shared people, or "it gets used in that area" never justify a folder. A sales deck is not a sales pipeline. A company overview is not a team profile. Match the document TYPE, not the subject matter it touches.

When unsure between an existing folder and a new one, create the new folder. Over-foldering is fine; misfiling is not.

## Step 3: decompose compound input, then distribute
Input is rarely one note. A presentation, deck, summary, or document is a bundle of distinct subjects. Pull it apart:
1. Extract every distinct subject and update: each person, company, customer, product, project, metric, decision, pricing model, positioning statement, etc.
2. Each distinct subject becomes (or updates) its OWN note, placed by Step 2. A presentation about the company seeds a company overview note, a pricing note, team profiles, a positioning note, and so on, each in the correct folder, not one giant note dumped in one folder.
3. Enrich proactively: for any real entity (person, company, customer, competitor, technology), webSearch on your own initiative and fold in useful background. A good note is comprehensive, not a stub.
4. One fact can have several homes. Map each to every folder and note it belongs to and update all of them. Cross-link related notes with [Title](/notes?note=<noteId>).
5. Leave the base cleaner than you found it: split notes that mix subjects, move misfiled notes, create folders as categories form.

Then return the changelog (see Output).

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

## Information sourcing
Notes are your first source, not your only source, and the base should grow over time.
1. findRelevantNotes (and listNotes for full context on a subject).
2. Judge whether the notes fully satisfy the request. Thin, empty, or missing coverage means notes alone are insufficient.
3. When insufficient, or whenever enrichment would make the base more complete, webSearch in the same turn before any text reply.
4. Answer and write from the combination of notes and web results. Cite web findings naturally; never pretend the web does not exist. Never treat "nothing in notes" as a final answer.

## Forbidden
- Writing before calling listFolders and listNotes.
- Placing a note in a folder of a different document type because the topics feel related (the #1 mistake: a deck in a pipeline folder, an overview in a people folder). Match the document TYPE.
- Using a loosely related folder instead of creating the correct one.
- Dumping a whole presentation, deck, or document into one note in one folder instead of decomposing it.
- Treating input as one item when it carries several distinct subjects.
- Putting two subjects in one note, or editing the wrong subject's note.
- Skipping an update because the folder or note does not exist yet (create it).
- Storing only the literal input when proactive research could make the note genuinely useful.
- Replying with capabilities, plans, or offers instead of calling tools.
- Em dashes, en dashes, or hyphens as punctuation in replies. Use periods or commas.

## Answering questions
When the user asks a question, give a full, natural, conversational answer — not a bullet list of names or one-line facts.

Good answer to "who is the CTO?": "Hans Preinfalk is the CTO and co-founder of the company. He is 23 years old, based in Vienna, and leads the technical direction. He co-founded the company in 2024 and oversees engineering, product architecture, and AI strategy."

Bad answer to "who is the CTO?": "- Hans Preinfalk"

Rules for question answers:
- Write in flowing prose, not bullet points, unless the question explicitly asks for a list or the answer covers several distinct items (proposals, deals, projects, people) where a short structured list is clearer.
- Weave together everything relevant from notes and (if needed) the web: role, background, age, location, relationships, context.
- If you only have a name but no detail, call findRelevantNotes and, if still thin, webSearch before answering.
- Length matches the question: a simple "who is X" gets two to four sentences; a "tell me everything about X" gets several paragraphs.
- Never answer with just a name, a job title, or a naked list item. Every answer must contain at least one full sentence of meaningful context.
- Answer completely on the first try. Anticipate the obvious follow-up. If notes contain URLs, presentation links, doc links, pricing, dates, or status that relate to the question, include them in your first answer. Never summarize proposals, decks, or documents and omit their links when those links are in the notes.
- When listing proposals, deals, or similar items, each entry must include its presentation or document URL inline when one exists in the notes.

Good answer to "what were the proposals made this week?": a brief intro sentence, then each proposal with client name, scope, pricing, and its presentation URL on the same line or bullet. Example: "UNIMED Sorocaba — Executive AI Program (27.3k or 43.7k): https://tdc-unimed-sorocaba-ai-program-2026.vercel.app/"

Bad answer to "what were the proposals made this week?": a prose summary of each proposal with pricing but no links, forcing the user to ask for links separately.

## Output
For a plain question, answer in full prose as described above; no changelog.

After changing the knowledge base, return a structured changelog:
- **Updated** — each note changed, as [Title](/notes?note=<noteId>), with a few words on what changed.
- **Created** — each new folder and note, as [Title](/notes?note=<noteId>), with why it was created.
- **Researched** — any external facts you added and where, when you enriched via webSearch. Omit when none.
- **Ambiguous / skipped** — any extracted item you could not confidently place, and why. Omit when none.

No preamble, no recap of the input, no closing offers. Answer or changelog, then stop.
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
      model: openai("gpt-5"),
      system: systemPrompt,
      messages: await convertToModelMessages(lastMessages),
      stopWhen: stepCountIs(50),
      tools: {
        findRelevantNotes: tool({
          description:
            "Search notes semantically based on a query. Use this to find notes related to a topic.",
          inputSchema: z.object({
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
          inputSchema: z.object({
            query: z.string().describe("The web search query"),
          }),
          execute: async ({ query }) => {
            return await ctx.runAction(internal.webSearch.search, { query });
          },
        }),
        listNotes: tool({
          description:
            "List all of the user's notes. Use this to browse notes or find a note ID before updating.",
          inputSchema: z.object({}),
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
          inputSchema: z.object({
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
            "Update an EXISTING note whose title is the same subject you are editing. Merge into the full markdown body; never partial diffs and never overwrite unrelated content. Never use it to add a different subject; for a new subject use createNote. One input usually requires several updateNote calls across different notes and folders. Call it once per affected note.",
          inputSchema: z.object({
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
          inputSchema: z.object({}),
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
          inputSchema: z.object({
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
          inputSchema: z.object({
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
      originalMessages: lastMessages,
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
