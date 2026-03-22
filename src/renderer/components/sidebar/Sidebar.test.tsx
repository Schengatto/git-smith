// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { BranchInfo, StashEntry, TagInfo } from "../../../shared/git-types";

/* ---------- Hoisted mocks (safe to use inside vi.mock factories) ---------- */

const mocks = vi.hoisted(() => ({
  loadGraph: vi.fn(),
  showToast: vi.fn(),
  refreshStatus: vi.fn(),
  runGitOperation: vi.fn(),
  openDialogWindow: vi.fn(),
  // mutable repo reference
  repoState: { repo: null as Record<string, unknown> | null },
  // electronAPI stubs
  branchList: vi.fn(),
  tagList: vi.fn(),
  submoduleList: vi.fn(),
  stashList: vi.fn(),
  stashPop: vi.fn(),
  stashApply: vi.fn(),
  stashDrop: vi.fn(),
  tagPush: vi.fn(),
  tagDelete: vi.fn(),
  tagDeleteRemote: vi.fn(),
  submoduleUpdate: vi.fn(),
  submoduleSync: vi.fn(),
  branchDeleteRemote: vi.fn(),
}));

/* ---------- Store mocks ---------- */

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = {
        repo: mocks.repoState.repo,
        refreshStatus: mocks.refreshStatus,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        repo: mocks.repoState.repo,
        refreshStatus: mocks.refreshStatus,
      }),
      subscribe: () => () => {},
    }
  ),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { loadGraph: mocks.loadGraph };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ loadGraph: mocks.loadGraph, rows: [], selectCommit: vi.fn() }),
      subscribe: () => () => {},
    }
  ),
}));

vi.mock("../../store/ui-store", () => ({
  useUIStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { showToast: mocks.showToast };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ showToast: mocks.showToast }),
      subscribe: () => () => {},
    }
  ),
}));

vi.mock("../../store/git-operation-store", () => ({
  useGitOperationStore: Object.assign(() => ({}), {
    getState: () => ({ close: vi.fn(), addEntry: vi.fn() }),
    subscribe: () => () => {},
  }),
  runGitOperation: mocks.runGitOperation,
  GitOperationCancelledError: class GitOperationCancelledError extends Error {
    constructor(msg = "cancelled") {
      super(msg);
      this.name = "GitOperationCancelledError";
    }
  },
}));

vi.mock("../../utils/open-dialog", () => ({
  openDialogWindow: mocks.openDialogWindow,
}));

/* ---------- Dialog mocks ---------- */

vi.mock("../dialogs/BranchDialogs", () => ({
  CreateBranchDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-branch-dialog">CreateBranchDialog</div> : null,
  DeleteBranchDialog: ({ open, branchName }: { open: boolean; branchName: string }) =>
    open ? (
      <div data-testid="delete-branch-dialog">DeleteBranchDialog:{branchName}</div>
    ) : null,
  RenameBranchDialog: ({ open, branchName }: { open: boolean; branchName: string }) =>
    open ? (
      <div data-testid="rename-branch-dialog">RenameBranchDialog:{branchName}</div>
    ) : null,
  MergeBranchDialog: ({ open, branchName }: { open: boolean; branchName: string }) =>
    open ? (
      <div data-testid="merge-branch-dialog">MergeBranchDialog:{branchName}</div>
    ) : null,
  RebaseBranchDialog: ({ open, onto }: { open: boolean; onto: string }) =>
    open ? <div data-testid="rebase-branch-dialog">RebaseBranchDialog:{onto}</div> : null,
}));

vi.mock("../dialogs/StashDialog", () => ({
  CreateStashDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-stash-dialog">CreateStashDialog</div> : null,
}));

vi.mock("../dialogs/TagDialog", () => ({
  CreateTagDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-tag-dialog">CreateTagDialog</div> : null,
}));

vi.mock("../dialogs/ModalDialog", () => ({
  ModalDialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal-dialog" data-title={title}>
        {children}
      </div>
    ) : null,
  DialogActions: ({
    onCancel,
    onConfirm,
    confirmLabel,
  }: {
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel: string;
  }) => (
    <div>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ),
}));

