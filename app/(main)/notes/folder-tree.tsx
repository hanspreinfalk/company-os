"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { CreateNoteDialog } from "./create-note-button";

interface FolderNode {
  _id: Id<"folders">;
  name: string;
  parentFolderId?: Id<"folders">;
  children: FolderNode[];
}

function folderContainsSelectedNote(
  node: FolderNode,
  notesByFolder: Record<string, Doc<"notes">[]>,
  selectedNoteId: Id<"notes"> | null
): boolean {
  if (!selectedNoteId) return false;
  const notes = notesByFolder[node._id] ?? [];
  if (notes.some((n) => n._id === selectedNoteId)) return true;
  return node.children.some((child) =>
    folderContainsSelectedNote(child, notesByFolder, selectedNoteId)
  );
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function noteMatchesSearch(note: Doc<"notes">, query: string) {
  const q = normalizeQuery(query);
  if (!q) return true;
  return (
    note.title.toLowerCase().includes(q) ||
    note.body.toLowerCase().includes(q)
  );
}

function folderMatchesSearch(
  node: FolderNode,
  query: string,
  notesByFolder: Record<string, Doc<"notes">[]>
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  if (node.name.toLowerCase().includes(q)) return true;
  const notes = notesByFolder[node._id] ?? [];
  if (notes.some((note) => noteMatchesSearch(note, query))) return true;
  for (const child of node.children) {
    if (folderMatchesSearch(child, query, notesByFolder)) {
      return true;
    }
  }
  return false;
}

function buildTree(
  folders: Array<{
    _id: Id<"folders">;
    name: string;
    parentFolderId?: Id<"folders">;
  }>
): FolderNode[] {
  const map = new Map<string, FolderNode>();
  for (const f of folders) {
    map.set(f._id, { ...f, children: [] });
  }
  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = map.get(f._id)!;
    if (f.parentFolderId && map.has(f.parentFolderId)) {
      map.get(f.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface FolderTreeProps {
  notes: Doc<"notes">[];
  selectedNoteId: Id<"notes"> | null;
  onSelectNote: (id: Id<"notes">) => void;
  onNoteDeleted?: (noteId: Id<"notes">) => void;
}

export function FolderTree({
  notes,
  selectedNoteId,
  onSelectNote,
  onNoteDeleted,
}: FolderTreeProps) {
  const folders = useQuery(api.folders.getUserFolders);
  const createFolder = useMutation(api.folders.createFolder);
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingAt, setCreatingAt] = useState<Id<"folders"> | "root" | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [rootNoteDialogOpen, setRootNoteDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(folders ?? []);
  const isSearching = normalizeQuery(searchQuery).length > 0;

  const { notesByFolder, rootNotes } = useMemo(() => {
    const byFolder: Record<string, Doc<"notes">[]> = {};
    const root: Doc<"notes">[] = [];
    for (const note of notes) {
      if (note.folderId) {
        if (!byFolder[note.folderId]) byFolder[note.folderId] = [];
        byFolder[note.folderId].push(note);
      } else {
        root.push(note);
      }
    }
    return { notesByFolder: byFolder, rootNotes: root };
  }, [notes]);

  const filteredRootNotes = useMemo(() => {
    if (!isSearching) return rootNotes;
    return rootNotes.filter((note) => noteMatchesSearch(note, searchQuery));
  }, [rootNotes, searchQuery, isSearching]);

  const visibleFolders = useMemo(() => {
    if (!isSearching) return tree;
    return tree.filter((node) =>
      folderMatchesSearch(node, searchQuery, notesByFolder)
    );
  }, [tree, searchQuery, isSearching, notesByFolder]);

  const hasSearchResults =
    !isSearching ||
    filteredRootNotes.length > 0 ||
    visibleFolders.length > 0;

  async function handleCreate(parentFolderId?: Id<"folders">) {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingAt(null);
      setNewFolderName("");
      return;
    }
    try {
      await createFolder({ name, parentFolderId });
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setCreatingAt(null);
      setNewFolderName("");
    }
  }

  return (
    <nav className="flex flex-col">
      <div className="relative mb-3">
        <Search className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          ref={searchRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes…"
          className="h-9 pr-8 pl-8 text-base"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              searchRef.current?.focus();
            }}
            className="text-muted-foreground/50 hover:text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 transition-colors"
            aria-label="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {!hasSearchResults && (
        <p className="text-muted-foreground/60 py-4 text-center text-sm">
          No notes found
        </p>
      )}

      {/* Root-level notes */}
      {filteredRootNotes.map((note) => (
        <NoteTreeItem
          key={note._id}
          note={note}
          depth={0}
          selected={selectedNoteId === note._id}
          onSelect={() => onSelectNote(note._id)}
          onDeleted={onNoteDeleted}
        />
      ))}

      {/* Folders header */}
      {(!isSearching || visibleFolders.length > 0) && (
        <div className="mt-3 mb-1 flex items-center justify-between">
          <span className="text-muted-foreground/60 text-xs font-semibold uppercase tracking-widest">
            Folders
          </span>
          {!isSearching && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRootNoteDialogOpen(true)}
                className="text-muted-foreground/50 hover:text-muted-foreground rounded p-0.5 transition-colors"
                title="New note at root"
              >
                <FilePlus className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  setCreatingAt("root");
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="text-muted-foreground/50 hover:text-muted-foreground rounded p-0.5 transition-colors"
                title="New folder"
              >
                <FolderPlus className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <CreateNoteDialog
        open={rootNoteDialogOpen}
        onOpenChange={setRootNoteDialogOpen}
        onNoteCreated={(id) => onSelectNote(id)}
      />

      {/* New root folder inline input */}
      {!isSearching && creatingAt === "root" && (
        <div className="py-0.5">
          <Input
            ref={inputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            className="h-8 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate(undefined);
              if (e.key === "Escape") {
                setCreatingAt(null);
                setNewFolderName("");
              }
            }}
            onBlur={() => handleCreate(undefined)}
            autoFocus
          />
        </div>
      )}

      {/* Folder tree */}
      {visibleFolders.map((node) => (
        <FolderItem
          key={node._id}
          node={node}
          depth={0}
          selectedNoteId={selectedNoteId}
          onSelectNote={onSelectNote}
          onNoteDeleted={onNoteDeleted}
          notesByFolder={notesByFolder}
          searchQuery={searchQuery}
          creatingAt={creatingAt}
          setCreatingAt={setCreatingAt}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          onCreateFolder={handleCreate}
        />
      ))}

      {folders !== undefined &&
        folders.length === 0 &&
        creatingAt === null &&
        !isSearching && (
        <p className="text-muted-foreground/40 py-1 text-sm">
          No folders yet
        </p>
        )}
    </nav>
  );
}

function NoteTreeItem({
  note,
  depth,
  selected,
  onSelect,
  onDeleted,
}: {
  note: Doc<"notes">;
  depth: number;
  selected: boolean;
  onSelect: () => void;
  onDeleted?: (noteId: Id<"notes">) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(note.title);
  const renameRef = useRef<HTMLInputElement>(null);
  const deleteNote = useMutation(api.notes.deleteNote);
  const renameNote = useMutation(api.notes.renameNote);

  useEffect(() => {
    setRenameValue(note.title);
  }, [note.title]);

  async function handleRename() {
    const title = renameValue.trim();
    if (!title || title === note.title) {
      setRenaming(false);
      setRenameValue(note.title);
      return;
    }
    try {
      await renameNote({ noteId: note._id, title });
    } catch {
      toast.error("Failed to rename note");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteNote({ noteId: note._id });
      toast.success("Note deleted");
      onDeleted?.(note._id);
    } catch {
      toast.error("Failed to delete note");
    }
  }

  return (
    <div
      style={{ paddingLeft: `${depth * 14 + 18}px` }}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-base transition-colors",
        selected
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 pr-5"
        onClick={onSelect}
      >
        <FileText
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            selected
              ? "text-foreground"
              : "text-muted-foreground/50 group-hover:text-muted-foreground"
          )}
        />
        {renaming ? (
          <Input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-6 min-w-0 flex-1 px-1 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setRenaming(false);
                setRenameValue(note.title);
              }
            }}
            onBlur={handleRename}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">{note.title}</span>
        )}
      </button>

      {!renaming && (
        <div className="absolute top-1/2 right-1 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground/30 hover:text-muted-foreground rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setRenaming(true);
                  setTimeout(() => renameRef.current?.focus(), 50);
                }}
              >
                <Pencil className="mr-2 size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                <Trash2 className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  selectedNoteId: Id<"notes"> | null;
  onSelectNote: (id: Id<"notes">) => void;
  onNoteDeleted?: (noteId: Id<"notes">) => void;
  notesByFolder: Record<string, Doc<"notes">[]>;
  searchQuery: string;
  creatingAt: Id<"folders"> | "root" | null;
  setCreatingAt: (id: Id<"folders"> | "root" | null) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  onCreateFolder: (parentFolderId?: Id<"folders">) => void;
}

