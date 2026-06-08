"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import { NotePreviewDialog } from "./note-preview-dialog";

interface NoteItemProps {
  note: Doc<"notes">;
}

export function NoteItem({ note }: NoteItemProps) {
  function handleOpenNote() {
    window.history.pushState(null, "", `?noteId=${note._id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenNote}
        className="bg-background hover:border-primary/30 group w-full rounded-lg border p-4 text-left transition-all hover:shadow-sm"
      >
        <h3 className="group-hover:text-primary mb-2 line-clamp-1 text-sm font-medium transition-colors">
          {note.title}
        </h3>
        <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed whitespace-pre-line">
          {note.body}
        </p>
      </button>
      <NotePreviewDialog note={note} />
    </>
  );
}
