// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CommandPalette } from "./CommandPalette";

// vi.hoisted() runs before vi.mock() factories, so the returned values can be
// safely referenced inside factory closures without the TDZ hoisting problem.
const {
  mockRefreshStatus,
  mockRefreshInfo,
  mockOpenRepoDialog,
  mockInitRepo,
  mockCloseRepo,
  mockLoadGraph,
  mockOpenCloneDialog,
  mockOpenScanDialog,
  mockOpenAboutDialog,
  mockOpenStaleBranchesDialog,
  mockOpenGitignoreDialog,
  mockOpenGrepDialog,
  mockOpenBranchDiffDialog,
  mockOpenBranchCompareDialog,
  mockOpenHooksDialog,
  mockOpenUndoDialog,
  mockOpenCIStatusDialog,
  mockOpenGistDialog,
  mockOpenAdvancedStatsDialog,
  mockOpenSshDialog,
  mockToggleTheme,
  mockOpenDialogWindow,
} = vi.hoisted(() => ({
  mockRefreshStatus: vi.fn().mockResolvedValue(undefined),
  mockRefreshInfo: vi.fn().mockResolvedValue(undefined),
  mockOpenRepoDialog: vi.fn(),
  mockInitRepo: vi.fn(),
  mockCloseRepo: vi.fn(),
  mockLoadGraph: vi.fn().mockResolvedValue(undefined),
  mockOpenCloneDialog: vi.fn(),
  mockOpenScanDialog: vi.fn(),
  mockOpenAboutDialog: vi.fn(),
  mockOpenStaleBranchesDialog: vi.fn(),
  mockOpenGitignoreDialog: vi.fn(),
  mockOpenGrepDialog: vi.fn(),
  mockOpenBranchDiffDialog: vi.fn(),
  mockOpenBranchCompareDialog: vi.fn(),
  mockOpenHooksDialog: vi.fn(),
  mockOpenUndoDialog: vi.fn(),
  mockOpenCIStatusDialog: vi.fn(),
  mockOpenGistDialog: vi.fn(),
  mockOpenAdvancedStatsDialog: vi.fn(),
  mockOpenSshDialog: vi.fn(),
  mockToggleTheme: vi.fn(),
  mockOpenDialogWindow: vi.fn(),
}));

// Whether "hasRepo" is truthy — toggled in tests that need a repo context.
let mockHasRepo = true;

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { repo: mockHasRepo ? { path: "/test" } : null };
      if (selector) return selector(state);
      return state;
    },
    {
      getState: () => ({
        refreshStatus: mockRefreshStatus,
        refreshInfo: mockRefreshInfo,
        openRepoDialog: mockOpenRepoDialog,
        initRepo: mockInitRepo,
        closeRepo: mockCloseRepo,
      }),
    }
  ),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(() => ({}), {
    getState: () => ({ loadGraph: mockLoadGraph }),
  }),
}));

