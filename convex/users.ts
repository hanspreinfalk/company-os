import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

function getDisplayName(name?: string, email?: string): string {
  if (name?.trim()) {
    return name.trim().split(" ")[0];
  }

  if (email) {
    const local = email.split("@")[0] ?? "";
    const first = local.split(/[._-]/)[0] ?? local;
    if (first) {
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
  }

  return "there";
}

export const getCurrentUserId = query({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      name: getDisplayName(user.name, user.email),
    };
  },
});
