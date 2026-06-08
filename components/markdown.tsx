import { cn } from "@/lib/utils";
import Link from "next/link";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  className?: string;
  inverted?: boolean;
}

function Markdown({
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
        "prose prose-base max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-table:text-base prose-table:my-4 prose-table:w-full prose-table:border-collapse prose-thead:border-0 prose-th:border-0 prose-td:border-0",
        inverted
          ? "prose-invert text-primary-foreground prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-li:text-primary-foreground prose-strong:text-primary-foreground prose-code:bg-white/15 prose-code:text-primary-foreground prose-pre:bg-black/20 prose-pre:text-primary-foreground prose-a:text-primary-foreground/90"
          : "dark:prose-invert prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <table className="w-full border-collapse">{children}</table>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => (
            <tbody className="[&_tr]:border-border/40 [&_tr]:border-b [&_tr:first-child]:border-t [&_tr:last-child]:border-b-0">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="text-muted-foreground border-0 py-0 pb-2 pr-6 text-left align-top text-sm font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2.5 pr-6 align-top">{children}</td>
          ),
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

export default memo(Markdown);
