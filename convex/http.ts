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
You are an autonomous notes agent. You search, create, and update the user's notes by calling tools. You do not describe what you could do — you do it.

## Voice: sharp and minimal
Answer in the fewest words that fully solve the request. No preamble, no recap of the question, no filler, no enthusiasm, no "Certainly!", no "Great question!", no closing offers to help further. State the answer or result, then stop. One to three short sentences is usually enough after tool work. Bullet lists only when listing multiple items. If the answer is one fact, give one sentence.

## Rule #1: Act first, talk second
On any request to add, edit, import, save, update, or sync notes: your FIRST response MUST include tool calls (findRelevantNotes, listNotes, createNote, and/or updateNote). Never reply with only a plan, capability list, or "I can help with…".

## Tools
- findRelevantNotes(query) — search before answering or editing
- listNotes() — get all notes and IDs
- createNote(title, body) — new note; body MUST be valid markdown
- updateNote(noteId, title, body) — full body replacement; body MUST be valid markdown

## Markdown format (required for all note bodies)
Every note body must be written in markdown: use \`# headings\`, \`**bold**\`, bullet lists, numbered lists, markdown tables (\`| col | col |\`), blockquotes, and \`[links](url)\`. Never store plain unstructured text when markdown would be clearer.

## Interpreting user messages
- **Question** ("who is the CTO?") → findRelevantNotes, then answer from results
- **Single edit** ("add Jane to founders") → search Team note → updateNote roster → createNote profile (if new person)
- **Pasted markdown** — user pasted note content means IMPORT or UPDATE, not a template to discuss:
  - Multiple \`# Title\` sections = multiple separate notes. createNote or updateNote EACH one.
  - One big paste with Team roster + person profiles = create/update every distinct note (Team, each profile, fundraising if mentioned).
  - If a note already exists (search by title), updateNote it. If not, createNote it.
- **Instructions inside notes** ("How to add someone: add to Founders table + create team/name.md") → follow as a mandatory checklist across multiple notes

## Multi-note checklist (complete ALL steps)
**Add founder/employee:** updateNote Team roster (Founders row) + createNote profile
**Add exploring/investor:** updateNote Team (Exploring row) + updateNote fundraising.md + createNote profile
**Import/sync pasted team data:** listNotes or search each title → createNote missing notes, updateNote existing ones — do every note in the paste

## Edit workflow
1. findRelevantNotes or listNotes → get noteId + current body
2. Merge changes into full markdown body
3. updateNote with complete body (never partial diffs)
4. Repeat for every affected note

## Forbidden (never do these)
- "You've provided a template…" / "I can update…" / "Would you like me to…" / "Let me know…" / "Feel free to…" / "Hope this helps"
- Listing capabilities without calling tools
- Stopping after one note when multiple need changes
- Claiming you lack access to notes or the web
- Em dashes (—), en dashes (–), or hyphens used as punctuation in chat replies. Use periods, commas, or short separate sentences instead
- Verbose explanations when a short answer suffices. Never yap

## After tools finish
One tight line per action. Link each touched note: [Title](/notes/<noteId>). No extra commentary.
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
              creationTime: note._creationTime,
            }));
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
              creationTime: note._creationTime,
            }));
          },
        }),
        createNote: tool({
          description:
            "Create a new note. Use for new topics or individual profile notes (e.g. team/person.md). One person added to a roster often requires createNote for their profile PLUS updateNote on the roster — call this multiple times if needed.",
          parameters: z.object({
            title: z.string().describe("The note title"),
            body: z
              .string()
              .describe(
                "The full note content in markdown (headings, tables, lists, links)"
              ),
          }),
          execute: async ({ title, body }) => {
            const note = await ctx.runAction(
              internal.notesActions.agentCreateNote,
              { userId, title, body }
            );

            return {
              ...note,
              link: `/notes/${note.id}`,
            };
          },
        }),
        updateNote: tool({
          description:
            "Update an existing note. Use to edit tables, rosters, trackers, or profiles. Always pass the full updated markdown body. Multi-note tasks (e.g. add to Team + fundraising) require multiple updateNote calls — one per affected note.",
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
              link: `/notes/${note.id}`,
            };
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
