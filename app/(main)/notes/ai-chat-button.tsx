"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { Bot, Expand, Minimize, Send, Sparkles, Trash, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
  /.cloud$/,
  ".site"
);

export function AIChatButton() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setChatOpen(true)} variant="outline" size="sm">
        <Sparkles className="size-3.5" />
        <span>Ask AI</span>
      </Button>
      <AIChatBox open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

interface AIChatBoxProps {
  open: boolean;
  onClose: () => void;
}

const initialMessages: UIMessage[] = [
  {
    id: "welcome-message",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'm your notes assistant. I can find and summarize any information that you saved.",
      },
    ],
  },
];

function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const token = useAuthToken();

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${convexSiteUrl}/api/chat`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    messages: initialMessages,
    maxSteps: 3,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProcessing = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      sendMessage({ text: input });
      setInput("");
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      onSubmit(e);
    }
  };

  if (!open) return null;

  const lastMessageIsUser = messages[messages.length - 1].role === "user";

  return (
    <div
      className={cn(
        "bg-card animate-in slide-in-from-bottom-10 fixed right-6 bottom-6 z-50 flex flex-col rounded-xl border shadow-lg duration-300",
        isExpanded
          ? "h-[650px] max-h-[90vh] w-[550px]"
          : "h-[500px] max-h-[80vh] w-80 sm:w-96"
      )}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md">
            <Bot size={14} />
          </div>
          <div>
            <h3 className="text-sm font-medium">Notes Assistant</h3>
            <p className="text-muted-foreground text-xs">Powered by GPT-4o</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="size-8"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize /> : <Expand />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMessages(initialMessages)}
            className="size-8"
            title="Clear chat"
            disabled={isProcessing}
          >
            <Trash />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {status === "submitted" && lastMessageIsUser && <Loader />}
        {status === "error" && <ErrorMessage />}
        <div ref={messagesEndRef} />
      </div>

      <form className="flex gap-2 border-t p-4" onSubmit={onSubmit}>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your notes..."
          className="max-h-[120px] min-h-[40px] resize-none overflow-y-auto"
          maxLength={1000}
          autoFocus
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isProcessing}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

interface ChatMessageProps {
  message: UIMessage;
}

function ChatMessage({ message }: ChatMessageProps) {
  const currentStep = message.parts[message.parts.length - 1];

  return (
    <div
      className={cn(
        "mb-2 flex max-w-[85%] flex-col prose dark:prose-invert",
        message.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div
        className={cn(
          "prose dark:prose-invert rounded-xl px-3.5 py-2.5 text-sm",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted first:prose-p:mt-0"
        )}
      >
        {message.role === "assistant" && (
          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
            <Sparkles className="text-primary size-3" />
            Assistant
          </div>
        )}
        {currentStep?.type === "text" && (
          <Markdown>{currentStep.text}</Markdown>
        )}
        {currentStep.type === "tool-invocation" && (
          <ThinkingShimmer label="Searching notes" />
        )}
      </div>
    </div>
  );
}

function Loader() {
  return <ThinkingShimmer />;
}

function ThinkingShimmer({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="mr-auto flex max-w-[85%] flex-col items-start">
      <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm">
        <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
          <Sparkles className="text-primary size-3" />
          Assistant
        </div>
        <Shimmer as="span" className="text-sm font-medium" duration={1.5}>
          {label}
        </Shimmer>
      </div>
    </div>
  );
}

function ErrorMessage() {
  return (
    <div className="text-destructive text-sm">
      Something went wrong. Please try again.
    </div>
  );
}
