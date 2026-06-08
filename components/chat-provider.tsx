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
  useRef,
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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${convexSiteUrl}/api/chat`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [token]
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
    maxSteps: 10,
  });

  const [messageTimestamps, setMessageTimestamps] = useState<
    Record<string, number>
  >({});
  const trackedMessageIds = useRef(new Set<string>());

  useEffect(() => {
    const newTimestamps: Record<string, number> = {};

    for (const message of messages) {
      if (!trackedMessageIds.current.has(message.id)) {
        trackedMessageIds.current.add(message.id);
        newTimestamps[message.id] = Date.now();
      }
    }

    if (Object.keys(newTimestamps).length > 0) {
      setMessageTimestamps((prev) => ({ ...prev, ...newTimestamps }));
    }
  }, [messages]);

  const isProcessing = status === "submitted" || status === "streaming";
  const hasConversation = messages.some((m) => m.role === "user");

  const clearChat = useCallback(() => {
    setMessages([]);
    setMessageTimestamps({});
    trackedMessageIds.current.clear();
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