vi.mock("../dialogs/AddSubmoduleDialog", () => ({
  AddSubmoduleDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-submodule-dialog">AddSubmoduleDialog</div> : null,
}));

vi.mock("../dialogs/CheckoutDialog", () => ({
  CheckoutDialog: ({ open, branchName }: { open: boolean; branchName?: string }) =>
    open ? <div data-testid="checkout-dialog">CheckoutDialog:{branchName}</div> : null,
}));

vi.mock("../layout/ContextMenu", () => ({
  ContextMenu: ({
    items,
    onClose,
  }: {
    items: Array<{ label?: string; onClick?: () => void; divider?: boolean }>;
    onClose: () => void;
  }) => (
    <div data-testid="context-menu">
      {items
        .filter((i) => !i.divider)
        .map((item, idx) => (
          <div
            key={idx}
            data-testid={`ctx-item-${idx}`}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            {item.label}
          </div>
        ))}
    </div>
  ),
}));

/* ---------- Import component after all mocks ---------- */

import { Sidebar } from "./Sidebar";

/* ---------- Helpers ---------- */

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  path: "/repos/my-project",
  currentBranch: "main",
  headCommit: "abc1234",
  isDirty: false,
  ...overrides,
});

const makeLocalBranch = (name: string, current = false): BranchInfo => ({
  name,
  current,
  remote: false,
  ahead: 0,
  behind: 0,
});

const makeRemoteBranch = (name: string): BranchInfo => ({
  name,
  current: false,
  remote: true,
  ahead: 0,
  behind: 0,
});

const makeTag = (name: string): TagInfo => ({
  name,
  hash: "deadbeef1234",
  annotation: "",
});

const makeStash = (index: number, message: string): StashEntry => ({
  index,
  message,
  date: "2025-01-01",
  hash: `stash${index}`,
});

