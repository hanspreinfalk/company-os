"use client";

import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatContext } from "@/components/chat-provider";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Check,
  FileText,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Settings,
  Sun,
  Trash2,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const navItems = [
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Automations", href: "/automations", icon: Workflow },
] as const;

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const { signOut } = useAuthActions();
  const { clearChat, hasConversation, isProcessing } = useChatContext();
  const isChat =
    pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <header className="bg-background/90 sticky top-0 z-10 border-b border-border/50 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/chat" className="flex items-center gap-2.5">
          <CompanyLogo size="sm" />
          <span
            className="hidden max-w-[12rem] truncate text-base font-medium md:inline lg:max-w-xs xl:max-w-md"
            title={APP_NAME}
          >
            {APP_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {isChat && hasConversation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground gap-1.5"
              disabled={isProcessing}
            >
              <Trash2 className="size-3.5" />
              Clear chat
            </Button>
          )}

          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Pages</DropdownMenuLabel>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex cursor-pointer items-center gap-2",
                      isActive && "font-medium"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <Check className="size-3.5" />}
                  </Link>
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;

              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className="gap-2"
                >
                  <Icon className="size-3.5" />
                  <span className="flex-1">{option.label}</span>
                  {isActive && <Check className="size-3.5" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void signOut()}
              className="text-destructive focus:text-destructive gap-2"
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
