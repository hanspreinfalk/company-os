import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const noteValidator = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  title: v.string(),
  body: v.string(),
  userId: v.id("users"),
  folderId: v.optional(v.id("folders")),
});

export const getNote = query({
  args: {
    noteId: v.id("notes"),
  },
  returns: v.union(noteValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      return null;
    }

    return note;
  },
});

export const getUserNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createNoteWithEmbeddings = internalMutation({
  args: {
    title: v.string(),
    body: v.string(),
    userId: v.id("users"),
    embeddings: v.array(
      v.object({
        embedding: v.array(v.float64()),
        content: v.string(),
      })
    ),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert("notes", {
      title: args.title,
      body: args.body,
      userId: args.userId,
    });

    for (const embeddingData of args.embeddings) {
      await ctx.db.insert("noteEmbeddings", {
        content: embeddingData.content,
        embedding: embeddingData.embedding,
        noteId,
        userId: args.userId,
      });
    }

    return noteId;
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to delete a note");
    }

    const note = await ctx.db.get(args.noteId);

    if (!note) {
      throw new Error("Note not found");
    }

    if (note.userId !== userId) {
      throw new Error("User is not authorized to delete this note");
    }

    const runId = await ctx.db.insert("automationRuns", {
      userId,
      automationKey: "cleanup-note-index",
      automationName: "Cleanup note index",
      status: "running",
      startedAt: Date.now(),
      notesUpdated: 0,
      noteId: args.noteId,
    });

    try {
      const embeddings = await ctx.db
        .query("noteEmbeddings")
        .withIndex("by_noteId", (q) => q.eq("noteId", args.noteId))
        .collect();

      for (const embedding of embeddings) {
        await ctx.db.delete(embedding._id);
      }

      await ctx.db.delete(args.noteId);

      await ctx.db.patch(runId, {
        status: "success",
        completedAt: Date.now(),
        notesUpdated: 1,
        message: `Removed "${note.title}" from the search index`,
      });
    } catch (error) {
      await ctx.db.patch(runId, {
        status: "failed",
        completedAt: Date.now(),
        message:
          error instanceof Error ? error.message : "Failed to cleanup note index",
      });
      throw error;
    }
  },
});

export const getNotesForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getNoteForUser = internalQuery({
  args: {
    noteId: v.id("notes"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== args.userId) {
      return null;
    }
    return note;
  },
});

export const updateNoteWithEmbeddings = internalMutation({
  args: {
    noteId: v.id("notes"),
    title: v.string(),
    body: v.string(),
    userId: v.id("users"),
    embeddings: v.array(
      v.object({
        embedding: v.array(v.float64()),
        content: v.string(),
      })
    ),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }
    if (note.userId !== args.userId) {
      throw new Error("User is not authorized to update this note");
    }

    const existingEmbeddings = await ctx.db
      .query("noteEmbeddings")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.noteId))
      .collect();

    for (const embedding of existingEmbeddings) {
      await ctx.db.delete(embedding._id);
    }

    await ctx.db.patch(args.noteId, {
      title: args.title,
      body: args.body,
    });

    for (const embeddingData of args.embeddings) {
      await ctx.db.insert("noteEmbeddings", {
        content: embeddingData.content,
        embedding: embeddingData.embedding,
        noteId: args.noteId,
        userId: args.userId,
      });
    }

    return args.noteId;
  },
});

export const fetchNotesByEmbeddingIds = internalQuery({
  args: {
    embeddingIds: v.array(v.id("noteEmbeddings")),
  },
  handler: async (ctx, args) => {
    const embeddings = [];
    for (const id of args.embeddingIds) {
      const embedding = await ctx.db.get(id);
      if (embedding !== null) {
        embeddings.push(embedding);
      }
    }

    const uniqueNoteIds = [
      ...new Set(embeddings.map((embedding) => embedding.noteId)),
    ];

    const results = [];
    for (const id of uniqueNoteIds) {
      const note = await ctx.db.get(id);
      if (note !== null) {
        results.push(note);
      }
    }

    return results;
  },
});
