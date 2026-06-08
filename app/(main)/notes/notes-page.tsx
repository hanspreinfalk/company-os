"use client";

import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CreateNoteButton } from "./create-note-button";
import { FolderTree } from "./folder-tree";
import { NoteItem } from "./note-item";

export function NotesPage() {
  const notes = useQuery(api.notes.getUserNotes);
  const folders = useQuery(api.folders.getUserFolders);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | null>(null);

  useEffect(() => {
    const legacyNoteId = searchParams.get("noteId");
    if (legacyNoteId) {
      router.replace(`/notes/${legacyNoteId}`);
    }
  }, [searchParams, router]);

  const noteCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes ?? []) {
      if (note.folderId) {
        counts[note.folderId] = (counts[note.folderId] ?? 0) + 1;
      }
    }
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (selectedFolderId === null) return notes;
    return notes.filter((n) => n.folderId === selectedFolderId);
  }, [notes, selectedFolderId]);

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId || !folders) return null;
    return folders.find((f) => f._id === selectedFolderId) ?? null;
  }, [selectedFolderId, folders]);

  const isLoading = notes === undefined || folders === undefined;
  const title = selectedFolder ? selectedFolder.name : "All Notes";

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Sidebar */}
      <aside className="flex w-48 shrink-0 flex-col overflow-y-auto border-r border-border/40 pr-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          </div>
        ) : (
          <FolderTree
            selectedFolderId={selectedFolderId}
            onSelectFolder={(id) => setSelectedFolderId(id)}
            noteCountByFolder={noteCountByFolder}
            totalNoteCount={notes?.length ?? 0}
          />
        )}
      </aside>

      {/* Main panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pl-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {isLoading
                ? "Loading…"
                : `${filteredNotes.length} note${filteredNotes.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <CreateNoteButton folderId={selectedFolderId ?? undefined} />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <EmptyView hasFolderFilter={selectedFolderId !== null} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredNotes.map((note) => (
              <NoteItem key={note._id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyView({ hasFolderFilter }: { hasFolderFilter: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24">
      <p className="text-muted-foreground text-sm">
        {hasFolderFilter
          ? "No notes in this folder yet."
          : "No notes yet. Create your first note to get started."}
      </p>
    </div>
  );
}
