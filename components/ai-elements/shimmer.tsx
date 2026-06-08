"use client";

import { cn } from "@/lib/utils";
import type { ElementType } from "react";
import { createElement, memo } from "react";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
}: TextShimmerProps) => {
  return createElement(
    Component,
    {
      className: cn(
        "not-prose inline-block bg-[length:250%_100%] bg-clip-text [-webkit-background-clip:text] text-transparent",
        "bg-gradient-to-r from-muted-foreground from-30% via-foreground via-50% to-muted-foreground to-70%",
        className
      ),
      style: {
        animation: `text-shimmer ${duration}s linear infinite`,
      },
    },
    children
  );
};

export const Shimmer = memo(ShimmerComponent);
