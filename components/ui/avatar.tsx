import { cn } from "@/lib/utils";

interface AvatarProps {
  className?: string;
  children: React.ReactNode;
}

export function Avatar({ className, children }: AvatarProps) {
  return (
    <div
      className={cn(
        "bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        className
      )}
    >
      {children}
    </div>
  );
}
