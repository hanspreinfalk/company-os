import { cn } from "@/lib/utils";

interface AvatarProps {
  className?: string;
  children: React.ReactNode;
}

export function Avatar({ className, children }: AvatarProps) {
  return (
    <div
      className={cn(
        "bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ring-border/50",
        className
      )}
    >
      {children}
    </div>
  );
}
