// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { DropdownEntry } from "./DropdownButton";
import { DropdownButton } from "./DropdownButton";

const items: DropdownEntry[] = [
  { label: "Option A", onClick: vi.fn() },
  { divider: true },
  { label: "Option B", sublabel: "With description", onClick: vi.fn() },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DropdownButton", () => {
  it("renders the button label", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    render(
      <DropdownButton icon={<span data-testid="icon">icon</span>} label="Actions" items={items} />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("does not show dropdown items initially", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("opens dropdown when button is clicked", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    fireEvent.click(screen.getByText("Actions"));
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("renders sublabel when provided", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    fireEvent.click(screen.getByText("Actions"));
    expect(screen.getByText("With description")).toBeInTheDocument();
  });

  it("calls item onClick and closes dropdown when item is clicked", () => {
    const clickHandler = vi.fn();
    const testItems: DropdownEntry[] = [{ label: "Do Something", onClick: clickHandler }];
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={testItems} />);
    fireEvent.click(screen.getByText("Actions"));
    fireEvent.click(screen.getByText("Do Something"));
    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Do Something")).not.toBeInTheDocument();
  });

  it("toggles dropdown closed on second button click", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    fireEvent.click(screen.getByText("Actions"));
    expect(screen.getByText("Option A")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Actions"));
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <DropdownButton icon={<span>icon</span>} label="Actions" items={items} />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.click(screen.getByText("Actions"));
    expect(screen.getByText("Option A")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("renders dividers between items", () => {
    render(<DropdownButton icon={<span>icon</span>} label="Actions" items={items} />);
    fireEvent.click(screen.getByText("Actions"));
    const { container } = render(
      <DropdownButton icon={<span>icon</span>} label="Actions" items={items} />
    );
    fireEvent.click(container.querySelector("button")!);
    const dividers = container.querySelectorAll("div[style*='height: 1px']");
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });
});
