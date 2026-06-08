import { cn } from "@/lib/utils";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  className?: string;
  inverted?: boolean;
}

export default function Markdown({
  children,
  className,
  inverted = false,
}: MarkdownProps) {
  const linkClass = inverted
    ? "text-primary-foreground/90 hover:underline"
    : "text-primary hover:underline";

  return (
    <div
      className={cn(
        "prose prose-base max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-table:text-base prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
        inverted
          ? "prose-invert text-primary-foreground prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-li:text-primary-foreground prose-strong:text-primary-foreground prose-code:bg-white/15 prose-code:text-primary-foreground prose-pre:bg-black/20 prose-pre:text-primary-foreground prose-a:text-primary-foreground/90"
          : "dark:prose-invert prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const isInternalLink =
              href?.startsWith(process.env.NEXT_PUBLIC_BASE_URL!) ||
              href?.startsWith("/");
            if (isInternalLink) {
              return (
                <Link href={href || "#"} className={linkClass}>
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href || "#"}
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
