"use client";

import Markdown from "@/components/markdown";
import { HighlightedJsonPre } from "@/components/ui/json-highlight";
import { useChatContext } from "@/components/chat-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { formatMessageTime } from "@/lib/format";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { ArrowUp, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const SUGGESTIONS = [
  "Summarize my most recent notes",
  "Create a note titled \"Weekly goals\"",
  "Find notes about meetings",
] as const;

export function ChatInterface() {
  const [input, setInput] = useState("");
  const currentUser = useQuery(api.users.getCurrentUser);
  const greetingName = currentUser?.name ?? "there";
  const {
    messages,
    sendMessage,
    status,
    isProcessing,
    hasConversation,
    getMessageTimestamp,
  } = useChatContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const lastMessageIsUser = lastMessage?.role === "user";

  // Show the bottom loader whenever the model is active but not yet showing content.
  // - "submitted": waiting for stream to start
  // - "streaming" but no text is currently flowing and no tool is actively running:
  //   the model is thinking between steps
  const showBottomLoader = (() => {
    if (status === "submitted") return true;
    if (status !== "streaming") return false;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return true;
    const hasStreamingText = last.parts.some(
      (p) => p.type === "text" && p.text.length > 0
    );
    const hasRunningTool = last.parts.some(
      (p) =>
        isToolUIPart(p) &&
        (p.state === "input-streaming" || p.state === "input-available")
    );
    return !hasStreamingText && !hasRunningTool;
  })();

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      scrollToBottom("smooth");
    }
  }, [messages, status]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed && !isProcessing) {
      sendMessage({ text: trimmed });
      setInput("");
      requestAnimationFrame(() => scrollToBottom());
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(input);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  if (!hasConversation) {
    const displayName =
      greetingName === "there" ? greetingName : greetingName.toLowerCase();

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            {/* <CompanyLogo size="sm" className="rounded-md" /> */}
            <p className="font-serif text-foreground text-[1.65rem] leading-none font-normal tracking-tight">
              {getTimeGreeting()}, {displayName}
            </p>
          </div>
          <ChatComposer
            input={input}
            setInput={setInput}
            onSubmit={onSubmit}
            onKeyDown={handleKeyDown}
            isProcessing={isProcessing}
            showSuggestions
            onSuggestionClick={submit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6 pt-4 pb-32">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              timestamp={getMessageTimestamp(message.id)}
            />
          ))}
          {showBottomLoader && <Loader />}
          {status === "error" && <ErrorMessage />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-5 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <ChatComposer
            input={input}
            setInput={setInput}
            onSubmit={onSubmit}
            onKeyDown={handleKeyDown}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}

interface ChatComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isProcessing: boolean;
  showSuggestions?: boolean;
  onSuggestionClick?: (text: string) => void;
}

function ChatComposer({
  input,
  setInput,
  onSubmit,
  onKeyDown,
  isProcessing,
  showSuggestions = false,
  onSuggestionClick,
}: ChatComposerProps) {
  const isEmptyState = showSuggestions;

  if (isEmptyState) {
    return (
      <div className="flex flex-col gap-4">
        <form
          onSubmit={onSubmit}
          className="bg-card border-border/80 focus-within:border-border flex flex-col rounded-[1.35rem] border shadow-sm transition-colors"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="How can I help you today?"
            rows={3}
            className="max-h-48 min-h-[5.5rem] resize-none overflow-y-auto border-none bg-transparent px-5 pt-5 pb-2 text-base leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <div className="flex justify-end px-3 pb-3">
            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              disabled={!input.trim() || isProcessing}
              aria-label="Send message"
            >
              {isProcessing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </Button>
          </div>
        </form>

        {onSuggestionClick && (
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isProcessing}
                onClick={() => onSuggestionClick(suggestion)}
                className="bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground border-border/80 w-fit rounded-full border px-4 py-2 text-base transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border-border/80 focus-within:border-border flex flex-col rounded-[1.35rem] border shadow-sm transition-colors"
    >
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your company…"
        rows={3}
        className="max-h-48 min-h-[5.5rem] resize-none overflow-y-auto border-none bg-transparent px-5 pt-5 pb-2 text-base leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <div className="flex justify-end px-3 pb-3">
        <Button
          type="submit"
          size="icon"
          className="size-8 shrink-0 rounded-lg"
          disabled={!input.trim() || isProcessing}
          aria-label="Send message"
        >
          {isProcessing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </Button>
      </div>
    </form>
  );
}

interface ChatMessageProps {
  message: UIMessage;
  timestamp?: number;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

function ChatMessage({ message, timestamp }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const messageText = getMessageText(message);

  async function handleCopy() {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "text-base leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[78%]"
            : "text-foreground flex w-[85%] max-w-[85%] flex-col gap-2.5 py-1 pr-0.5 pl-4 sm:w-[82%] sm:max-w-[82%]"
        )}
      >
        {isUser ? (
          <Markdown inverted className="first:prose-p:mt-0 last:prose-p:mb-0">
            {messageText}
          </Markdown>
        ) : (
          message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <MessageTextPart
                  key={`text-${index}`}
                  text={part.text}
                  streaming={part.state === "streaming"}
                />
              );
            }
            if (isToolUIPart(part)) {
              const done =
                part.state === "output-available" ||
                part.state === "output-error";
              return (
                <ToolStep
                  key={part.toolCallId ?? index}
                  toolName={getToolName(part)}
                  label={getToolLabel(getToolName(part))}
                  running={!done}
                  state={part.state}
                  input={"input" in part ? part.input : undefined}
                  output={"output" in part ? part.output : undefined}
                  errorText={"errorText" in part ? part.errorText : undefined}
                />
              );
            }
            return null;
          })
        )}
      </div>

      {messageText && timestamp !== undefined && (
        <MessageMeta
          timestamp={timestamp}
          copied={copied}
          onCopy={handleCopy}
          align={isUser ? "end" : "start"}
        />
      )}
    </div>
  );
}

