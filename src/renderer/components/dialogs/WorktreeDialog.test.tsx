// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { WorktreeDialog } from "./WorktreeDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "worktree.title": "Worktrees",
        "worktree.loading": "Loading...",
        "worktree.noWorktreesFound": "No worktrees found",
        "worktree.detached": "(detached)",
        "worktree.open": "Open",
        "worktree.remove": "Remove",
        "worktree.openInFileManager": "Open in file manager",
        "worktree.removeWorktree": "Remove worktree",
        "worktree.path": "Path",
        "worktree.pathPlaceholder": "/path/to/worktree",
        "worktree.branch": "Branch",
        "worktree.branchPlaceholder": "branch-name (optional)",
        "worktree.createNewBranch": "Create new branch",
        "worktree.pathRequired": "Path is required",
        "worktree.selectWorktreePath": "Select worktree path",
        "worktree.addWorktreeButton": "+ Add Worktree",
        "dialogs.close": "Close",
        "dialogs.cancel": "Cancel",
        "dialogs.add": "Add",
        "dialogs.browse": "Browse",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

const mockElectronAPI = {
  worktree: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  repo: {
    browseDirectory: vi.fn().mockResolvedValue(null),
  },
  shell: {
    showInFolder: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("WorktreeDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<WorktreeDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Worktrees")).toBeInTheDocument();
  });

  it("shows empty state when no worktrees exist", async () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/no worktrees found/i)).toBeInTheDocument();
    });
  });

  it("calls worktree.list on open", async () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.worktree.list).toHaveBeenCalled();
    });
  });

  it("renders worktrees when list returns data", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      {
        path: "/home/user/project",
        branch: "main",
        head: "abc1234def5",
        isMain: true,
      },
      {
        path: "/home/user/project-feature",
        branch: "feature/my-feature",
        head: "bcd2345efa6",
        isMain: false,
      },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(
      () => {
        expect(screen.getByText("feature/my-feature")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("shows Open button for each worktree", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234", isMain: true },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^open$/i })).toBeInTheDocument();
    });
  });

  it("shows Remove button only for non-main worktrees", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234", isMain: true },
      { path: "/home/user/feature", branch: "feature/x", head: "bcd2345", isMain: false },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      expect(removeButtons).toHaveLength(1);
    });
  });

  it("calls shell.showInFolder when Open button is clicked", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234", isMain: true },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /^open$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^open$/i }));
    expect(mockElectronAPI.shell.showInFolder).toHaveBeenCalledWith("/home/user/project");
  });

  it("shows Add Worktree button", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add worktree/i })).toBeInTheDocument();
  });

  it("shows add form when Add Worktree is clicked", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    expect(screen.getByPlaceholderText(/path\/to\/worktree/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/branch-name \(optional\)/i)).toBeInTheDocument();
  });

  it("shows Create new branch checkbox in add form", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    expect(screen.getByText(/create new branch/i)).toBeInTheDocument();
  });

  it("hides add form when Cancel is clicked", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByPlaceholderText(/path\/to\/worktree/i)).not.toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<WorktreeDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error when Add is clicked without a path", () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByText(/path is required/i)).toBeInTheDocument();
  });

  it("calls worktree.add with path and branch when Add is clicked with a path", async () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.change(screen.getByPlaceholderText(/path\/to\/worktree/i), {
      target: { value: "/home/user/new-worktree" },
    });
    fireEvent.change(screen.getByPlaceholderText(/branch-name \(optional\)/i), {
      target: { value: "feature/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      expect(mockElectronAPI.worktree.add).toHaveBeenCalledWith(
        "/home/user/new-worktree",
        "feature/new",
        false
      );
    });
  });

  it("passes createBranch=true when checkbox is checked", async () => {
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.change(screen.getByPlaceholderText(/path\/to\/worktree/i), {
      target: { value: "/home/user/new-worktree" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      expect(mockElectronAPI.worktree.add).toHaveBeenCalledWith(
        "/home/user/new-worktree",
        undefined,
        true
      );
    });
  });

  it("calls browseDirectory when Browse is clicked in add form", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/chosen/path");
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await waitFor(() => {
      expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalledWith("Select worktree path");
    });
    expect(screen.getByDisplayValue("/chosen/path")).toBeInTheDocument();
  });

  it("calls worktree.remove when Remove is clicked", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234", isMain: true },
      { path: "/home/user/feature", branch: "feature/x", head: "bcd2345", isMain: false },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => {
      expect(mockElectronAPI.worktree.remove).toHaveBeenCalledWith("/home/user/feature");
    });
  });

  it("shows error when worktree.remove fails", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/feature", branch: "feature/x", head: "bcd2345", isMain: false },
    ]);
    mockElectronAPI.worktree.remove.mockRejectedValue(new Error("Worktree is dirty"));
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => {
      expect(screen.getByText("Worktree is dirty")).toBeInTheDocument();
    });
  });

  it("shows error when worktree.add fails", async () => {
    mockElectronAPI.worktree.add.mockRejectedValue(new Error("Already exists"));
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.change(screen.getByPlaceholderText(/path\/to\/worktree/i), {
      target: { value: "/home/user/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      expect(screen.getByText("Already exists")).toBeInTheDocument();
    });
  });

  it("shows 'main' badge for the main worktree", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234", isMain: true },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("main", { selector: "span" })).toBeInTheDocument();
    });
  });

  it("shows abbreviated HEAD hash for each worktree", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/project", branch: "main", head: "abc1234def5", isMain: true },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("abc1234")).toBeInTheDocument();
    });
  });

  it("shows '(detached)' for worktrees with no branch", async () => {
    mockElectronAPI.worktree.list.mockResolvedValue([
      { path: "/home/user/detached", branch: null, head: "abc1234def5", isMain: false },
    ]);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("(detached)")).toBeInTheDocument();
    });
  });

  it("hides add form after successful add", async () => {
    // worktree.list must resolve so refresh() completes and setShowAdd(false) takes effect
    mockElectronAPI.worktree.list.mockResolvedValue([]);
    mockElectronAPI.worktree.add.mockResolvedValue(undefined);
    render(<WorktreeDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.click(screen.getByRole("button", { name: /add worktree/i }));
    fireEvent.change(screen.getByPlaceholderText(/path\/to\/worktree/i), {
      target: { value: "/home/user/new-worktree" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/path\/to\/worktree/i)).not.toBeInTheDocument();
    });
  });
});
