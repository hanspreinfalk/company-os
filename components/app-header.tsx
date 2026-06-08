"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { COMPANY_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PanelLeft, Search } from "lucide-react";
import { ModeToggle } from "./mode-toggle";

interface AppHeaderProps {
  title?: string;
  section?: string;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export function AppHeader({
  title,
  section = "Notes",
  onToggleSidebar,
  sidebarCollapsed,
}: AppHeaderProps) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={onToggleSidebar}
          >
            <PanelLeft
              className={cn("size-4", sidebarCollapsed && "opacity-60")}
            />
            <span className="hidden sm:inline">Sidebar</span>
            <kbd className="bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ⌘B
            </kbd>
          </Button>
          <Breadcrumb>
            <BreadcrumbItem href="/notes">{section}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem active>{COMPANY_NAME}</BreadcrumbItem>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ⌘K
            </kbd>
          </Button>
          <ModeToggle />
        </div>
      </div>

      {title && (
        <div className="px-6 pb-4 pt-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
      )}
    </header>
  );
}
