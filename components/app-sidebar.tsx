"use client";

import { CompanyLogo } from "@/components/company-logo";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { COMPANY_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronDown,
  FileText,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/app/(main)/sign-out-button";

const navItems = [
  { label: "Team Members", href: "#", icon: Users, disabled: true },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Automations", href: "#", icon: Workflow, disabled: true },
  { label: "Observability", href: "#", icon: Activity, disabled: true },
];

interface AppSidebarProps {
  collapsed?: boolean;
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border flex h-full shrink-0 flex-col border-r transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <CompanyLogo size="sm" />
        {!collapsed && (
          <button
            type="button"
            className="hover:bg-sidebar-accent flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors"
          >
            <span
              className="truncate text-sm font-medium"
              title={COMPANY_NAME}
            >
              {COMPANY_NAME}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </button>
        )}
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {!collapsed && (
          <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.label}
                className={cn(
                  "text-muted-foreground/60 flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  collapsed && "justify-center px-2"
                )}
                title={item.label}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={item.label}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-3">
        <div
          className={cn(
            "hover:bg-sidebar-accent flex items-center gap-2.5 rounded-lg p-2 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <Avatar>H</Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Team Member</p>
              <p className="text-muted-foreground truncate text-xs">
                member@deployment.co
              </p>
            </div>
          )}
          {!collapsed && <SignOutButton />}
        </div>
      </div>
    </aside>
  );
}
