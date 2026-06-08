"use client";

import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction, useQuery } from "convex/react";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type ViewMode = "view" | "edit";

interface NotePreviewProps {
  noteId: Id<"notes">;
}

export function NotePreview({ noteId }: NotePreviewProps) {
  const note = useQuery(api.notes.getNote, { noteId });
  const updateNote = useAction(api.notesActions.updateNote);

  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setDraftTitle(note.title);
      setDraftBody(note.body);
      setViewMode("view");
    }
  }, [note?._id, note?.title, note?.body]);

  const isDirty =
    note !== null &&
    note !== undefined &&
    (draftTitle !== note.title || draftBody !== note.body);

  function handleCancel() {
    if (!note) return;
    setDraftTitle(note.title);
    setDraftBody(note.body);
    setViewMode("view");
  }

  async function handleSave() {
    if (!note || !isDirty) return;

    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title || !body) {
      toast.error("Title and body cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateNote({ noteId: note._id, title, body });
      toast.success("Note saved");
      setViewMode("view");
    } catch (error) {
      console.error("Failed to save note", error);
      toast.error("Failed to save note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (note === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-base">Note not found.</p>
      </div>
    );
  }

  return (
    <article className="bg-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 shadow-xs">
      {viewMode === "view" ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground absolute top-3 right-3 z-10 gap-1.5 opacity-40 transition-opacity hover:opacity-100"
            onClick={() => setViewMode("edit")}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            <Markdown className="text-base leading-relaxed">{note.body}</Markdown>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex shrink-0 items-center gap-2">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Note title"
              className="min-w-0 flex-1"
              autoFocus
            />
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          <Textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Write markdown…"
            className="min-h-0 flex-1 resize-none font-mono text-base leading-relaxed"
          />
        </div>
      )}
    </article>
  );
}