const mockElectronAPI = {
  branch: {
    list: mocks.branchList,
    deleteRemote: mocks.branchDeleteRemote,
  },
  tag: {
    list: mocks.tagList,
    push: mocks.tagPush,
    delete: mocks.tagDelete,
    deleteRemote: mocks.tagDeleteRemote,
  },
  submodule: {
    list: mocks.submoduleList,
    update: mocks.submoduleUpdate,
    sync: mocks.submoduleSync,
  },
  stash: {
    list: mocks.stashList,
    pop: mocks.stashPop,
    apply: mocks.stashApply,
    drop: mocks.stashDrop,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.repoState.repo = null;
  mocks.branchList.mockResolvedValue([]);
  mocks.tagList.mockResolvedValue([]);
  mocks.submoduleList.mockResolvedValue([]);
  mocks.stashList.mockResolvedValue([]);
  mocks.runGitOperation.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

/* ================================================================== */
describe("Sidebar", () => {
  /* ---- No repo state ---- */

  it("renders without crashing when no repo is open", () => {
    const { container } = render(<Sidebar />);
    expect(container).toBeTruthy();
  });

  it("shows 'Open a repository' prompt when no repo is open", () => {
    render(<Sidebar />);
    expect(screen.getByText("Open a repository")).toBeInTheDocument();
  });

  it("does not show section headers when no repo is open", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Branches")).not.toBeInTheDocument();
    expect(screen.queryByText("Remotes")).not.toBeInTheDocument();
  });

  /* ---- Repo open: sections are rendered ---- */

  it("renders all section headers when a repo is open", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("Branches")).toBeInTheDocument();
      expect(screen.getByText("Remotes")).toBeInTheDocument();
      expect(screen.getByText("Tags")).toBeInTheDocument();
      expect(screen.getByText("Submodules")).toBeInTheDocument();
      expect(screen.getByText("Stashes")).toBeInTheDocument();
    });
  });

  it("calls electronAPI to load branches, tags, submodules and stashes on mount", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => {
      expect(mocks.branchList).toHaveBeenCalledTimes(1);
      expect(mocks.tagList).toHaveBeenCalledTimes(1);
      expect(mocks.submoduleList).toHaveBeenCalledTimes(1);
      expect(mocks.stashList).toHaveBeenCalledTimes(1);
    });
  });

  /* ---- Branch list section ---- */

  it("renders local branch names", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([
      makeLocalBranch("main", true),
      makeLocalBranch("feature/test"),
    ]);
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("feature/test")).toBeInTheDocument();
    });
  });

  it("marks the current branch with active class", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    const item = screen.getByText("main").closest(".list-item");
    expect(item).toHaveClass("list-item-active");
  });

  it("shows 'No local branches' when branch list is empty", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("No local branches")).toBeInTheDocument();
    });
  });

  it("shows ahead/behind indicators on a branch", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([
      { ...makeLocalBranch("feature/ahead"), ahead: 3, behind: 2 },
    ]);
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByTitle("3 ahead")).toBeInTheDocument();
      expect(screen.getByTitle("2 behind")).toBeInTheDocument();
    });
  });

  /* ---- Remote list section ---- */

  it("renders remote branch names", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeRemoteBranch("origin/main")]);
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("origin/main")).toBeInTheDocument();
    });
  });

  it("shows 'No remote branches' when no remotes exist", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("No remote branches")).toBeInTheDocument();
    });
  });

  /* ---- Tag list section ---- */

  it("renders tag names", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0"), makeTag("v2.0.0")]);
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
      expect(screen.getByText("v2.0.0")).toBeInTheDocument();
    });
  });

  it("shows tag short hash next to tag name", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0")]);
    render(<Sidebar />);
    // hash "deadbeef1234".slice(0,7) === "deadbee"
    await waitFor(() => {
      expect(screen.getByText("deadbee")).toBeInTheDocument();
    });
  });

  it("shows 'No tags' when tag list is empty", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("No tags")).toBeInTheDocument();
    });
  });

  /* ---- Stash section ---- */

  it("shows 'No stashes' when stash list is empty (after expanding section)", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.click(screen.getByText("Stashes"));
    await waitFor(() => {
      expect(screen.getByText("No stashes")).toBeInTheDocument();
    });
  });

  it("renders stash entries after expanding the Stashes section", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.stashList.mockResolvedValue([makeStash(0, "WIP: my changes")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.click(screen.getByText("Stashes"));
    await waitFor(() => {
      expect(screen.getByText("WIP: my changes")).toBeInTheDocument();
    });
  });

  /* ---- Expand / collapse sections ---- */

  it("collapses the Branches section when header is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.click(screen.getByText("Branches"));
    await waitFor(() => {
      expect(screen.queryByText("main")).not.toBeInTheDocument();
    });
  });

  it("re-expands the Branches section after a second click", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.click(screen.getByText("Branches"));
    fireEvent.click(screen.getByText("Branches"));
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });
  });

  it("collapses the Remotes section when header is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeRemoteBranch("origin/main")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("origin/main"));
    fireEvent.click(screen.getByText("Remotes"));
    await waitFor(() => {
      expect(screen.queryByText("origin/main")).not.toBeInTheDocument();
    });
  });

  it("collapses the Tags section when header is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("v1.0.0"));
    fireEvent.click(screen.getByText("Tags"));
    await waitFor(() => {
      expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    });
  });

  it("Submodules section is collapsed by default", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.submoduleList.mockResolvedValue([
      { name: "libfoo", path: "libfoo", url: "https://example.com/foo", hash: "abc1234" },
    ]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Submodules"));
    expect(screen.queryByText("libfoo")).not.toBeInTheDocument();
  });

  it("expands Submodules section on click and shows submodule path", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.submoduleList.mockResolvedValue([
      { name: "libfoo", path: "libfoo", url: "https://example.com/foo", hash: "abc1234" },
    ]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Submodules"));
    fireEvent.click(screen.getByText("Submodules"));
    await waitFor(() => {
      expect(screen.getByText("libfoo")).toBeInTheDocument();
    });
  });

  /* ---- Search / filter ---- */

  it("renders a filter input", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    expect(screen.getByPlaceholderText("Filter...")).toBeInTheDocument();
  });

  it("filters branches by search query", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([
      makeLocalBranch("main", true),
      makeLocalBranch("feature/login"),
    ]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.change(screen.getByPlaceholderText("Filter..."), {
      target: { value: "login" },
    });
    await waitFor(() => {
      expect(screen.queryByText("main")).not.toBeInTheDocument();
      expect(screen.getByText("feature/login")).toBeInTheDocument();
    });
  });

  it("shows 'No matches' when filter yields no results", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.change(screen.getByPlaceholderText("Filter..."), {
      target: { value: "zzznomatch" },
    });
    await waitFor(() => {
      expect(screen.getAllByText("No matches").length).toBeGreaterThan(0);
    });
  });

  it("shows a clear button when search query is non-empty and clears input on click", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    const input = screen.getByPlaceholderText("Filter...");
    fireEvent.change(input, { target: { value: "test" } });
    const clearBtn = screen.getByText("×");
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect((input as HTMLInputElement).value).toBe("");
  });

  /* ---- Context menu on branches ---- */

  it("shows context menu on right-click of a local branch", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/ctx", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/ctx"));
    fireEvent.contextMenu(screen.getByText("feature/ctx").closest(".list-item")!);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("context menu for non-current local branch includes Checkout option", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/ctx", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/ctx"));
    fireEvent.contextMenu(screen.getByText("feature/ctx").closest(".list-item")!);
    expect(screen.getByText("Checkout")).toBeInTheDocument();
  });

  it("context menu for non-current local branch includes Delete option", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/ctx", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/ctx"));
    fireEvent.contextMenu(screen.getByText("feature/ctx").closest(".list-item")!);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("context menu for current branch does not include Checkout or Delete", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.contextMenu(screen.getByText("main").closest(".list-item")!);
    expect(screen.queryByText("Checkout")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("context menu for non-current local branch includes Rename option", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/ren", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/ren"));
    fireEvent.contextMenu(screen.getByText("feature/ren").closest(".list-item")!);
    expect(screen.getByText("Rename")).toBeInTheDocument();
  });

  it("context menu for remote branch includes Delete Remote Branch", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeRemoteBranch("origin/feature")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("origin/feature"));
    fireEvent.contextMenu(screen.getByText("origin/feature").closest(".list-item")!);
    expect(screen.getByText("Delete Remote Branch")).toBeInTheDocument();
  });

  /* ---- Context menu on tags ---- */

  it("shows context menu on right-click of a tag", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("v1.0.0"));
    fireEvent.contextMenu(screen.getByText("v1.0.0").closest(".list-item")!);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("tag context menu shows Push to Remote and Delete options", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("v1.0.0"));
    fireEvent.contextMenu(screen.getByText("v1.0.0").closest(".list-item")!);
    expect(screen.getByText("Push to Remote")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  /* ---- Context menu on stashes ---- */

  it("shows context menu on right-click of a stash entry", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.stashList.mockResolvedValue([makeStash(0, "WIP: context test")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.click(screen.getByText("Stashes"));
    await waitFor(() => screen.getByText("WIP: context test"));
    fireEvent.contextMenu(screen.getByText("WIP: context test").closest(".list-item")!);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("stash context menu shows Pop, Apply, and Drop options", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.stashList.mockResolvedValue([makeStash(0, "WIP: stash menu")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.click(screen.getByText("Stashes"));
    await waitFor(() => screen.getByText("WIP: stash menu"));
    fireEvent.contextMenu(screen.getByText("WIP: stash menu").closest(".list-item")!);
    expect(screen.getByText("Pop")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Drop")).toBeInTheDocument();
  });

  /* ---- Context menu on section headers ---- */

  it("Branches section header context menu shows Create New Branch option", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Branches"));
    fireEvent.contextMenu(screen.getByText("Branches").closest(".section-header")!);
    expect(screen.getByText("Create New Branch...")).toBeInTheDocument();
  });

  it("Tags section header context menu shows Create New Tag option", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Tags"));
    fireEvent.contextMenu(screen.getByText("Tags").closest(".section-header")!);
    expect(screen.getByText("Create New Tag...")).toBeInTheDocument();
  });

  it("Stashes section header context menu shows Stash Changes option", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.contextMenu(screen.getByText("Stashes").closest(".section-header")!);
    expect(screen.getByText("Stash Changes...")).toBeInTheDocument();
  });

  /* ---- Dialog opening from context menu actions ---- */

  it("opens CreateBranchDialog when context menu Create New Branch is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Branches"));
    fireEvent.contextMenu(screen.getByText("Branches").closest(".section-header")!);
    fireEvent.click(screen.getByText("Create New Branch..."));
    expect(screen.getByTestId("create-branch-dialog")).toBeInTheDocument();
  });

  it("opens CreateTagDialog when context menu Create New Tag is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Tags"));
    fireEvent.contextMenu(screen.getByText("Tags").closest(".section-header")!);
    fireEvent.click(screen.getByText("Create New Tag..."));
    expect(screen.getByTestId("create-tag-dialog")).toBeInTheDocument();
  });

  it("opens CreateStashDialog when context menu Stash Changes is clicked", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Stashes"));
    fireEvent.contextMenu(screen.getByText("Stashes").closest(".section-header")!);
    fireEvent.click(screen.getByText("Stash Changes..."));
    expect(screen.getByTestId("create-stash-dialog")).toBeInTheDocument();
  });

  it("opens CheckoutDialog when Checkout is selected from branch context menu", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/test", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/test"));
    fireEvent.contextMenu(screen.getByText("feature/test").closest(".list-item")!);
    fireEvent.click(screen.getByText("Checkout"));
    expect(screen.getByTestId("checkout-dialog")).toBeInTheDocument();
  });

  it("opens DeleteBranchDialog when Delete is selected from branch context menu", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/del", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/del"));
    fireEvent.contextMenu(screen.getByText("feature/del").closest(".list-item")!);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByTestId("delete-branch-dialog")).toBeInTheDocument();
  });

  it("opens RenameBranchDialog when Rename is selected from branch context menu", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/ren", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/ren"));
    fireEvent.contextMenu(screen.getByText("feature/ren").closest(".list-item")!);
    fireEvent.click(screen.getByText("Rename"));
    expect(screen.getByTestId("rename-branch-dialog")).toBeInTheDocument();
  });

  /* ---- Double-click to checkout ---- */

  it("opens CheckoutDialog on double-click of a non-current branch", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("feature/dbl", false)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("feature/dbl"));
    fireEvent.dblClick(screen.getByText("feature/dbl").closest(".list-item")!);
    expect(screen.getByTestId("checkout-dialog")).toBeInTheDocument();
  });

  it("does NOT open CheckoutDialog on double-click of the current branch", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([makeLocalBranch("main", true)]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("main"));
    fireEvent.dblClick(screen.getByText("main").closest(".list-item")!);
    expect(screen.queryByTestId("checkout-dialog")).not.toBeInTheDocument();
  });

  /* ---- Delete tag confirmation dialog ---- */

  it("opens delete tag confirmation when Delete is selected from tag context menu", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([makeTag("v1.0.0")]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("v1.0.0"));
    fireEvent.contextMenu(screen.getByText("v1.0.0").closest(".list-item")!);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      const modal = screen.getByTestId("modal-dialog");
      expect(modal).toHaveAttribute("data-title", "Delete Tag");
    });
  });

  /* ---- Section item counts ---- */

  it("displays branch count in Branches section header", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.branchList.mockResolvedValue([
      makeLocalBranch("main", true),
      makeLocalBranch("feature/a"),
    ]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Branches"));
    const header = screen.getByText("Branches").closest(".section-header")!;
    expect(header.textContent).toContain("2");
  });

  it("displays tag count in Tags section header", async () => {
    mocks.repoState.repo = makeRepo();
    mocks.tagList.mockResolvedValue([
      makeTag("v1.0.0"),
      makeTag("v1.1.0"),
      makeTag("v2.0.0"),
    ]);
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Tags"));
    const header = screen.getByText("Tags").closest(".section-header")!;
    expect(header.textContent).toContain("3");
  });

  it("Submodules section header context menu shows Add Submodule option", async () => {
    mocks.repoState.repo = makeRepo();
    render(<Sidebar />);
    await waitFor(() => screen.getByText("Submodules"));
    fireEvent.contextMenu(screen.getByText("Submodules").closest(".section-header")!);
    expect(screen.getByText("Add Submodule...")).toBeInTheDocument();
  });
});
