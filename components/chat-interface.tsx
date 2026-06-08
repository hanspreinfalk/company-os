"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { CompanyLogo } from "@/components/company-logo";
import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { api } from "../convex/_generated/api";

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
  /.cloud$/,
  ".site"
);

const SUGGESTIONS = [
  "Summarize my most recent notes",
  "Create a note titled \"Weekly goals\"",
  "Find notes about meetings",
] as const;

export function ChatInterface() {
  const [input, setInput] = useState("");
  const token = useAuthToken();
  const currentUser = useQuery(api.users.getCurrentUser);
  const greetingName = currentUser?.name ?? "there";

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${convexSiteUrl}/api/chat`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    messages: [],
    maxSteps: 10,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProcessing = status === "submitted" || status === "streaming";
  const hasConversation = messages.some((m) => m.role === "user");
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
      <div className="flex shrink-0 justify-end px-4 py-2 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMessages([])}
          className="text-muted-foreground hover:text-foreground gap-1.5"
          disabled={isProcessing}
        >
          <Trash2 className="size-3.5" />
          Clear chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {status === "submitted" && lastMessageIsUser && <Loader />}
          {status === "error" && <ErrorMessage />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 px-4 pt-3 pb-5 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
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
            className="max-h-48 min-h-[5.5rem] resize-none overflow-y-auto border-none bg-transparent px-5 pt-5 pb-2 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
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
                className="bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground border-border/80 w-fit rounded-full border px-4 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
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
      className="border-border bg-background focus-within:border-ring focus-within:ring-ring/30 flex items-end gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors focus-within:ring-[3px]"
    >
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your company…"
        rows={2}
        className="max-h-48 min-h-[3.25rem] flex-1 resize-none overflow-y-auto border-none bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <Button
        type="submit"
        size="icon"
        className="mb-0.5 size-9 shrink-0 rounded-xl"
        disabled={!input.trim() || isProcessing}
        aria-label="Send message"
      >
        {isProcessing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowUp className="size-4" />
        )}
      </Button>
    </form>
  );
}

interface ChatMessageProps {
  message: UIMessage;
}

function ChatMessage({ message }: ChatMessageProps) {
  const currentStep = message.parts[message.parts.length - 1];
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] text-sm leading-relaxed sm:max-w-[82%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2.5"
            : "text-foreground px-0.5 py-1"
        )}
      >
        {currentStep?.type === "text" && (
          <Markdown inverted={isUser} className="first:prose-p:mt-0 last:prose-p:mb-0">
            {currentStep.text}
          </Markdown>
        )}
        {currentStep?.type === "tool-invocation" && (
          <ThinkingShimmer
            label={getToolLabel(
              "toolName" in currentStep
                ? (currentStep.toolName as string)
                : "toolInvocation" in currentStep
                  ? currentStep.toolInvocation?.toolName
                  : undefined
            )}
          />
        )}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-start px-0.5 py-1">
      <ThinkingShimmer />
    </div>
  );
}

function getToolLabel(toolName?: string) {
  switch (toolName) {
    case "findRelevantNotes":
      return "Searching notes";
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

function ThinkingShimmer({ label = "Thinking" }: { label?: string }) {
  return (
    <Shimmer as="span" className="text-sm font-medium" duration={1.5}>
      {label}
    </Shimmer>
  );
}

function ErrorMessage() {
  return (
    <div className="flex justify-start">
      <div className="bg-destructive/10 text-destructive rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm">
        Something went wrong. Please try again.
      </div>
    </div>
  );
}
