import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-7 text-sm",
  md: "size-8 text-base",
  lg: "size-14 text-2xl",
};

export function CompanyLogo({ className, size = "md" }: CompanyLogoProps) {
  return (
    <div
      className={cn(
        "bg-foreground text-background flex shrink-0 items-center justify-center rounded-md font-semibold",
        sizeClasses[size],
        className
      )}
    >
      D
    </div>
  );
}
