"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function highlightJson(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    let className = "text-muted-foreground";

    if (match[1] && match[2]) {
      className = "text-primary";
    } else if (match[1]) {
      className = "text-green-700 dark:text-green-400";
    } else if (match[3]) {
      className = "text-violet-700 dark:text-violet-400";
    } else if (/^-?\d/.test(token)) {
      className = "text-blue-700 dark:text-blue-400";
    }

    parts.push(
      <span key={match.index} className={className}>
        {token}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function isJsonContent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

const jsonPanelClassName =
  "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words p-3";

export function HighlightedJsonPre({
  children,
  className,
  emptyPlaceholder = "—",
  embedded = false,
}: {
  children: string;
  className?: string;
  emptyPlaceholder?: string;
  /** Flush inside a parent card — no outer border or rounding (avoids double dividers). */
  embedded?: boolean;
}) {
  const trimmed = children.trim();
  const isJson = trimmed ? isJsonContent(trimmed) : false;

  return (
    <pre
      className={cn(
        "overflow-auto text-foreground",
        embedded
          ? "rounded-none border-0 bg-muted/30"
          : "rounded-lg border border-border bg-muted/30",
        jsonPanelClassName,
        className,
      )}
    >
      {trimmed ? (
        isJson ? (
          <code>{highlightJson(children)}</code>
        ) : (
          children
        )
      ) : (
        <span className="text-muted-foreground">{emptyPlaceholder}</span>
      )}
    </pre>
  );
}

export function HighlightedJsonTextarea({
  value,
  onChange,
  className,
  placeholder,
  minHeightClassName = "min-h-[20rem]",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  minHeightClassName?: string;
}) {
  const preRef = React.useRef<HTMLPreElement>(null);
  const trimmed = value.trim();
  const showHighlight = trimmed.length > 0;

  function syncScroll(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const pre = preRef.current;
    if (!pre) return;
    pre.scrollTop = event.currentTarget.scrollTop;
    pre.scrollLeft = event.currentTarget.scrollLeft;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-muted/30 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <div
        className={cn(
          "max-h-[inherit] overflow-auto overscroll-contain rounded-[calc(var(--radius-lg)-1px)]",
          minHeightClassName,
        )}
      >
        <div className={cn("grid", minHeightClassName)}>
          <pre
            ref={preRef}
            aria-hidden
            className={cn(
              "col-start-1 row-start-1 m-0 overflow-hidden pointer-events-none text-foreground",
              jsonPanelClassName,
              minHeightClassName,
            )}
          >
            <code>
              {showHighlight ? (
                highlightJson(value)
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </code>
          </pre>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
            className={cn(
              "col-start-1 row-start-1 w-full resize-y overflow-hidden border-0 bg-transparent text-transparent caret-foreground shadow-none outline-none focus-visible:ring-0 selection:bg-primary/20",
              jsonPanelClassName,
              minHeightClassName,
            )}
          />
        </div>
      </div>
    </div>
  );
}
