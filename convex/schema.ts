import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  notes: defineTable({
    title: v.string(),
    body: v.string(),
    userId: v.id("users"),
  }).index("by_userId", ["userId"]),

  noteEmbeddings: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    noteId: v.id("notes"),
    userId: v.id("users"),
  })
    .index("by_noteId", ["noteId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),

  automationRuns: defineTable({
    userId: v.id("users"),
    automationKey: v.string(),
    automationName: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    notesUpdated: v.number(),
    noteId: v.optional(v.id("notes")),
    message: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_startedAt", ["userId", "startedAt"]),
});

export default schema;
