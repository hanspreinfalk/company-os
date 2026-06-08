import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

export const getUserFolders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
  },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.parentFolderId) {
      const parent = await ctx.db.get(args.parentFolderId);
      if (!parent || parent.userId !== userId) throw new Error("Parent folder not found");
    }

    return await ctx.db.insert("folders", {
      name: args.name,
      userId,
      parentFolderId: args.parentFolderId,
    });
  },
});

export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) throw new Error("Folder not found");
    await ctx.db.patch(args.folderId, { name: args.name });
  },
});

export const deleteFolder = mutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) throw new Error("Folder not found");

    // Move notes in this folder to root
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", userId).eq("folderId", args.folderId)
      )
      .collect();
    for (const note of notes) {
      await ctx.db.patch(note._id, { folderId: undefined });
    }

    // Move subfolders to root
    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_userId_parentFolderId", (q) =>
        q.eq("userId", userId).eq("parentFolderId", args.folderId)
      )
      .collect();
    for (const sub of subfolders) {
      await ctx.db.patch(sub._id, { parentFolderId: undefined });
    }

    await ctx.db.delete(args.folderId);
  },
});

export const moveNote = mutation({
  args: {
    noteId: v.id("notes"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) throw new Error("Note not found");

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== userId) throw new Error("Folder not found");
    }

    await ctx.db.patch(args.noteId, { folderId: args.folderId });
  },
});

// Internal versions for the AI agent
export const createFolderInternal = internalMutation({
  args: {
    name: v.string(),
    userId: v.id("users"),
    parentFolderId: v.optional(v.id("folders")),
  },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("folders", {
      name: args.name,
      userId: args.userId,
      parentFolderId: args.parentFolderId,
    });
  },
});

export const getFoldersForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getFolderByName = internalQuery({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    return folders.find((f) => f.name.toLowerCase() === args.name.toLowerCase()) ?? null;
  },
});

export const moveNoteInternal = internalMutation({
  args: {
    noteId: v.id("notes"),
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== args.userId) throw new Error("Note not found");
    await ctx.db.patch(args.noteId, { folderId: args.folderId });
  },
});