function FolderItem({
  node,
  depth,
  selectedNoteId,
  onSelectNote,
  onNoteDeleted,
  notesByFolder,
  searchQuery,
  creatingAt,
  setCreatingAt,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
}: FolderItemProps) {
  const isSearching = normalizeQuery(searchQuery).length > 0;
  const folderNotes = notesByFolder[node._id] ?? [];
  const visibleNotes = isSearching
    ? folderNotes.filter((note) => noteMatchesSearch(note, searchQuery))
    : folderNotes;
  const visibleChildren = isSearching
    ? node.children.filter((child) =>
        folderMatchesSearch(child, searchQuery, notesByFolder)
      )
    : node.children;
  const containsSelected = folderContainsSelectedNote(
    node,
    notesByFolder,
    selectedNoteId
  );
  const hasSearchMatch = folderMatchesSearch(
    node,
    searchQuery,
    notesByFolder
  );
  const [expanded, setExpanded] = useState(containsSelected || isSearching);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  useEffect(() => {
    if (containsSelected || (isSearching && hasSearchMatch)) {
      setExpanded(true);
    }
  }, [containsSelected, isSearching, hasSearchMatch]);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const subfolderInputRef = useRef<HTMLInputElement>(null);

  const deleteFolder = useMutation(api.folders.deleteFolder);
  const renameFolder = useMutation(api.folders.renameFolder);

  const hasChildren =
    visibleChildren.length > 0 ||
    visibleNotes.length > 0 ||
    (!isSearching && creatingAt === node._id);

  async function handleRename() {
    const name = renameValue.trim();
    if (!name || name === node.name) {
      setRenaming(false);
      setRenameValue(node.name);
      return;
    }
    try {
      await renameFolder({ folderId: node._id, name });
    } catch {
      toast.error("Failed to rename folder");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteFolder({ folderId: node._id });
    } catch {
      toast.error("Failed to delete folder");
    }
  }

  return (
    <div>
      <div
        className="group relative flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-base transition-colors"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {/* Expand/collapse chevron */}
        <button
          className="text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : (
            <span className="block size-3" />
          )}
        </button>

        {/* Folder icon + name */}
        <button
          className="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-2 pr-5"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors">
            {expanded ? (
              <FolderOpen className="size-3.5" />
            ) : (
              <Folder className="size-3.5" />
            )}
          </span>
          {renaming ? (
            <Input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-6 min-w-0 flex-1 px-1 text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameValue(node.name);
                }
              }}
              onBlur={handleRename}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-left text-base">
              {node.name}
            </span>
          )}
        </button>

        {/* Menu */}
        {!isSearching && (
          <div className="absolute top-1/2 right-1 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted-foreground/30 hover:text-muted-foreground rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                    setNoteDialogOpen(true);
                  }}
                >
                  <FilePlus className="mr-2 size-3.5" />
                  New note
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingAt(node._id);
                    setTimeout(() => subfolderInputRef.current?.focus(), 50);
                  }}
                >
                  <FolderPlus className="mr-2 size-3.5" />
                  New subfolder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(true);
                    setTimeout(() => renameRef.current?.focus(), 50);
                  }}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {visibleNotes.map((note) => (
            <NoteTreeItem
              key={note._id}
              note={note}
              depth={depth + 1}
              selected={selectedNoteId === note._id}
              onSelect={() => onSelectNote(note._id)}
              onDeleted={onNoteDeleted}
            />
          ))}
          {!isSearching && creatingAt === node._id && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 14}px` }}
              className="py-0.5"
            >
              <Input
                ref={subfolderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Subfolder name…"
                className="h-8 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreateFolder(node._id);
                  if (e.key === "Escape") {
                    setCreatingAt(null);
                    setNewFolderName("");
                  }
                }}
                onBlur={() => onCreateFolder(node._id)}
                autoFocus
              />
            </div>
          )}
          {visibleChildren.map((child) => (
            <FolderItem
              key={child._id}
              node={child}
              depth={depth + 1}
              selectedNoteId={selectedNoteId}
              onSelectNote={onSelectNote}
              onNoteDeleted={onNoteDeleted}
              notesByFolder={notesByFolder}
              searchQuery={searchQuery}
              creatingAt={creatingAt}
              setCreatingAt={setCreatingAt}
              newFolderName={newFolderName}
              setNewFolderName={setNewFolderName}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </div>
      )}

      <CreateNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        folderId={node._id}
        onNoteCreated={(id) => {
          setExpanded(true);
          onSelectNote(id);
        }}
      />
    </div>
  );
}