"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * XSS-safe markdown renderer using react-markdown.
 * No dangerouslySetInnerHTML — react-markdown sanitizes by default.
 */
export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={`prose prose-slate prose-sm max-w-none break-words [overflow-wrap:anywhere] dark:prose-invert [&_code]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_pre_code]:whitespace-pre [&_table]:min-w-max ${className || ""}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
