"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { generateEmbedding, generateEmbeddings } from "../lib/embeddings";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";

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
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to create a note");
    }

    return await indexNote(ctx, {
      userId,
      title: args.title,
      body: args.body,
      automationKey: "index-note-embeddings",
      automationName: "Index note embeddings",
    });
  },
});

export const agentCreateNote = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
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

    return {
      id: noteId,
      title: args.title,
      body: args.body,
    };
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

export const findRelevantNotes = internalAction({
  args: {
    query: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Array<Doc<"notes">>> => {
    const embedding = await generateEmbedding(args.query);

    const results = await ctx.vectorSearch("noteEmbeddings", "by_embedding", {
      vector: embedding,
      limit: 16,
      filter: (q) => q.eq("userId", args.userId),
    });

    const resultsAboveThreshold = results.filter(
      (result) => result._score > 0.3
    );

    const embeddingIds = resultsAboveThreshold.map((result) => result._id);

    const notes = await ctx.runQuery(internal.notes.fetchNotesByEmbeddingIds, {
      embeddingIds,
    });

    return notes;
  },
});
