"use client";

import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface NoteDetailPageProps {
  noteId: string;
}

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
  const router = useRouter();
  const note = useQuery(api.notes.getNote, {
    noteId: noteId as Id<"notes">,
  });
  const deleteNote = useMutation(api.notes.deleteNote);
  const [deletePending, setDeletePending] = useState(false);

  async function handleDelete() {
    if (!note) return;
    setDeletePending(true);
    try {
      await deleteNote({ noteId: note._id });
      toast.success("Note deleted");
      router.push("/notes");
    } catch (error) {
      console.error("Failed to delete note", error);
      toast.error("Failed to delete note. Please try again.");
    } finally {
      setDeletePending(false);
    }
  }

  if (note === undefined) {
    return <NoteDetailSkeleton />;
  }

  if (note === null) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <p className="text-muted-foreground text-sm">Note not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <BackButton />
          <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive shrink-0 gap-1.5"
          onClick={handleDelete}
          disabled={deletePending}
        >
          <Trash2 className="size-3.5" />
          {deletePending ? "Deleting..." : "Delete"}
        </Button>
      </div>

      <article className="bg-card rounded-xl border border-border/50 p-6 shadow-xs sm:p-8">
        <Markdown className="text-[15px] leading-relaxed">{note.body}</Markdown>
      </article>
    </div>
  );
}

function BackButton() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
      <Link href="/notes">
        <ArrowLeft className="size-3.5" />
        Back to notes
      </Link>
    </Button>
  );
}

function NoteDetailSkeleton() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
