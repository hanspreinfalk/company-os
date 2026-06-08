"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { generateEmbedding, generateEmbeddings } from "../lib/embeddings";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";

async function indexNote(
  ctx: { runMutation: typeof action.prototype },
  args: {
    userId: Id<"users">;
    title: string;
    body: string;
    automationKey: string;
    automationName: string;
    noteId?: Id<"notes">;
  }
): Promise<Id<"notes">> {
  const runId = await ctx.runMutation(internal.automations.startRun, {
    userId: args.userId,
    automationKey: args.automationKey,
    automationName: args.automationName,
    noteId: args.noteId,
  });

  try {
    const text = `${args.title}\n\n${args.body}`;
    const embeddings = await generateEmbeddings(text);

    const noteId: Id<"notes"> = args.noteId
      ? await ctx.runMutation(internal.notes.updateNoteWithEmbeddings, {
          noteId: args.noteId,
          title: args.title,
          body: args.body,
          userId: args.userId,
          embeddings,
        })
      : await ctx.runMutation(internal.notes.createNoteWithEmbeddings, {
          title: args.title,
          body: args.body,
          userId: args.userId,
          embeddings,
        });

    await ctx.runMutation(internal.automations.completeRun, {
      runId,
      notesUpdated: 1,
      noteId,
      message: args.noteId
        ? `Reindexed "${args.title}" with ${embeddings.length} embedding chunk${embeddings.length === 1 ? "" : "s"}`
        : `Indexed "${args.title}" with ${embeddings.length} embedding chunk${embeddings.length === 1 ? "" : "s"}`,
    });

    return noteId;
  } catch (error) {
    await ctx.runMutation(internal.automations.failRun, {
      runId,
      message: error instanceof Error ? error.message : "Failed to index note",
    });
    throw error;
  }
}

export const createNote = action({
  args: {
    title: v.string(),
    body: v.string(),
    folderId: v.optional(v.id("folders")),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to create a note");
    }

    const noteId = await indexNote(ctx, {
      userId,
      title: args.title,
      body: args.body,
      automationKey: "index-note-embeddings",
      automationName: "Index note embeddings",
    });

    if (args.folderId) {
      await ctx.runMutation(internal.folders.moveNoteInternal, {
        noteId,
        userId,
        folderId: args.folderId,
      });
    }

    return noteId;
  },
});

export const agentCreateNote = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    folderId: v.optional(v.id("folders")),
  },
  returns: v.object({
    id: v.id("notes"),
    title: v.string(),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const noteId = await indexNote(ctx, {
      userId: args.userId,
      title: args.title,
      body: args.body,
      automationKey: "index-note-embeddings",
      automationName: "Index note embeddings",
    });

    // Set folderId after creation if provided
    if (args.folderId) {
      await ctx.runMutation(internal.folders.moveNoteInternal, {
        noteId,
        userId: args.userId,
        folderId: args.folderId,
      });
    }

    return {
      id: noteId,
      title: args.title,
      body: args.body,
    };
  },
});

export const updateNote = action({
  args: {
    noteId: v.id("notes"),
    title: v.string(),
    body: v.string(),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to update a note");
    }

    const existingNote = await ctx.runQuery(internal.notes.getNoteForUser, {
      noteId: args.noteId,
      userId,
    });

    if (!existingNote) {
      throw new Error("Note not found");
    }

    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) {
      throw new Error("Title cannot be empty");
    }
    if (!body) {
      throw new Error("Body cannot be empty");
    }

    return await indexNote(ctx, {
      userId,
      noteId: args.noteId,
      title,
      body,
      automationKey: "reindex-note-embeddings",
      automationName: "Reindex note embeddings",
    });
  },
});

export const agentUpdateNote = internalAction({
  args: {
    userId: v.id("users"),
    noteId: v.id("notes"),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({
    id: v.id("notes"),
    title: v.string(),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const existingNote = await ctx.runQuery(internal.notes.getNoteForUser, {
      noteId: args.noteId,
      userId: args.userId,
    });

    if (!existingNote) {
      throw new Error("Note not found");
    }

    const noteId = await indexNote(ctx, {
      userId: args.userId,
      noteId: args.noteId,
      title: args.title,
      body: args.body,
      automationKey: "reindex-note-embeddings",
      automationName: "Reindex note embeddings",
    });

    return {
      id: noteId,
      title: args.title,
      body: args.body,
    };
  },
});

async function findRelevantNotesForUser(
  ctx: ActionCtx,
  userId: Id<"users">,
  query: string
): Promise<Array<Doc<"notes">>> {
  const embedding = await generateEmbedding(query);

  const results = await ctx.vectorSearch("noteEmbeddings", "by_embedding", {
    vector: embedding,
    limit: 16,
    filter: (q) => q.eq("userId", userId),
  });

  const resultsAboveThreshold = results.filter((result) => result._score > 0.3);
  const embeddingIds = resultsAboveThreshold.map((result) => result._id);

  return await ctx.runQuery(internal.notes.fetchNotesByEmbeddingIds, {
    embeddingIds,
  });
}

export const findRelevantNotes = internalAction({
  args: {
    query: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await findRelevantNotesForUser(ctx, args.userId, args.query);
  },
});

export const searchNotesForChat = action({
  args: {
    query: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    return await findRelevantNotesForUser(ctx, userId, args.query);
  },
});