vi.mock("../../store/ui-store", () => ({
  useUIStore: Object.assign(() => ({}), {
    getState: () => ({
      openCloneDialog: mockOpenCloneDialog,
      openScanDialog: mockOpenScanDialog,
      openAboutDialog: mockOpenAboutDialog,
      openStaleBranchesDialog: mockOpenStaleBranchesDialog,
      openGitignoreDialog: mockOpenGitignoreDialog,
      openGrepDialog: mockOpenGrepDialog,
      openBranchDiffDialog: mockOpenBranchDiffDialog,
      openBranchCompareDialog: mockOpenBranchCompareDialog,
      openHooksDialog: mockOpenHooksDialog,
      openUndoDialog: mockOpenUndoDialog,
      openCIStatusDialog: mockOpenCIStatusDialog,
      openGistDialog: mockOpenGistDialog,
      openAdvancedStatsDialog: mockOpenAdvancedStatsDialog,
      openSshDialog: mockOpenSshDialog,
      toggleTheme: mockToggleTheme,
    }),
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/open-dialog", () => ({
  openDialogWindow: mockOpenDialogWindow,
}));

// Provide a minimal electronAPI shim so git action commands don't throw.
const mockElectronAPI = {
  remote: {
    fetch: vi.fn().mockResolvedValue(undefined),
    fetchAll: vi.fn().mockResolvedValue(undefined),
    fetchPrune: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    pullRebase: vi.fn().mockResolvedValue(undefined),
    pullMerge: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
  },
  stash: {
    create: vi.fn().mockResolvedValue(undefined),
    pop: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHasRepo = true;
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderOpen(onClose = vi.fn()) {
  return { ...render(<CommandPalette open={true} onClose={onClose} />), onClose };
}

function getInput() {
  return screen.getByPlaceholderText("Type a command...");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  // ── Visibility ──────────────────────────────────────────────────────────────

  it("renders nothing when closed", () => {
    const { container } = render(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows search input and commands when open", () => {
    renderOpen();
    expect(getInput()).toBeInTheDocument();
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
  });

  it("renders an ESC hint badge", () => {
    renderOpen();
    expect(screen.getByText("ESC")).toBeInTheDocument();
  });

  // ── Search filtering ─────────────────────────────────────────────────────────

  it("filters commands based on query", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "clone" } });
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
    expect(screen.queryByText("Toggle Dark/Light Theme")).not.toBeInTheDocument();
  });

  it("shows 'No commands found' for unmatched query", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "xyznonexistent" } });
    expect(screen.getByText("No commands found")).toBeInTheDocument();
  });

  it("resets filter to all commands when query is cleared", () => {
    renderOpen();
    const input = getInput();
    fireEvent.change(input, { target: { value: "clone" } });
    expect(screen.queryByText("Toggle Dark/Light Theme")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Toggle Dark/Light Theme")).toBeInTheDocument();
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
  });

  it("filters by category label too (e.g. 'repository' shows repo commands)", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "repository" } });
    // Commands in the "Repository" category should match
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
  });

  it("is case-insensitive when filtering", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "CLONE" } });
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
  });

  it("multi-word query matches commands containing all words", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "open repo" } });
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
  });

  // ── Commands that require a repo are hidden when no repo ─────────────────────

  it("hides needsRepo commands when no repo is open", () => {
    mockHasRepo = false;
    renderOpen();
    // "Close Repository" requires a repo
    expect(screen.queryByText("Close Repository")).not.toBeInTheDocument();
    // "Open Repository..." does not require a repo
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
  });

  it("shows needsRepo commands when a repo is open", () => {
    renderOpen();
    expect(screen.getByText("Close Repository")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  it("closes on Escape key", () => {
    const { onClose } = renderOpen();
    fireEvent.keyDown(getInput(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const { onClose, container } = renderOpen();
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the palette panel", () => {
    const { onClose } = renderOpen();
    // Click the input itself — should NOT close
    fireEvent.click(getInput());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ArrowDown moves selection to next item", () => {
    renderOpen();
    const input = getInput();
    // Initially index 0 is selected. After one ArrowDown, index 1 should be.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    // Second button (index 1) should now have the accent-dim background
    expect(buttons[1]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowUp does not go below index 0", () => {
    renderOpen();
    const input = getInput();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    // Index 0 should still be selected
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowDown then ArrowUp returns to original item", () => {
    renderOpen();
    const input = getInput();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowDown does not exceed last item", () => {
    renderOpen();
    const input = getInput();
    // Press ArrowDown many times
    for (let i = 0; i < 100; i++) {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    }
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    // Last button should be selected
    const last = buttons[buttons.length - 1];
    expect(last).toHaveStyle("background: var(--accent-dim)");
  });

  it("Enter executes the selected command and calls onClose", () => {
    // Filter to only the "Toggle Dark/Light Theme" command so it is index 0
    const { onClose } = renderOpen();
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // toggleTheme is called inside requestAnimationFrame — not synchronously
    // testable without fake timers, but onClose IS synchronous.
  });

  it("mouseEnter updates the selected index", () => {
    renderOpen();
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    // Hover over the third button
    fireEvent.mouseEnter(buttons[2]!);
    expect(buttons[2]).toHaveStyle("background: var(--accent-dim)");
  });

  it("clicking a command button calls onClose", () => {
    const { onClose } = renderOpen();
    // Filter to a unique label so we get exactly one button
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    const btn = screen.getByText("Toggle Dark/Light Theme").closest("button")!;
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Keyboard shortcuts displayed ──────────────────────────────────────────────

  it("displays Ctrl+O shortcut for Open Repository", () => {
    renderOpen();
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();
  });

  it("displays Ctrl+K shortcut for Open Commit Dialog", () => {
    renderOpen();
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
  });

  it("displays F5 shortcut for Refresh", () => {
    renderOpen();
    expect(screen.getByText("F5")).toBeInTheDocument();
  });

  it("displays Ctrl+Shift+F shortcut for Code Search", () => {
    renderOpen();
    expect(screen.getByText("Ctrl+Shift+F")).toBeInTheDocument();
  });

  it("displays Ctrl+, shortcut for Open Settings", () => {
    renderOpen();
    expect(screen.getByText("Ctrl+,")).toBeInTheDocument();
  });

  it("displays ? shortcut for Keyboard Shortcuts", () => {
    renderOpen();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  // ── Command categories present ────────────────────────────────────────────────

  it("shows Repository category commands", () => {
    renderOpen();
    // All Repository commands (category labels shown next to items)
    expect(screen.getAllByText("Repository").length).toBeGreaterThan(0);
    expect(screen.getByText("Open Repository...")).toBeInTheDocument();
    expect(screen.getByText("Create New Repository...")).toBeInTheDocument();
    expect(screen.getByText("Clone Repository...")).toBeInTheDocument();
    expect(screen.getByText("Scan for Repositories...")).toBeInTheDocument();
  });

  it("shows Git category commands", () => {
    renderOpen();
    expect(screen.getByText("Fetch")).toBeInTheDocument();
    expect(screen.getByText("Fetch All")).toBeInTheDocument();
    expect(screen.getByText("Fetch & Prune")).toBeInTheDocument();
    expect(screen.getByText("Pull")).toBeInTheDocument();
    expect(screen.getByText("Pull (Rebase)")).toBeInTheDocument();
    expect(screen.getByText("Pull (Merge)")).toBeInTheDocument();
    expect(screen.getByText("Push")).toBeInTheDocument();
    expect(screen.getByText("Stash Changes")).toBeInTheDocument();
    expect(screen.getByText("Stash Pop")).toBeInTheDocument();
  });

  it("shows Dialogs category commands", () => {
    renderOpen();
    expect(screen.getByText("Open Commit Dialog")).toBeInTheDocument();
    expect(screen.getByText("Manage Stashes...")).toBeInTheDocument();
    expect(screen.getByText("Manage Remotes...")).toBeInTheDocument();
    expect(screen.getByText("Search Commits...")).toBeInTheDocument();
  });

  it("shows Tools category commands", () => {
    renderOpen();
    expect(screen.getByText("Stale Remote Branches...")).toBeInTheDocument();
    expect(screen.getByText(".gitignore Editor...")).toBeInTheDocument();
    expect(screen.getByText("Code Search (grep)...")).toBeInTheDocument();
    expect(screen.getByText("Branch Diff Comparison...")).toBeInTheDocument();
    expect(screen.getByText("Branch Commit Range Compare...")).toBeInTheDocument();
    expect(screen.getByText("Git Hooks Manager...")).toBeInTheDocument();
    expect(screen.getByText("Undo Git Operations...")).toBeInTheDocument();
    expect(screen.getByText("CI/CD Pipeline Status...")).toBeInTheDocument();
    expect(screen.getByText("Create Gist...")).toBeInTheDocument();
    expect(screen.getByText("Advanced Statistics...")).toBeInTheDocument();
    expect(screen.getByText("SSH Key Manager...")).toBeInTheDocument();
    expect(screen.getByText("Git Bisect...")).toBeInTheDocument();
    expect(screen.getByText("Manage Worktrees...")).toBeInTheDocument();
    expect(screen.getByText("Apply Patch...")).toBeInTheDocument();
    expect(screen.getByText("Manage Submodules...")).toBeInTheDocument();
    expect(screen.getByText("Git LFS...")).toBeInTheDocument();
    expect(screen.getByText("Pull Requests / Merge Requests...")).toBeInTheDocument();
  });

  it("shows Help category commands", () => {
    renderOpen();
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("About Git Expansion")).toBeInTheDocument();
  });

  it("shows Settings category commands", () => {
    renderOpen();
    expect(screen.getByText("Open Settings...")).toBeInTheDocument();
  });

  it("shows View category commands", () => {
    renderOpen();
    expect(screen.getByText("Toggle Dark/Light Theme")).toBeInTheDocument();
  });

  // ── Dialog-opening actions ────────────────────────────────────────────────────
  // The component wraps each command action inside requestAnimationFrame.
  // We install fake timers BEFORE the click so we can flush the rAF queue.

  it("clicking 'Open Settings...' calls openDialogWindow with SettingsDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Open Settings" } });
    fireEvent.click(screen.getByText("Open Settings...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenDialogWindow).toHaveBeenCalledWith({ dialog: "SettingsDialog" });
    vi.useRealTimers();
  });

  it("clicking 'Manage Stashes...' calls openDialogWindow with StashDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Manage Stashes" } });
    fireEvent.click(screen.getByText("Manage Stashes...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenDialogWindow).toHaveBeenCalledWith({ dialog: "StashDialog" });
    vi.useRealTimers();
  });

  it("clicking 'Clone Repository...' calls openCloneDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "clone" } });
    fireEvent.click(screen.getByText("Clone Repository...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenCloneDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Toggle Dark/Light Theme' calls toggleTheme", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    fireEvent.click(screen.getByText("Toggle Dark/Light Theme").closest("button")!);
    vi.runAllTimers();
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'SSH Key Manager...' calls openSshDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "SSH Key" } });
    fireEvent.click(screen.getByText("SSH Key Manager...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenSshDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Scan for Repositories...' calls openScanDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Scan for" } });
    fireEvent.click(screen.getByText("Scan for Repositories...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenScanDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'About Git Expansion' calls openAboutDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "About" } });
    fireEvent.click(screen.getByText("About Git Expansion").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenAboutDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Open Repository...' calls openRepoDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Open Repository" } });
    fireEvent.click(screen.getByText("Open Repository...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenRepoDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // ── Custom events dispatched by palette actions ───────────────────────────────

  it("'Open Commit Dialog' dispatches command-palette:open-commit event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-commit", listener);
    fireEvent.change(getInput(), { target: { value: "Open Commit" } });
    fireEvent.click(screen.getByText("Open Commit Dialog").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-commit", listener);
  });

  it("'Search Commits...' dispatches command-palette:open-search event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-search", listener);
    fireEvent.change(getInput(), { target: { value: "Search Commits" } });
    fireEvent.click(screen.getByText("Search Commits...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-search", listener);
  });

  it("'Git Bisect...' dispatches command-palette:open-bisect event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-bisect", listener);
    fireEvent.change(getInput(), { target: { value: "bisect" } });
    fireEvent.click(screen.getByText("Git Bisect...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-bisect", listener);
  });

  it("'Manage Worktrees...' dispatches command-palette:open-worktrees event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-worktrees", listener);
    fireEvent.change(getInput(), { target: { value: "worktree" } });
    fireEvent.click(screen.getByText("Manage Worktrees...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-worktrees", listener);
  });

  it("'Apply Patch...' dispatches command-palette:open-patch-apply event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-patch-apply", listener);
    fireEvent.change(getInput(), { target: { value: "Apply Patch" } });
    fireEvent.click(screen.getByText("Apply Patch...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-patch-apply", listener);
  });

  it("'Keyboard Shortcuts' dispatches command-palette:open-shortcuts event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-shortcuts", listener);
    fireEvent.change(getInput(), { target: { value: "Keyboard Shortcuts" } });
    fireEvent.click(screen.getByText("Keyboard Shortcuts").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-shortcuts", listener);
  });

  it("'Manage Submodules...' dispatches command-palette:open-submodules event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-submodules", listener);
    fireEvent.change(getInput(), { target: { value: "submodule" } });
    fireEvent.click(screen.getByText("Manage Submodules...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-submodules", listener);
  });

  it("'Git LFS...' dispatches command-palette:open-lfs event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-lfs", listener);
    fireEvent.change(getInput(), { target: { value: "LFS" } });
    fireEvent.click(screen.getByText("Git LFS...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-lfs", listener);
  });

  it("'Pull Requests / Merge Requests...' dispatches command-palette:open-pr event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-pr", listener);
    fireEvent.change(getInput(), { target: { value: "Pull Requests" } });
    fireEvent.click(
      screen.getByText("Pull Requests / Merge Requests...").closest("button")!
    );
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-pr", listener);
  });

  it("'Git Reflog...' dispatches command-palette:open-reflog event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-reflog", listener);
    fireEvent.change(getInput(), { target: { value: "Reflog" } });
    fireEvent.click(screen.getByText("Git Reflog...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-reflog", listener);
  });

  it("'Manage Remotes...' dispatches command-palette:open-remotes event", () => {
    vi.useFakeTimers();
    renderOpen();
    const listener = vi.fn();
    window.addEventListener("command-palette:open-remotes", listener);
    fireEvent.change(getInput(), { target: { value: "Manage Remotes" } });
    fireEvent.click(screen.getByText("Manage Remotes...").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-remotes", listener);
  });

  it("clicking 'Close Repository' calls closeRepo", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Close Repository" } });
    fireEvent.click(screen.getByText("Close Repository").closest("button")!);
    vi.runAllTimers();
    expect(mockCloseRepo).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Create New Repository...' calls initRepo", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Create New" } });
    fireEvent.click(screen.getByText("Create New Repository...").closest("button")!);
    vi.runAllTimers();
    expect(mockInitRepo).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Stale Remote Branches...' calls openStaleBranchesDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Stale" } });
    fireEvent.click(screen.getByText("Stale Remote Branches...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenStaleBranchesDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking '.gitignore Editor...' calls openGitignoreDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "gitignore" } });
    fireEvent.click(screen.getByText(".gitignore Editor...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGitignoreDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Code Search (grep)...' calls openGrepDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Code Search" } });
    fireEvent.click(screen.getByText("Code Search (grep)...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGrepDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Branch Diff Comparison...' calls openBranchDiffDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Branch Diff" } });
    fireEvent.click(screen.getByText("Branch Diff Comparison...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenBranchDiffDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Branch Commit Range Compare...' calls openBranchCompareDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Branch Commit Range" } });
    fireEvent.click(
      screen.getByText("Branch Commit Range Compare...").closest("button")!
    );
    vi.runAllTimers();
    expect(mockOpenBranchCompareDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Git Hooks Manager...' calls openHooksDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Git Hooks" } });
    fireEvent.click(screen.getByText("Git Hooks Manager...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenHooksDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Undo Git Operations...' calls openUndoDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Undo Git" } });
    fireEvent.click(screen.getByText("Undo Git Operations...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenUndoDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'CI/CD Pipeline Status...' calls openCIStatusDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "CI/CD" } });
    fireEvent.click(screen.getByText("CI/CD Pipeline Status...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenCIStatusDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Create Gist...' calls openGistDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Create Gist" } });
    fireEvent.click(screen.getByText("Create Gist...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGistDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Advanced Statistics...' calls openAdvancedStatsDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Advanced Stat" } });
    fireEvent.click(screen.getByText("Advanced Statistics...").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenAdvancedStatsDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("Enter on empty filtered list does nothing and does not crash", () => {
    const { onClose } = renderOpen();
    fireEvent.change(getInput(), { target: { value: "xyznonexistent" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    // No crash, onClose not called since no command matched
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets query to empty string when palette is reopened", () => {
    const { rerender } = render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(getInput(), { target: { value: "fetch" } });
    rerender(<CommandPalette open={false} onClose={vi.fn()} />);
    rerender(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(getInput()).toHaveValue("");
  });

  it("resets selectedIndex to 0 when palette is reopened", () => {
    const { rerender } = render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.keyDown(getInput(), { key: "ArrowDown" });
    rerender(<CommandPalette open={false} onClose={vi.fn()} />);
    rerender(<CommandPalette open={true} onClose={vi.fn()} />);
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("ESC"));
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });
});
