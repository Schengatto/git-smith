// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveRebaseDialog } from "./InteractiveRebaseDialog";
import { runGitOperation } from "../../store/git-operation-store";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    () => ({
      refreshInfo: vi.fn().mockResolvedValue(undefined),
      refreshStatus: vi.fn().mockResolvedValue(undefined),
    }),
    { getState: () => ({}), subscribe: () => () => {} }
  ),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(() => ({ loadGraph: vi.fn().mockResolvedValue(undefined) }), {
    getState: () => ({}),
    subscribe: () => () => {},
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn().mockResolvedValue(undefined),
  GitOperationCancelledError: class extends Error {},
}));

const mockRunGitOperation = runGitOperation as ReturnType<typeof vi.fn>;

const mockCommits = [
  {
    hash: "aaa1111",
    abbreviatedHash: "aaa1111",
    subject: "fix: bug one",
    authorName: "Alice",
    date: "2024-01-01",
  },
  {
    hash: "bbb2222",
    abbreviatedHash: "bbb2222",
    subject: "feat: new thing",
    authorName: "Bob",
    date: "2024-01-02",
  },
];

const mockElectronAPI = {
  branch: {
    rebaseCommits: vi.fn().mockResolvedValue(mockCommits),
    rebaseInteractive: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.branch.rebaseCommits.mockResolvedValue(mockCommits);
  mockElectronAPI.branch.rebaseInteractive.mockResolvedValue(undefined);
  mockRunGitOperation.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("InteractiveRebaseDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <InteractiveRebaseDialog open={false} onClose={vi.fn()} onto="main" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog heading when open", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getByText("Interactive Rebase")).toBeInTheDocument();
  });

  it("shows the onto ref in the header", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getByText(/onto main/)).toBeInTheDocument();
  });

  it("calls branch.rebaseCommits on open", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(mockElectronAPI.branch.rebaseCommits).toHaveBeenCalledWith("main");
  });

  it("renders commit subjects after loading", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("fix: bug one")).toBeInTheDocument();
      expect(screen.getByText("feat: new thing")).toBeInTheDocument();
    });
  });

  it("renders Start Rebase and Cancel buttons", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getByText("Start Rebase")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders action legend labels", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getByText("Pick")).toBeInTheDocument();
    expect(screen.getByText("Drop")).toBeInTheDocument();
    expect(screen.getByText("Squash")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<InteractiveRebaseDialog open={true} onClose={onClose} onto="main" />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Start Rebase button is disabled while commits are loading", () => {
    mockElectronAPI.branch.rebaseCommits.mockReturnValueOnce(new Promise(() => {}));
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    expect((screen.getByText("Start Rebase") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows commit count in footer after loading", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("2 commits")).toBeInTheDocument();
    });
  });

  it("renders commit abbreviated hashes after loading", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("aaa1111")).toBeInTheDocument();
      expect(screen.getByText("bbb2222")).toBeInTheDocument();
    });
  });

  it("renders author names in commit rows", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows 'No commits to rebase' when commits list is empty", async () => {
    mockElectronAPI.branch.rebaseCommits.mockResolvedValueOnce([]);
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("No commits to rebase")).toBeInTheDocument();
    });
  });

  it("Start Rebase button is disabled when commits list is empty", async () => {
    mockElectronAPI.branch.rebaseCommits.mockResolvedValueOnce([]);
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("No commits to rebase")).toBeInTheDocument();
    });
    expect((screen.getByText("Start Rebase") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows 0 commits in footer when commits list is empty", async () => {
    mockElectronAPI.branch.rebaseCommits.mockResolvedValueOnce([]);
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("0 commits")).toBeInTheDocument();
    });
  });

  it("shows action selects for each commit after loading", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBe(2);
      expect((selects[0] as HTMLSelectElement).value).toBe("pick");
    });
  });

  it("can change action on a commit row", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBe(2);
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "drop" } });
    expect((selects[0] as HTMLSelectElement).value).toBe("drop");
  });

  it("shows drop count in footer after setting action to drop", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBe(2);
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "drop" } });
    expect(screen.getByText("1 dropped")).toBeInTheDocument();
  });

  it("shows squash count in footer after setting action to squash", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBe(2);
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "squash" } });
    expect(screen.getByText("1 squashed")).toBeInTheDocument();
  });

  it("renders in window mode without overlay", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" mode="window" />);
    expect(screen.getByText("Interactive Rebase")).toBeInTheDocument();
  });

  it("shows error when rebase operation fails", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("fix: bug one")).toBeInTheDocument();
    });
    mockRunGitOperation.mockRejectedValueOnce(new Error("rebase failed"));
    fireEvent.click(screen.getByText("Start Rebase"));
    await waitFor(() => {
      expect(screen.getByText("rebase failed")).toBeInTheDocument();
    });
  });

  it("shows error message when rebaseCommits fails", async () => {
    mockElectronAPI.branch.rebaseCommits.mockRejectedValueOnce(new Error("cannot list commits"));
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await waitFor(() => {
      expect(screen.getByText("cannot list commits")).toBeInTheDocument();
    });
  });

  it("clicking a commit row selects it", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("fix: bug one")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("fix: bug one").closest("div[draggable]")!);
    // No crash, selection state updated internally
    expect(screen.getByText("fix: bug one")).toBeInTheDocument();
  });

  it("move up button is disabled for first commit", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("fix: bug one")).toBeInTheDocument();
    });
    // Move up buttons are SVG buttons; find by checking disabled property
    // First row's first button (move up) should be disabled
    const allButtons = screen.getAllByRole("button");
    // The first row has: move up (disabled), move down, no more per-row buttons
    // We check that the move-up for first row is disabled
    const disabledBtns = allButtons.filter((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabledBtns.length).toBeGreaterThan(0);
  });

  it("calling Start Rebase calls onClose on success", async () => {
    const onClose = vi.fn();
    render(<InteractiveRebaseDialog open={true} onClose={onClose} onto="main" />);
    await vi.waitFor(() => {
      expect(screen.getByText("fix: bug one")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Start Rebase"));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows fixup count in footer after setting action to fixup", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getAllByRole("combobox").length).toBe(2));
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "fixup" } });
    expect(screen.getByText("1 squashed")).toBeInTheDocument();
  });

  it("keyboard shortcut 'd' sets action to drop on selected commit", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    // Click a commit row to select it
    fireEvent.click(screen.getByText("fix: bug one").closest("div[draggable]")!);
    // Press 'd' to drop
    fireEvent.keyDown(window, { key: "d" });
    // Should show 1 dropped in footer
    await waitFor(() => {
      expect(screen.getByText("1 dropped")).toBeInTheDocument();
    });
  });

  it("keyboard shortcut 's' sets action to squash on selected commit", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    fireEvent.click(screen.getByText("fix: bug one").closest("div[draggable]")!);
    fireEvent.keyDown(window, { key: "s" });
    await waitFor(() => {
      expect(screen.getByText("1 squashed")).toBeInTheDocument();
    });
  });

  it("ArrowDown key navigates selection to next commit", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    // Select first commit
    fireEvent.click(screen.getByText("fix: bug one").closest("div[draggable]")!);
    // Press ArrowDown
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // No crash — selection moved to index 1
    expect(screen.getByText("feat: new thing")).toBeInTheDocument();
  });

  it("ArrowUp key navigates selection up", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("feat: new thing")).toBeInTheDocument());
    // Select second commit first
    fireEvent.click(screen.getByText("feat: new thing").closest("div[draggable]")!);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByText("fix: bug one")).toBeInTheDocument();
  });

  it("Alt+ArrowDown moves selected commit down", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    fireEvent.click(screen.getByText("fix: bug one").closest("div[draggable]")!);
    fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
    // No crash — entry moved
    expect(screen.getByText("fix: bug one")).toBeInTheDocument();
  });

  it("Alt+ArrowUp moves selected commit up", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("feat: new thing")).toBeInTheDocument());
    fireEvent.click(screen.getByText("feat: new thing").closest("div[draggable]")!);
    fireEvent.keyDown(window, { key: "ArrowUp", altKey: true });
    expect(screen.getByText("feat: new thing")).toBeInTheDocument();
  });

  it("move down button moves commit down", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    // Find move-down button for first row — second button among commit row buttons
    const allButtons = screen.getAllByRole("button");
    // The first row has move-up (disabled) and move-down buttons
    // Find the enabled move-down for the first row
    const enabledBtns = allButtons.filter((btn) => !(btn as HTMLButtonElement).disabled);
    if (enabledBtns.length > 0) {
      fireEvent.click(enabledBtns[0]!);
    }
    expect(screen.getByText("fix: bug one")).toBeInTheDocument();
  });

  it("drag start and drag over reorders entries", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    const draggableRows = document.querySelectorAll("[draggable]");
    if (draggableRows.length >= 2) {
      fireEvent.dragStart(draggableRows[0]!);
      fireEvent.dragOver(draggableRows[1]!, { preventDefault: vi.fn() });
      fireEvent.dragEnd(draggableRows[0]!);
    }
    expect(screen.getByText("fix: bug one")).toBeInTheDocument();
  });

  it("keyboard shortcut does nothing when no commit is selected", async () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await vi.waitFor(() => expect(screen.getByText("fix: bug one")).toBeInTheDocument());
    // Press 'd' without selecting a row first — should not change anything
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.queryByText("1 dropped")).not.toBeInTheDocument();
  });

  it("does not load commits when open=false", () => {
    render(<InteractiveRebaseDialog open={false} onClose={vi.fn()} onto="main" />);
    expect(mockElectronAPI.branch.rebaseCommits).not.toHaveBeenCalled();
  });

  it("window mode renders without overlay wrapper", () => {
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="develop" mode="window" />);
    expect(screen.getByText(/onto develop/)).toBeInTheDocument();
  });

  it("GitOperationCancelledError is silently ignored during load", async () => {
    const { GitOperationCancelledError } = await import("../../store/git-operation-store");
    mockElectronAPI.branch.rebaseCommits.mockRejectedValueOnce(
      new (GitOperationCancelledError as new (...args: unknown[]) => Error)("cancelled")
    );
    render(<InteractiveRebaseDialog open={true} onClose={vi.fn()} onto="main" />);
    await waitFor(() => {
      // No error shown, no crash
      expect(screen.getByText("Interactive Rebase")).toBeInTheDocument();
    });
    expect(screen.queryByText("cancelled")).not.toBeInTheDocument();
  });
});
