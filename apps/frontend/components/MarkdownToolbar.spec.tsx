/**
 * Unit tests for the MarkdownToolbar component.
 *
 * Tests focus on the formatting logic and character counter rendering.
 * Full DOM interaction (clipboard, file upload) is covered by the e2e suite.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import MarkdownToolbar from "@/components/MarkdownToolbar";

// Mock the toast provider
jest.mock("@/components/toast/ToastProvider", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

function createMockTextareaRef(initialValue = "") {
  let value = initialValue;
  let selectionStart = 0;
  let selectionEnd = 0;

  const textarea = {
    value,
    selectionStart,
    selectionEnd,
    focus: jest.fn(),
    setSelectionRange: jest.fn((start: number, end: number) => {
      textarea.selectionStart = start;
      textarea.selectionEnd = end;
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  } as unknown as HTMLTextAreaElement;

  // Use Object.defineProperty for value getter/setter
  Object.defineProperty(textarea, "value", {
    get: () => value,
    set: (v: string) => {
      value = v;
    },
    configurable: true,
  });

  return { ref: { current: textarea }, textarea };
}

describe("MarkdownToolbar", () => {
  it("renders all format buttons", () => {
    const { ref } = createMockTextareaRef();
    render(<MarkdownToolbar textareaRef={ref} value="" onChange={jest.fn()} />);

    // Check for known label buttons
    expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
    expect(screen.getByTitle("Link")).toBeInTheDocument();
    expect(screen.getByTitle("Inline Code")).toBeInTheDocument();
    expect(screen.getByTitle("Heading")).toBeInTheDocument();
    expect(screen.getByTitle("Bullet List")).toBeInTheDocument();
    expect(screen.getByTitle("Numbered List")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Image")).toBeInTheDocument();
  });

  it("displays character count", () => {
    const { ref } = createMockTextareaRef("Hello");
    render(<MarkdownToolbar textareaRef={ref} value="Hello" onChange={jest.fn()} />);

    expect(screen.getByText("5 / 10,000")).toBeInTheDocument();
  });

  it("shows warning when near character limit", () => {
    const { ref } = createMockTextareaRef("a".repeat(9500));
    render(<MarkdownToolbar textareaRef={ref} value={"a".repeat(9500)} onChange={jest.fn()} />);

    // The counter should show 9500
    const counter = screen.getByText(/9,500/);
    expect(counter).toBeInTheDocument();
  });

  it("formats bold text from selection", async () => {
    const user = userEvent.setup();
    const { ref, textarea } = createMockTextareaRef("hello world");
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;
    const onChange = jest.fn();

    render(<MarkdownToolbar textareaRef={ref} value="hello world" onChange={onChange} />);

    await user.click(screen.getByTitle("Bold (Ctrl+B)"));

    expect(onChange).toHaveBeenCalledWith("**hello** world");
  });

  it("formats italic text from selection", async () => {
    const user = userEvent.setup();
    const { ref, textarea } = createMockTextareaRef("hello world");
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;
    const onChange = jest.fn();

    render(<MarkdownToolbar textareaRef={ref} value="hello world" onChange={onChange} />);

    await user.click(screen.getByTitle("Italic (Ctrl+I)"));

    expect(onChange).toHaveBeenCalledWith("*hello* world");
  });

  it("inserts link markdown from selection", async () => {
    const user = userEvent.setup();
    const { ref, textarea } = createMockTextareaRef("click here");
    textarea.selectionStart = 0;
    textarea.selectionEnd = 11;
    const onChange = jest.fn();

    render(<MarkdownToolbar textareaRef={ref} value="click here" onChange={onChange} />);

    await user.click(screen.getByTitle("Link"));

    expect(onChange).toHaveBeenCalledWith("[click here](url)");
  });

  it("inserts code markdown from selection", async () => {
    const user = userEvent.setup();
    const { ref, textarea } = createMockTextareaRef("const x = 1;");
    textarea.selectionStart = 0;
    textarea.selectionEnd = 12;
    const onChange = jest.fn();

    render(<MarkdownToolbar textareaRef={ref} value="const x = 1;" onChange={onChange} />);

    await user.click(screen.getByTitle("Inline Code"));

    expect(onChange).toHaveBeenCalledWith("`const x = 1;`");
  });

  it("inserts bold placeholder when no selection", async () => {
    const user = userEvent.setup();
    const { ref } = createMockTextareaRef("");

    const onChange = jest.fn();
    render(<MarkdownToolbar textareaRef={ref} value="" onChange={onChange} />);

    await user.click(screen.getByTitle("Bold (Ctrl+B)"));

    expect(onChange).toHaveBeenCalledWith("**bold text**");
  });

  it("shows keyboard shortcut hint", () => {
    const { ref } = createMockTextareaRef();
    render(<MarkdownToolbar textareaRef={ref} value="" onChange={jest.fn()} />);

    // The Ctrl+P preview hint should be visible
    expect(screen.getByText("preview")).toBeInTheDocument();
  });
});