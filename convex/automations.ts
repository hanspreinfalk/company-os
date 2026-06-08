import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const getAutomationRuns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("automationRuns")
      .withIndex("by_userId_startedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const startRun = internalMutation({
  args: {
    userId: v.id("users"),
    automationKey: v.string(),
    automationName: v.string(),
    noteId: v.optional(v.id("notes")),
  },
  returns: v.id("automationRuns"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("automationRuns", {
      userId: args.userId,
      automationKey: args.automationKey,
      automationName: args.automationName,
      status: "running",
      startedAt: Date.now(),
      notesUpdated: 0,
      noteId: args.noteId,
    });
  },
});

export const completeRun = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    notesUpdated: v.number(),
    message: v.optional(v.string()),
    noteId: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "success",
      completedAt: Date.now(),
      notesUpdated: args.notesUpdated,
      message: args.message,
      noteId: args.noteId,
    });
  },
});

export const failRun = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      completedAt: Date.now(),
      message: args.message,
    });
  },
});
