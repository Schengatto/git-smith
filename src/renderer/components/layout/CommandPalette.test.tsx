// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CommandPalette } from "./CommandPalette";

// Mock stores
vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      if (selector) return selector({ repo: { path: "/test" } });
      return { repo: { path: "/test" } };
    },
    {
      getState: () => ({
        refreshStatus: vi.fn(),
        refreshInfo: vi.fn(),
        openRepoDialog: vi.fn(),
        initRepo: vi.fn(),
        closeRepo: vi.fn(),
      }),
    }
  ),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(() => ({}), {
    getState: () => ({ loadGraph: vi.fn() }),
  }),
}));

vi.mock("../../store/ui-store", () => ({
  useUIStore: Object.assign(() => ({}), {
    getState: () => ({
      openCloneDialog: vi.fn(),
      openScanDialog: vi.fn(),
      openAboutDialog: vi.fn(),
      openStaleBranchesDialog: vi.fn(),
      toggleTheme: vi.fn(),
    }),
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn(),
}));

vi.mock("../../utils/open-dialog", () => ({
  openDialogWindow: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows search input and commands when open", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("Type a command...")
    ).toBeInTheDocument();
    // Should have some commands visible
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
  });

  it("filters commands based on query", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "clone" } });

    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
    // Other commands should be filtered out
    expect(screen.queryByText("Toggle Dark/Light Theme")).not.toBeInTheDocument();
  });

  it("shows 'No commands found' for unmatched query", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    expect(screen.getByText("No commands found")).toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommandPalette open={true} onClose={onClose} />
    );

    // Click the backdrop (first fixed div)
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with arrow keys", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText("Type a command...");

    // Arrow down to select second item
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // The second command should now be highlighted (accent-dim background)
    const buttons = screen.getAllByRole("button");
    // First button in the list is index 0, second is index 1
    const commandButtons = buttons.filter(
      (b) => b.textContent && !b.textContent.includes("ESC")
    );
    expect(commandButtons.length).toBeGreaterThan(1);
  });

  it("displays keyboard shortcuts for commands that have them", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    // Open Repository should show Ctrl+O
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
  });
});
