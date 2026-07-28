"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/toast/ToastProvider";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

type FormatAction = "bold" | "italic" | "link" | "code" | "unordered-list" | "ordered-list" | "heading";

const FORMAT_CONFIG: Record<FormatAction, { label: string; icon: string; prefix: string; suffix: string; placeholder?: string }> = {
  bold: {
    label: "Bold",
    icon: "B",
    prefix: "**",
    suffix: "**",
    placeholder: "bold text",
  },
  italic: {
    label: "Italic",
    icon: "I",
    prefix: "*",
    suffix: "*",
    placeholder: "italic text",
  },
  link: {
    label: "Link",
    icon: "🔗",
    prefix: "[",
    suffix: "](url)",
    placeholder: "link text",
  },
  code: {
    label: "Code",
    icon: "<>",
    prefix: "`",
    suffix: "`",
    placeholder: "code",
  },
  "unordered-list": {
    label: "Bullet List",
    icon: "•",
    prefix: "\n- ",
    suffix: "",
  },
  "ordered-list": {
    label: "Numbered List",
    icon: "1.",
    prefix: "\n1. ",
    suffix: "",
  },
  heading: {
    label: "Heading",
    icon: "H",
    prefix: "\n## ",
    suffix: "",
    placeholder: "heading",
  },
};

export default function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyFormat = useCallback(
    (action: FormatAction) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const config = FORMAT_CONFIG[action];
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selectedText = value.substring(start, end);
      const placeholder = config.placeholder || "";

      let newText: string;
      let cursorPos: number;

      if (selectedText) {
        // Wrap selected text
        newText = value.substring(0, start) + config.prefix + selectedText + config.suffix + value.substring(end);
        cursorPos = start + config.prefix.length + selectedText.length + config.suffix.length;
      } else {
        // Insert placeholder
        newText = value.substring(0, start) + config.prefix + placeholder + config.suffix + value.substring(end);
        cursorPos = start + config.prefix.length + placeholder.length + config.suffix.length;
      }

      onChange(newText);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [textareaRef, value, onChange]
  );

  const handleImagePaste = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB.");
        return;
      }

      toast.success("Uploading image...");

      try {
        // Try upload via API if available
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/v1/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = (await response.json()) as { url: string };
          const imageMarkdown = `\n![image](${data.url})\n`;
          insertAtCursor(imageMarkdown);
          toast.success("Image uploaded.");
        } else {
          // Fallback: convert to base64 data URL
          await insertImageAsBase64(file);
        }
      } catch {
        // Fallback: convert to base64 data URL
        await insertImageAsBase64(file);
      }
    },
    [toast]
  );

  const insertImageAsBase64 = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const imageMarkdown = `\n![image](${dataUrl})\n`;
        insertAtCursor(imageMarkdown);
        toast.success("Image inserted.");
      };
      reader.onerror = () => {
        toast.error("Failed to read image.");
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const newText = value.substring(0, start) + text + value.substring(ta.selectionEnd);
      onChange(newText);

      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [textareaRef, value, onChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImagePaste(file);
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [handleImagePaste]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        handleImagePaste(file);
      }
    },
    [handleImagePaste]
  );

  const charCount = value.length;
  const charLimit = 10000;
  const isNearLimit = charCount > charLimit * 0.9;
  const isOverLimit = charCount > charLimit;

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/50">
        {/* Format buttons */}
        <button
          type="button"
          onClick={() => applyFormat("bold")}
          title="Bold (Ctrl+B)"
          className="rounded px-2 py-1 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          title="Italic (Ctrl+I)"
          className="rounded px-2 py-1 text-sm italic text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => applyFormat("link")}
          title="Link"
          className="rounded px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => applyFormat("code")}
          title="Inline Code"
          className="rounded px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          {`<>`}
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          onClick={() => applyFormat("heading")}
          title="Heading"
          className="rounded px-2 py-1 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => applyFormat("unordered-list")}
          title="Bullet List"
          className="rounded px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          • list
        </button>
        <button
          type="button"
          onClick={() => applyFormat("ordered-list")}
          title="Numbered List"
          className="rounded px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          1. list
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
        {/* Image upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Insert Image"
          className="rounded px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          🖼️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
        {/* Hint text */}
        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
          <kbd className="rounded border border-slate-300 px-1 py-0.5 font-sans text-[10px] dark:border-slate-600">Ctrl+P</kbd> preview
        </span>
      </div>
      {/* Character counter */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              isOverLimit
                ? "font-medium text-red-500"
                : isNearLimit
                  ? "text-amber-500"
                  : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {charCount.toLocaleString()}
            {charLimit ? ` / ${charLimit.toLocaleString()}` : ""}
          </span>
          {isOverLimit && <span className="text-xs font-medium text-red-500">Character limit exceeded</span>}
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          Paste or drag & drop images
        </span>
      </div>
    </>
  );
}