"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useQuery } from "convex/react";
import { FileText, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FolderTree } from "./folder-tree";
import { NotePreview } from "./note-preview";

export function NotesPage() {
  const notes = useQuery(api.notes.getUserNotes);
  const searchParams = useSearchParams();
  const router = useRouter();

  const noteParam = searchParams.get("note");
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"notes"> | null>(
    noteParam ? (noteParam as Id<"notes">) : null
  );

  useEffect(() => {
    const legacyNoteId = searchParams.get("noteId");
    if (legacyNoteId) {
      router.replace(`/notes?note=${legacyNoteId}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (noteParam) {
      setSelectedNoteId(noteParam as Id<"notes">);
    } else if (!searchParams.get("noteId")) {
      setSelectedNoteId(null);
    }
  }, [noteParam, searchParams]);

  const handleSelectNote = useCallback(
    (id: Id<"notes">) => {
      setSelectedNoteId(id);
      router.replace(`/notes?note=${id}`, { scroll: false });
    },
    [router]
  );

  const handleNoteDeleted = useCallback(
    (noteId?: Id<"notes">) => {
      if (!noteId || noteId === selectedNoteId) {
        setSelectedNoteId(null);
        router.replace("/notes", { scroll: false });
      }
    },
    [router, selectedNoteId]
  );

  const isLoading = notes === undefined;

  return (
    <div className="bg-card h-full min-h-0 w-full overflow-hidden rounded-xl border border-border/50 shadow-xs">
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="notes-layout"
        className="h-full"
      >
        {/* File tree sidebar */}
        <ResizablePanel
          defaultSize={22}
          minSize={14}
          maxSize={45}
          className="flex flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : (
              <FolderTree
                notes={notes}
                selectedNoteId={selectedNoteId}
                onSelectNote={handleSelectNote}
                onNoteDeleted={handleNoteDeleted}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border/50" />

        {/* Preview panel */}
        <ResizablePanel defaultSize={78} className="flex flex-col overflow-hidden">
          {selectedNoteId ? (
            <NotePreview noteId={selectedNoteId} />
          ) : (
            <EmptyPreview />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <FileText className="text-muted-foreground/30 size-10" />
      <p className="text-muted-foreground text-base">
        Select a note to preview
      </p>
    </div>
  );
}
