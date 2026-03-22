// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { ContextMenuEntry } from "./ContextMenu";
import { ContextMenu } from "./ContextMenu";

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const baseItems: ContextMenuEntry[] = [
  { label: "Copy", onClick: vi.fn() },
  { label: "Cut", onClick: vi.fn() },
  { divider: true },
  { label: "Paste", onClick: vi.fn() },
];

describe("ContextMenu", () => {
  it("renders all item labels", () => {
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={onClose} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Cut")).toBeInTheDocument();
    expect(screen.getByText("Paste")).toBeInTheDocument();
  });

  it("renders dividers between items", () => {
    const { container } = render(
      <ContextMenu x={100} y={100} items={baseItems} onClose={onClose} />
    );
    // divider is a div with height:1
    const dividers = container.querySelectorAll("div[style*='height: 1px']");
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClick and onClose when a menu item is clicked", () => {
    const clickHandler = vi.fn();
    const items: ContextMenuEntry[] = [{ label: "Action", onClick: clickHandler }];
    render(<ContextMenu x={50} y={50} items={items} onClose={onClose} />);
    fireEvent.click(screen.getByText("Action"));
    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside", () => {
    render(
      <div>
        <ContextMenu x={100} y={100} items={baseItems} onClose={onClose} />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick for disabled items", () => {
    const clickHandler = vi.fn();
    const items: ContextMenuEntry[] = [
      { label: "Disabled Action", onClick: clickHandler, disabled: true },
    ];
    render(<ContextMenu x={100} y={100} items={items} onClose={onClose} />);
    const btn = screen.getByText("Disabled Action").closest("button");
    expect(btn).toBeDisabled();
  });

  it("renders a sub-menu item with arrow indicator", () => {
    const items: ContextMenuEntry[] = [
      {
        label: "Parent",
        children: [{ label: "Child", onClick: vi.fn() }],
      },
    ];
    render(<ContextMenu x={100} y={100} items={items} onClose={onClose} />);
    expect(screen.getByText("Parent")).toBeInTheDocument();
    // Arrow is rendered as an SVG, not text — verify the parent button exists
    const parentBtn = screen.getByText("Parent").closest("button");
    expect(parentBtn).toBeInTheDocument();
    // The submenu container should contain an SVG chevron
    expect(parentBtn!.querySelector("svg")).toBeInTheDocument();
  });
});
