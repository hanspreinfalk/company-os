import { Metadata } from "next";
import { ChatInterface } from "@/components/chat-interface";

export const metadata: Metadata = {
  title: "Chat",
  description: "AI assistant for your notes.",
};

export default function Page() {
  return <ChatInterface />;
}
