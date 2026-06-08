import { cn } from "@/lib/utils";
import Image from "next/image";
import logo from "@/assets/logo.png";

interface CompanyLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-7",
  md: "size-8",
  lg: "size-14",
};

export function CompanyLogo({ className, size = "md" }: CompanyLogoProps) {
  return (
    <Image
      src={logo}
      alt="Company logo"
      width={size === "lg" ? 56 : size === "sm" ? 28 : 32}
      height={size === "lg" ? 56 : size === "sm" ? 28 : 32}
      className={cn("shrink-0 rounded-md", sizeClasses[size], className)}
    />
  );
}
