"use client";

import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { CreateNoteButton } from "./create-note-button";
import { NoteItem } from "./note-item";

export function NotesPage() {
  const notes = useQuery(api.notes.getUserNotes);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const legacyNoteId = searchParams.get("noteId");
    if (legacyNoteId) {
      router.replace(`/notes/${legacyNoteId}`);
    }
  }, [searchParams, router]);

  const noteCountLabel =
    notes === undefined
      ? "Loading notes..."
      : `${notes.length} note${notes.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your Notes</h1>
          <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
            Capture knowledge in markdown. Use Chat to search, create, and
            update your notes with AI.
          </p>
          <p className="text-muted-foreground text-xs">{noteCountLabel}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <CreateNoteButton />
        </div>
      </div>

      {notes === undefined ? (
        <LoadingSkeleton />
      ) : notes.length === 0 ? (
        <EmptyView />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <NoteItem key={note._id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyView() {
  return (
    <p className="text-muted-foreground py-16 text-center text-sm">
      No notes yet. Create your first note to get started.
    </p>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
