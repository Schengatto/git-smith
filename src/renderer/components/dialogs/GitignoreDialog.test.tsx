// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { GitignoreDialog } from "./GitignoreDialog";

const mockElectronAPI = {
  gitignore: {
    read: vi.fn().mockResolvedValue("node_modules/\ndist/\n"),
    write: vi.fn().mockResolvedValue(undefined),
    templates: vi.fn().mockResolvedValue([
      { name: "Node", patterns: ["node_modules/", "npm-debug.log"] },
      { name: "Python", patterns: ["__pycache__/", "*.pyc"] },
    ]),
    preview: vi.fn().mockResolvedValue(["node_modules/lodash", "dist/index.js"]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("GitignoreDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<GitignoreDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(".gitignore Editor")).toBeInTheDocument();
  });

  it("shows Editor and Ignored Files tabs", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^editor$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ignored files/i })).toBeInTheDocument();
  });

  it("loads and shows gitignore content in the textarea", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    await waitFor(
      () => {
        // There are two textboxes: pattern input and main editor textarea
        const textboxes = screen.getAllByRole("textbox");
        const editorTextarea = textboxes.find((el) =>
          (el as HTMLTextAreaElement).value.includes("node_modules/")
        );
        expect(editorTextarea).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it("shows template buttons from loaded templates", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Node" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Python" })).toBeInTheDocument();
    });
  });

  it("shows Add pattern input with placeholder", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/add pattern/i)).toBeInTheDocument();
  });

  it("Add button is disabled when pattern input is empty", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
  });

  it("Add button becomes enabled when pattern is typed", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/add pattern/i);
    fireEvent.change(input, { target: { value: "*.log" } });
    expect(screen.getByRole("button", { name: /^add$/i })).not.toBeDisabled();
  });

  it("appends the pattern to textarea content when Add is clicked", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByRole("textbox"), { timeout: 3000 });
    const input = screen.getByPlaceholderText(/add pattern/i);
    fireEvent.change(input, { target: { value: "*.log" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    const textboxes = screen.getAllByRole("textbox");
    const editorTextarea = textboxes[textboxes.length - 1] as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain("*.log");
  });

  it("Save button is disabled when content is not dirty", () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("Save button becomes enabled after typing in textarea", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByRole("textbox"), { timeout: 3000 });
    const textboxes = screen.getAllByRole("textbox");
    const editorTextarea = textboxes[textboxes.length - 1]!;
    fireEvent.change(editorTextarea, { target: { value: "node_modules/\n*.tmp\n" } });
    expect(screen.getByRole("button", { name: /^save$/i })).not.toBeDisabled();
  });

  it("calls gitignore.write when Save is clicked", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByRole("textbox"), { timeout: 3000 });
    const textboxes = screen.getAllByRole("textbox");
    const editorTextarea = textboxes[textboxes.length - 1]!;
    fireEvent.change(editorTextarea, { target: { value: "*.log\n" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockElectronAPI.gitignore.write).toHaveBeenCalledWith("*.log\n");
    });
  });

  it("shows ignored files preview when Ignored Files tab is clicked", async () => {
    render(<GitignoreDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /ignored files/i }));
    await waitFor(() => {
      expect(screen.getByText("node_modules/lodash")).toBeInTheDocument();
      expect(screen.getByText("dist/index.js")).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<GitignoreDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
