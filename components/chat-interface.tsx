"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import Markdown from "@/components/markdown";
import { useChatContext } from "@/components/chat-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { formatMessageTime } from "@/lib/format";
import { UIMessage } from "ai";
import { ArrowUp, Check, Copy, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
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
  const lastMessageIsUser =
    messages.length > 0 && messages[messages.length - 1].role === "user";

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }

  function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed && !isProcessing) {
      sendMessage({ text: trimmed });
      setInput("");
      requestAnimationFrame(scrollToBottom);
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
        <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              timestamp={getMessageTimestamp(message.id)}
            />
          ))}
          {status === "submitted" && lastMessageIsUser && <Loader />}
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

function getToolNameFromPart(
  part: UIMessage["parts"][number] | undefined
): string | undefined {
  if (!part || part.type !== "tool-invocation") return undefined;
  return part.toolInvocation.toolName;
}

function getMessageSignature(message: UIMessage): string {
  return message.parts
    .map((part) => {
      if (part.type === "text") return `t:${part.text}`;
      if (part.type === "tool-invocation") {
        return `i:${part.toolInvocation.toolName}:${part.toolInvocation.state}`;
      }
      return part.type;
    })
    .join("|");
}

function chatMessagePropsAreEqual(
  prev: ChatMessageProps,
  next: ChatMessageProps
): boolean {
  return (
    prev.message.id === next.message.id &&
    prev.message.role === next.message.role &&
    prev.timestamp === next.timestamp &&
    getMessageSignature(prev.message) === getMessageSignature(next.message)
  );
}

const ChatMessage = React.memo(function ChatMessage({
  message,
  timestamp,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const currentStep = message.parts[message.parts.length - 1];
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
          "max-w-[85%] text-base leading-relaxed sm:max-w-[82%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl px-3.5 py-2.5"
            : "text-foreground py-1 pr-0.5 pl-4"
        )}
      >
        {currentStep?.type === "text" && (
          <Markdown inverted={isUser} className="first:prose-p:mt-0 last:prose-p:mb-0">
            {currentStep.text}
          </Markdown>
        )}
        {currentStep?.type === "tool-invocation" && (
          <ThinkingShimmer label={getToolLabel(getToolNameFromPart(currentStep))} />
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
}, chatMessagePropsAreEqual);

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
    <div className="flex justify-start py-1 pl-4">
      <ThinkingShimmer />
    </div>
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
    case "createNote":
      return "Creating note";
    case "updateNote":
      return "Updating note";
    default:
      return "Thinking";
  }
}

const ThinkingShimmer = React.memo(function ThinkingShimmer({
  label = "Thinking",
}: {
  label?: string;
}) {
  return (
    <Shimmer as="span" className="text-base font-medium" duration={1.5}>
      {label}
    </Shimmer>
  );
});

function ErrorMessage() {
  return (
    <div className="flex justify-start pl-4">
      <div className="bg-destructive/10 text-destructive rounded-2xl px-3.5 py-2.5 text-base">
        Something went wrong. Please try again.
      </div>
    </div>
  );
}
