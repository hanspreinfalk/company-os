"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { AppNav } from "./app-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <AppNav />
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isChat
            ? "overflow-hidden"
            : "mx-auto w-full max-w-6xl overflow-y-auto px-6 py-8"
        )}
      >
        {children}
      </main>
    </div>
  );
}
