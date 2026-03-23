// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CommandPalette } from "./CommandPalette";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

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
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderOpen(onClose = vi.fn()) {
  return { ...render(<CommandPalette open={true} onClose={onClose} />), onClose };
}

function getInput() {
  return screen.getByPlaceholderText("commandPalette.placeholder");
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
    expect(screen.getByText("commandPalette.openRepo")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.cloneRepo")).toBeInTheDocument();
  });

  it("renders an ESC hint badge", () => {
    renderOpen();
    expect(screen.getByText("ESC")).toBeInTheDocument();
  });

  // ── Search filtering ─────────────────────────────────────────────────────────

  it("filters commands based on query", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "clone" } });
    expect(screen.getByText("commandPalette.cloneRepo")).toBeInTheDocument();
    expect(screen.queryByText("commandPalette.toggleTheme")).not.toBeInTheDocument();
  });

  it("shows 'No commands found' for unmatched query", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "xyznonexistent" } });
    expect(screen.getByText("commandPalette.noCommandsFound")).toBeInTheDocument();
  });

  it("resets filter to all commands when query is cleared", () => {
    renderOpen();
    const input = getInput();
    fireEvent.change(input, { target: { value: "clone" } });
    expect(screen.queryByText("commandPalette.toggleTheme")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("commandPalette.toggleTheme")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.cloneRepo")).toBeInTheDocument();
  });

  it("filters by category label too (e.g. 'repository' shows repo commands)", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "repository" } });
    // Commands in the "commandPalette.categoryRepository" category should match
    expect(screen.getByText("commandPalette.openRepo")).toBeInTheDocument();
  });

  it("is case-insensitive when filtering", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "CLONE" } });
    expect(screen.getByText("commandPalette.cloneRepo")).toBeInTheDocument();
  });

  it("multi-word query matches commands containing all words", () => {
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "open repo" } });
    expect(screen.getByText("commandPalette.openRepo")).toBeInTheDocument();
  });

  // ── Commands that require a repo are hidden when no repo ─────────────────────

  it("hides needsRepo commands when no repo is open", () => {
    mockHasRepo = false;
    renderOpen();
    // "commandPalette.closeRepo" requires a repo
    expect(screen.queryByText("commandPalette.closeRepo")).not.toBeInTheDocument();
    // "commandPalette.openRepo" does not require a repo
    expect(screen.getByText("commandPalette.openRepo")).toBeInTheDocument();
  });

  it("shows needsRepo commands when a repo is open", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.closeRepo")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.refresh")).toBeInTheDocument();
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
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    // Second button (index 1) should now have the accent-dim background
    expect(buttons[1]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowUp does not go below index 0", () => {
    renderOpen();
    const input = getInput();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    // Index 0 should still be selected
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowDown then ArrowUp returns to original item", () => {
    renderOpen();
    const input = getInput();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });

  it("ArrowDown does not exceed last item", () => {
    renderOpen();
    const input = getInput();
    // Press ArrowDown many times
    for (let i = 0; i < 100; i++) {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    }
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    // Last button should be selected
    const last = buttons[buttons.length - 1];
    expect(last).toHaveStyle("background: var(--accent-dim)");
  });

  it("Enter executes the selected command and calls onClose", () => {
    // Filter to only the "commandPalette.toggleTheme" command so it is index 0
    const { onClose } = renderOpen();
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // toggleTheme is called inside requestAnimationFrame — not synchronously
    // testable without fake timers, but onClose IS synchronous.
  });

  it("mouseEnter updates the selected index", () => {
    renderOpen();
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    // Hover over the third button
    fireEvent.mouseEnter(buttons[2]!);
    expect(buttons[2]).toHaveStyle("background: var(--accent-dim)");
  });

  it("clicking a command button calls onClose", () => {
    const { onClose } = renderOpen();
    // Filter to a unique label so we get exactly one button
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    const btn = screen.getByText("commandPalette.toggleTheme").closest("button")!;
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
    expect(screen.getAllByText("commandPalette.categoryRepository").length).toBeGreaterThan(0);
    expect(screen.getByText("commandPalette.openRepo")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.createNewRepo")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.cloneRepo")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.scanRepos")).toBeInTheDocument();
  });

  it("shows Git category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.fetch")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.fetchAll")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.fetchPrune")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.pull")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.pullRebase")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.pullMerge")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.push")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.stashChanges")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.stashPop")).toBeInTheDocument();
  });

  it("shows Dialogs category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.openCommitDialog")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.manageStashes")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.manageRemotes")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.searchCommits")).toBeInTheDocument();
  });

  it("shows Tools category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.staleBranches")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.gitignoreEditor")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.codeSearchGrep")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.branchDiffComparison")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.branchCommitRangeCompare")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.gitHooksManager")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.undoGitOps")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.cicdPipelineStatus")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.createGist")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.advancedStats")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.sshKeyManager")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.gitBisect")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.manageWorktrees")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.applyPatch")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.manageSubmodules")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.gitLfs")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.pullRequestsMergeRequests")).toBeInTheDocument();
  });

  it("shows Help category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.keyboardShortcuts")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.aboutGitSmith")).toBeInTheDocument();
  });

  it("shows Settings category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.openSettings")).toBeInTheDocument();
  });

  it("shows View category commands", () => {
    renderOpen();
    expect(screen.getByText("commandPalette.toggleTheme")).toBeInTheDocument();
  });

  // ── Dialog-opening actions ────────────────────────────────────────────────────
  // The component wraps each command action inside requestAnimationFrame.
  // We install fake timers BEFORE the click so we can flush the rAF queue.

  it("clicking 'Open Settings...' calls openDialogWindow with SettingsDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Open Settings" } });
    fireEvent.click(screen.getByText("commandPalette.openSettings").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenDialogWindow).toHaveBeenCalledWith({ dialog: "SettingsDialog" });
    vi.useRealTimers();
  });

  it("clicking 'Manage Stashes...' calls openDialogWindow with StashDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Manage Stashes" } });
    fireEvent.click(screen.getByText("commandPalette.manageStashes").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenDialogWindow).toHaveBeenCalledWith({ dialog: "StashDialog" });
    vi.useRealTimers();
  });

  it("clicking 'Clone Repository...' calls openCloneDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "clone" } });
    fireEvent.click(screen.getByText("commandPalette.cloneRepo").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenCloneDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Toggle Dark/Light Theme' calls toggleTheme", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "toggle theme" } });
    fireEvent.click(screen.getByText("commandPalette.toggleTheme").closest("button")!);
    vi.runAllTimers();
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'SSH Key Manager...' calls openSshDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "SSH Key" } });
    fireEvent.click(screen.getByText("commandPalette.sshKeyManager").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenSshDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Scan for Repositories...' calls openScanDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "scanRepos" } });
    fireEvent.click(screen.getByText("commandPalette.scanRepos").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenScanDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'About GitSmith' calls openAboutDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "About" } });
    fireEvent.click(screen.getByText("commandPalette.aboutGitSmith").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenAboutDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Open Repository...' calls openRepoDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Open Repository" } });
    fireEvent.click(screen.getByText("commandPalette.openRepo").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.openCommitDialog").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.searchCommits").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.gitBisect").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.manageWorktrees").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.applyPatch").closest("button")!);
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
    fireEvent.change(getInput(), { target: { value: "commandPalette.keyboardShortcuts" } });
    fireEvent.click(screen.getByText("commandPalette.keyboardShortcuts").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.manageSubmodules").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.gitLfs").closest("button")!);
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
      screen.getByText("commandPalette.pullRequestsMergeRequests").closest("button")!
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
    fireEvent.click(screen.getByText("commandPalette.gitReflog").closest("button")!);
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
    fireEvent.click(screen.getByText("commandPalette.manageRemotes").closest("button")!);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    window.removeEventListener("command-palette:open-remotes", listener);
  });

  it("clicking 'Close Repository' calls closeRepo", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "commandPalette.closeRepo" } });
    fireEvent.click(screen.getByText("commandPalette.closeRepo").closest("button")!);
    vi.runAllTimers();
    expect(mockCloseRepo).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Create New Repository...' calls initRepo", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Create New" } });
    fireEvent.click(screen.getByText("commandPalette.createNewRepo").closest("button")!);
    vi.runAllTimers();
    expect(mockInitRepo).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Stale Remote Branches...' calls openStaleBranchesDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Stale" } });
    fireEvent.click(screen.getByText("commandPalette.staleBranches").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenStaleBranchesDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking '.gitignore Editor...' calls openGitignoreDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "gitignore" } });
    fireEvent.click(screen.getByText("commandPalette.gitignoreEditor").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGitignoreDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Code Search (grep)...' calls openGrepDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Code Search" } });
    fireEvent.click(screen.getByText("commandPalette.codeSearchGrep").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGrepDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Branch Diff Comparison...' calls openBranchDiffDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Branch Diff" } });
    fireEvent.click(screen.getByText("commandPalette.branchDiffComparison").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenBranchDiffDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Branch Commit Range Compare...' calls openBranchCompareDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Branch Commit Range" } });
    fireEvent.click(screen.getByText("commandPalette.branchCommitRangeCompare").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenBranchCompareDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Git Hooks Manager...' calls openHooksDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Git Hooks" } });
    fireEvent.click(screen.getByText("commandPalette.gitHooksManager").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenHooksDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Undo Git Operations...' calls openUndoDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Undo Git" } });
    fireEvent.click(screen.getByText("commandPalette.undoGitOps").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenUndoDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'CI/CD Pipeline Status...' calls openCIStatusDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "cicdPipeline" } });
    fireEvent.click(screen.getByText("commandPalette.cicdPipelineStatus").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenCIStatusDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Create Gist...' calls openGistDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Create Gist" } });
    fireEvent.click(screen.getByText("commandPalette.createGist").closest("button")!);
    vi.runAllTimers();
    expect(mockOpenGistDialog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("clicking 'Advanced Statistics...' calls openAdvancedStatsDialog", () => {
    vi.useFakeTimers();
    renderOpen();
    fireEvent.change(getInput(), { target: { value: "Advanced Stat" } });
    fireEvent.click(screen.getByText("commandPalette.advancedStats").closest("button")!);
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
    const buttons = screen.getAllByRole("button").filter((b) => !b.textContent?.includes("ESC"));
    expect(buttons[0]).toHaveStyle("background: var(--accent-dim)");
  });
});
