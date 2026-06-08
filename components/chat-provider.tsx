"use client";

import { useChat } from "@ai-sdk/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
  /.cloud$/,
  ".site"
);

interface ChatContextValue {
  messages: ReturnType<typeof useChat>["messages"];
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  setMessages: ReturnType<typeof useChat>["setMessages"];
  status: ReturnType<typeof useChat>["status"];
  isProcessing: boolean;
  hasConversation: boolean;
  clearChat: () => void;
  getMessageTimestamp: (messageId: string) => number | undefined;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const token = useAuthToken();

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

  const [messageTimestamps, setMessageTimestamps] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    setMessageTimestamps((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const message of messages) {
        if (!next[message.id]) {
          next[message.id] = Date.now();
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [messages]);

  const isProcessing = status === "submitted" || status === "streaming";
  const hasConversation = messages.some((m) => m.role === "user");

  const clearChat = useCallback(() => {
    setMessages([]);
    setMessageTimestamps({});
  }, [setMessages]);

  const getMessageTimestamp = useCallback(
    (messageId: string) => messageTimestamps[messageId],
    [messageTimestamps]
  );

  const value = useMemo(
    () => ({
      messages,
      sendMessage,
      setMessages,
      status,
      isProcessing,
      hasConversation,
      clearChat,
      getMessageTimestamp,
    }),
    [
      messages,
      sendMessage,
      setMessages,
      status,
      isProcessing,
      hasConversation,
      clearChat,
      getMessageTimestamp,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}
