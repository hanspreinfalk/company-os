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
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface FolderNode {
  _id: Id<"folders">;
  name: string;
  parentFolderId?: Id<"folders">;
  children: FolderNode[];
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
  selectedFolderId: Id<"folders"> | null;
  onSelectFolder: (id: Id<"folders"> | null) => void;
  noteCountByFolder: Record<string, number>;
  totalNoteCount: number;
}

export function FolderTree({
  selectedFolderId,
  onSelectFolder,
  noteCountByFolder,
  totalNoteCount,
}: FolderTreeProps) {
  const folders = useQuery(api.folders.getUserFolders);
  const createFolder = useMutation(api.folders.createFolder);
  const [creatingAt, setCreatingAt] = useState<Id<"folders"> | "root" | null>(
    null
  );
  const [newFolderName, setNewFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(folders ?? []);

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
      {/* All Notes */}
      <NavItem
        icon={<FileText className="size-3.5 shrink-0" />}
        label="All Notes"
        count={totalNoteCount}
        selected={selectedFolderId === null}
        onClick={() => onSelectFolder(null)}
      />

      {/* Folders header */}
      <div className="mt-4 mb-1 flex items-center justify-between px-2">
        <span className="text-muted-foreground/60 text-[10px] font-semibold uppercase tracking-widest">
          Folders
        </span>
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

      {/* New root folder inline input */}
      {creatingAt === "root" && (
        <div className="px-2 py-0.5">
          <Input
            ref={inputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            className="h-7 text-xs"
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
      {tree.map((node) => (
        <FolderItem
          key={node._id}
          node={node}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          noteCountByFolder={noteCountByFolder}
          creatingAt={creatingAt}
          setCreatingAt={setCreatingAt}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          onCreateFolder={handleCreate}
        />
      ))}

      {folders !== undefined && folders.length === 0 && creatingAt === null && (
        <p className="text-muted-foreground/40 px-2 py-1 text-xs">
          No folders yet
        </p>
      )}
    </nav>
  );
}

function NavItem({
  icon,
  label,
  count,
  selected,
  onClick,
  depth = 0,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
  depth?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
        selected
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "transition-colors",
          selected ? "text-foreground" : "text-muted-foreground/50 group-hover:text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums transition-colors",
            selected ? "text-muted-foreground" : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface FolderItemProps {
  node: FolderNode;
  depth: number;
  selectedFolderId: Id<"folders"> | null;
  onSelectFolder: (id: Id<"folders"> | null) => void;
  noteCountByFolder: Record<string, number>;
  creatingAt: Id<"folders"> | "root" | null;
  setCreatingAt: (id: Id<"folders"> | "root" | null) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  onCreateFolder: (parentFolderId?: Id<"folders">) => void;
}

function FolderItem({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
  noteCountByFolder,
  creatingAt,
  setCreatingAt,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
}: FolderItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const subfolderInputRef = useRef<HTMLInputElement>(null);

  const deleteFolder = useMutation(api.folders.deleteFolder);
  const renameFolder = useMutation(api.folders.renameFolder);

  const isSelected = selectedFolderId === node._id;
  const count = noteCountByFolder[node._id] ?? 0;
  const hasChildren = node.children.length > 0 || creatingAt === node._id;

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
        className={cn(
          "group flex w-full items-center gap-2 rounded-md py-1.5 pr-1 text-sm transition-colors",
          isSelected
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* Expand/collapse chevron */}
        <button
          className={cn(
            "shrink-0 transition-colors",
            isSelected
              ? "text-muted-foreground"
              : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
          )}
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
          className="flex min-w-0 flex-1 items-center gap-2"
          onClick={() => onSelectFolder(node._id)}
        >
          <span
            className={cn(
              "shrink-0 transition-colors",
              isSelected
                ? "text-foreground"
                : "text-muted-foreground/50 group-hover:text-muted-foreground"
            )}
          >
            {isSelected || expanded ? (
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
              className="h-5 min-w-0 flex-1 px-1 text-xs"
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
            <span className="min-w-0 flex-1 truncate text-left text-sm">
              {node.name}
            </span>
          )}
        </button>

        {/* Right side: count + menu */}
        <div className="flex shrink-0 items-center gap-0.5">
          {count > 0 && !renaming && (
            <span
              className={cn(
                "text-xs tabular-nums transition-colors",
                isSelected
                  ? "text-muted-foreground"
                  : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
              )}
            >
              {count}
            </span>
          )}
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
                className="text-destructive focus:text-destructive"
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
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {creatingAt === node._id && (
            <div
              style={{ paddingLeft: `${8 + (depth + 1) * 14 + 10}px` }}
              className="py-0.5 pr-2"
            >
              <Input
                ref={subfolderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Subfolder name…"
                className="h-7 text-xs"
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
          {node.children.map((child) => (
            <FolderItem
              key={child._id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              noteCountByFolder={noteCountByFolder}
              creatingAt={creatingAt}
              setCreatingAt={setCreatingAt}
              newFolderName={newFolderName}
              setNewFolderName={setNewFolderName}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
