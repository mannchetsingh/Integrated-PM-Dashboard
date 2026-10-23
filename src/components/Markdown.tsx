"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "@/lib/format";

/**
 * Renders model output and saved documents. Styling lives in `.prose` in
 * globals.css; memoised because chat re-renders this on every streamed chunk.
 */
export const Markdown = memo(function Markdown({
  children,
  className,
  compact = false,
}: {
  children: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx("prose", compact && "prose-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // External links shouldn't navigate the hub away from itself.
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
