import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumb({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-muted-foreground flex items-center gap-1 text-base", className)}
    >
      {children}
    </nav>
  );
}

export function BreadcrumbItem({
  className,
  children,
  href,
  active,
}: {
  className?: string;
  children: React.ReactNode;
  href?: string;
  active?: boolean;
}) {
  if (href && !active) {
    return (
      <Link
        href={href}
        className={cn(
          "hover:text-foreground transition-colors",
          className
        )}
      >
        {children}
      </Link>
    );
  }

  return (
    <span
      className={cn(
        active ? "text-foreground font-medium" : undefined,
        className
      )}
    >
      {children}
    </span>
  );
}

export function BreadcrumbSeparator() {
  return <ChevronRight className="size-3.5 opacity-50" />;
}
