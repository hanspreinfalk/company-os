"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { AIChatButton } from "./ai-chat-button";
import { CreateNoteButton } from "./create-note-button";
import { NoteItem } from "./note-item";

export function NotesPage() {
  const notes = useQuery(api.notes.getUserNotes);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your Notes</h1>
          <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
            Capture knowledge, then ask the AI assistant to search and
            summarize anything you&apos;ve saved.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AIChatButton />
          <CreateNoteButton />
        </div>
      </div>

      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Knowledge base</h2>
            <p className="text-muted-foreground text-xs">
              {notes === undefined
                ? "Loading notes..."
                : `${notes.length} note${notes.length === 1 ? "" : "s"} saved`}
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 font-normal">
            <Sparkles className="size-3" />
            AI-powered
          </Badge>
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
    </div>
  );
}

function EmptyView() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <p className="text-muted-foreground text-sm">
        No notes yet. Create your first note to get started.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-lg" />
      ))}
    </div>
  );
}
