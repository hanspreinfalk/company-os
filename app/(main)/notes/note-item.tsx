"use client";

import Markdown from "@/components/markdown";
import Link from "next/link";
import { Doc } from "../../../convex/_generated/dataModel";

interface NoteItemProps {
  note: Doc<"notes">;
}

export function NoteItem({ note }: NoteItemProps) {
  return (
    <Link
      href={`/notes/${note._id}`}
      className="bg-background hover:border-primary/25 group block w-full rounded-lg border border-border/50 p-4 text-left transition-all hover:shadow-xs"
    >
      <h3 className="group-hover:text-primary mb-2 line-clamp-1 text-sm font-medium transition-colors">
        {note.title}
      </h3>
      <div className="relative max-h-[5.5rem] overflow-hidden">
        <Markdown className="prose-sm text-muted-foreground text-sm leading-relaxed [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_table]:hidden">
          {note.body}
        </Markdown>
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent" />
      </div>
    </Link>
  );
}
