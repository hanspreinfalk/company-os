import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

const toolPreferencesValidator = v.object({
  toolkitSlug: v.string(),
  disabledToolSlugs: v.array(v.string()),
  initialized: v.boolean(),
});

export const getToolPreferences = query({
  args: {
    toolkitSlug: v.optional(v.string()),
  },
  returns: v.array(toolPreferencesValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    if (args.toolkitSlug) {
      const preference = await ctx.db
        .query("connectorToolPreferences")
        .withIndex("by_userId_toolkitSlug", (q) =>
          q.eq("userId", userId).eq("toolkitSlug", args.toolkitSlug!)
        )
        .unique();

      return [
        {
          toolkitSlug: args.toolkitSlug,
          disabledToolSlugs: preference?.disabledToolSlugs ?? [],
          initialized: preference?.initialized ?? false,
        },
      ];
    }

    const preferences = await ctx.db
      .query("connectorToolPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return preferences.map((preference) => ({
      toolkitSlug: preference.toolkitSlug,
      disabledToolSlugs: preference.disabledToolSlugs,
      initialized: preference.initialized ?? false,
    }));
  },
});

export const getToolPreferencesForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(toolPreferencesValidator),
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("connectorToolPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return preferences.map((preference) => ({
      toolkitSlug: preference.toolkitSlug,
      disabledToolSlugs: preference.disabledToolSlugs,
      initialized: preference.initialized ?? false,
    }));
  },
});

export const initializeToolkitPreferences = mutation({
  args: {
    toolkitSlug: v.string(),
    allToolSlugs: v.array(v.string()),
    recommendedToolSlugs: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("connectorToolPreferences")
      .withIndex("by_userId_toolkitSlug", (q) =>
        q.eq("userId", userId).eq("toolkitSlug", args.toolkitSlug)
      )
      .unique();

    if (existing?.initialized) {
      return null;
    }

    const recommended = new Set(args.recommendedToolSlugs);
    const disabledToolSlugs =
      args.recommendedToolSlugs.length === 0
        ? []
        : args.allToolSlugs.filter((toolSlug) => !recommended.has(toolSlug));
    const updatedAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        disabledToolSlugs,
        initialized: true,
        updatedAt,
      });
      return null;
    }

    await ctx.db.insert("connectorToolPreferences", {
      userId,
      toolkitSlug: args.toolkitSlug,
      disabledToolSlugs,
      initialized: true,
      updatedAt,
    });

    return null;
  },
});

export const setToolEnabled = mutation({
  args: {
    toolkitSlug: v.string(),
    toolSlug: v.string(),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("connectorToolPreferences")
      .withIndex("by_userId_toolkitSlug", (q) =>
        q.eq("userId", userId).eq("toolkitSlug", args.toolkitSlug)
      )
      .unique();

    const disabled = new Set(existing?.disabledToolSlugs ?? []);
    if (args.enabled) {
      disabled.delete(args.toolSlug);
    } else {
      disabled.add(args.toolSlug);
    }

    const disabledToolSlugs = [...disabled];
    const updatedAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        disabledToolSlugs,
        initialized: true,
        updatedAt,
      });
      return null;
    }

    await ctx.db.insert("connectorToolPreferences", {
      userId,
      toolkitSlug: args.toolkitSlug,
      disabledToolSlugs,
      initialized: true,
      updatedAt,
    });

    return null;
  },
});

export const setToolkitToolsEnabled = mutation({
  args: {
    toolkitSlug: v.string(),
    toolSlugs: v.array(v.string()),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("connectorToolPreferences")
      .withIndex("by_userId_toolkitSlug", (q) =>
        q.eq("userId", userId).eq("toolkitSlug", args.toolkitSlug)
      )
      .unique();

    const disabled = new Set(existing?.disabledToolSlugs ?? []);

    for (const toolSlug of args.toolSlugs) {
      if (args.enabled) {
        disabled.delete(toolSlug);
      } else {
        disabled.add(toolSlug);
      }
    }

    const disabledToolSlugs = [...disabled];
    const updatedAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        disabledToolSlugs,
        initialized: true,
        updatedAt,
      });
      return null;
    }

    await ctx.db.insert("connectorToolPreferences", {
      userId,
      toolkitSlug: args.toolkitSlug,
      disabledToolSlugs,
      initialized: true,
      updatedAt,
    });

    return null;
  },
});
