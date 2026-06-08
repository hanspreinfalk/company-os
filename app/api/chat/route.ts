import { openai } from "@ai-sdk/openai";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { buildChatSystemPrompt } from "@/lib/chat-system-prompt";

export const runtime = "nodejs";

export const maxDuration = 300;

function getConvexClient(token: string) {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  return client;
}

export async function POST(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = getConvexClient(token);
  const userId = await convex.query(api.users.getCurrentUserId, {});
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();
  const lastMessages = messages.slice(-20);

  const tools = {
    findRelevantNotes: tool({
      description:
        "Search notes semantically based on a query. Use this to find notes related to a topic.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }) => {
        return await convex.action(api.notesActions.searchNotesForChat, {
          query,
        });
      },
    }),
    webSearch: tool({
      description:
        "Search the public web via Firecrawl. Call this whenever notes alone cannot fully answer the request.",
      inputSchema: z.object({
        query: z.string().describe("The web search query"),
      }),
      execute: async ({ query }) => {
        return await convex.action(api.webSearch.searchWeb, { query });
      },
    }),
    listNotes: tool({
      description:
        "List all of the user's notes. Use this to browse notes or find a note ID before updating.",
      inputSchema: z.object({}),
      execute: async () => {
        const notes = await convex.query(api.notes.getUserNotes, {});
        return notes.map((note: Doc<"notes">) => ({
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
        "Create a NEW note for a subject that has no note yet. Always listFolders first and pass folderId for the folder that matches the note's content category.",
      inputSchema: z.object({
        title: z.string().describe("The note title"),
        body: z
          .string()
          .describe(
            "The full note content in markdown (headings, tables, lists, links)"
          ),
        folderId: z
          .string()
          .nullable()
          .describe("Folder ID to place this note in, or null for root"),
      }),
      execute: async ({ title, body, folderId }) => {
        const noteId = await convex.action(api.notesActions.createNote, {
          title,
          body,
          folderId: folderId ? (folderId as Id<"folders">) : undefined,
        });

        return {
          id: noteId,
          title,
          body,
          link: `/notes?note=${noteId}`,
        };
      },
    }),
    updateNote: tool({
      description:
        "Update an EXISTING note whose title is the same subject you are editing.",
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
        const updatedNoteId = await convex.action(api.notesActions.updateNote, {
          noteId: noteId as Id<"notes">,
          title,
          body,
        });

        return {
          id: updatedNoteId,
          title,
          body,
          link: `/notes?note=${updatedNoteId}`,
        };
      },
    }),
    listFolders: tool({
      description:
        "List all folders. Required before createNote to pick the folder whose category matches the note type.",
      inputSchema: z.object({}),
      execute: async () => {
        const folders = await convex.query(api.folders.getUserFolders, {});
        return folders.map((folder: Doc<"folders">) => ({
          id: folder._id,
          name: folder.name,
          parentFolderId: folder.parentFolderId ?? null,
        }));
      },
    }),
    createFolder: tool({
      description:
        "Create a folder for a content category that has no home yet. Call listFolders first to avoid duplicates.",
      inputSchema: z.object({
        name: z.string().describe("Folder name"),
        parentFolderId: z
          .string()
          .nullable()
          .describe("Parent folder ID for subfolders, or null for a root folder"),
      }),
      execute: async ({ name, parentFolderId }) => {
        const folderId = await convex.mutation(api.folders.createFolder, {
          name,
          parentFolderId: parentFolderId
            ? (parentFolderId as Id<"folders">)
            : undefined,
        });

        return { id: folderId, name };
      },
    }),
    moveNote: tool({
      description: "Move a note into a folder (or to root by omitting folderId).",
      inputSchema: z.object({
        noteId: z.string().describe("The note ID to move"),
        folderId: z
          .string()
          .nullable()
          .describe("Target folder ID, or null to move to root"),
      }),
      execute: async ({ noteId, folderId }) => {
        await convex.mutation(api.folders.moveNote, {
          noteId: noteId as Id<"notes">,
          folderId: folderId ? (folderId as Id<"folders">) : undefined,
        });

        return { success: true };
      },
    }),
  };

  const result = streamText({
    model: openai("gpt-5"),
    system: buildChatSystemPrompt(),
    messages: await convertToModelMessages(lastMessages),
    stopWhen: stepCountIs(50),
    tools,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: lastMessages,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
