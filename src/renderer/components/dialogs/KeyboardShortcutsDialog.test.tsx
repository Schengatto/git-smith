// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

describe("KeyboardShortcutsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<KeyboardShortcutsDialog open={false} onClose={vi.fn()} />);
    expect(container.querySelector("[class*='modal']")).toBeNull();
  });

  it("shows shortcuts when open", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Command Palette")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Shift+P")).toBeInTheDocument();
  });

  it("filters shortcuts by search", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText("Filter shortcuts...");
    fireEvent.change(input, { target: { value: "commit" } });
    expect(screen.getByText("Commit (in commit dialog)")).toBeInTheDocument();
    expect(screen.queryByText("Command Palette")).not.toBeInTheDocument();
  });

  it("shows empty state when filter matches nothing", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText("Filter shortcuts...");
    fireEvent.change(input, { target: { value: "zzzznonexistent" } });
    expect(screen.getByText("No shortcuts match your filter")).toBeInTheDocument();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
