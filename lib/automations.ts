export const AUTOMATION_DEFINITIONS = [
  {
    key: "index-note-embeddings",
    name: "Index note embeddings",
    description:
      "Generates vector embeddings when notes are created so AI search stays up to date.",
    trigger: "On note create",
  },
  {
    key: "reindex-note-embeddings",
    name: "Reindex note embeddings",
    description:
      "Regenerates vector embeddings when a note is updated so AI search reflects the latest content.",
    trigger: "On note update",
  },
  {
    key: "cleanup-note-index",
    name: "Cleanup note index",
    description:
      "Removes embeddings when a note is deleted to keep the knowledge base consistent.",
    trigger: "On note delete",
  },
] as const;