function MessageTextPart({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  if (!text) return null;

  if (streaming) {
    return (
      <div className="whitespace-pre-wrap break-words">
        {text}
        <span className="bg-foreground/70 ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse align-text-bottom" />
      </div>
    );
  }

  return (
    <Markdown className="first:prose-p:mt-0 last:prose-p:mb-0">{text}</Markdown>
  );
}

function formatToolData(data: unknown): string | null {
  if (data === undefined) return null;
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function ToolStep({
  toolName,
  label,
  running,
  state,
  input,
  output,
  errorText,
}: {
  toolName: string;
  label: string;
  running: boolean;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const formattedInput = formatToolData(input);
  const formattedOutput = formatToolData(output);

  return (
    <div className="not-prose w-full max-w-full">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className={cn(
          "hover:bg-muted/50 inline-flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
          running
            ? "border-border/60 bg-muted/20"
            : "border-border/80 bg-muted/30"
        )}
      >
        {running ? (
          <Loader2 className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
        ) : (
          <Check className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1",
            running ? "text-muted-foreground" : "text-foreground/80"
          )}
        >
          {label}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          {toolName}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-border/80 bg-muted/20 mt-1.5 overflow-hidden rounded-lg border text-sm">
          <div className="divide-border/60 flex min-h-0 divide-x">
            {/* Left: Input */}
            <div className="min-w-0 flex-1">
              {formattedInput !== null ? (
                <ToolDetailSection title="Input" content={formattedInput} />
              ) : (
                <div className="text-muted-foreground px-3 py-2 text-xs">
                  No input yet
                </div>
              )}
            </div>

            {/* Right: Output / Error */}
            <div className="min-w-0 flex-1">
              {errorText ? (
                <ToolDetailSection title="Error" content={errorText} variant="error" />
              ) : formattedOutput !== null ? (
                <ToolDetailSection title="Output" content={formattedOutput} />
              ) : (
                <div className="text-muted-foreground px-3 py-2 text-xs">
                  {running ? "Waiting for output…" : "No output"}
                </div>
              )}
            </div>
          </div>

          {running && (
            <div className="text-muted-foreground border-border/60 border-t px-3 py-1.5 text-xs capitalize">
              Status: {state.replace(/-/g, " ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolDetailSection({
  title,
  content,
  variant = "default",
}: {
  title: string;
  content: string;
  variant?: "default" | "error";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            variant === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground/70 hover:text-muted-foreground rounded p-1 transition-colors"
          aria-label={`Copy ${title.toLowerCase()}`}
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </div>
      <HighlightedJsonPre
        embedded
        className={cn(
          "max-h-56",
          variant === "error" && "text-destructive"
        )}
      >
        {content}
      </HighlightedJsonPre>
    </div>
  );
}

function MessageMeta({
  timestamp,
  copied,
  onCopy,
  align,
}: {
  timestamp: number;
  copied: boolean;
  onCopy: () => void;
  align: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1",
        align === "end" ? "flex-row-reverse" : "flex-row pl-4"
      )}
    >
      <span className="text-muted-foreground text-sm tabular-nums">
        {formatMessageTime(timestamp)}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="text-muted-foreground/70 hover:text-muted-foreground rounded p-1 transition-colors"
        aria-label="Copy message"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <span className="text-shimmer text-shimmer-fast text-base font-medium">
        Thinking
      </span>
      <LoadingDots />
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-muted-foreground/60 size-1 rounded-full"
          style={{
            animation: "bounce-dot 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}

function getToolLabel(toolName?: string) {
  switch (toolName) {
    case "findRelevantNotes":
      return "Searching notes";
    case "webSearch":
      return "Searching web";
    case "listNotes":
      return "Listing notes";
    case "listFolders":
      return "Listing folders";
    case "createFolder":
      return "Creating folder";
    case "moveNote":
      return "Moving note";
    case "createNote":
      return "Creating note";
    case "updateNote":
      return "Updating note";
    default:
      return "Thinking";
  }
}

function ErrorMessage() {
  return (
    <div className="flex justify-start pl-4">
      <div className="bg-destructive/10 text-destructive rounded-2xl px-3.5 py-2.5 text-base">
        Something went wrong. Please try again.
      </div>
    </div>
  );
}
