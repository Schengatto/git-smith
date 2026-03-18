// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { RebaseDialog } from "./RebaseDialog";
import type { CommitInfo } from "../../../shared/git-types";

const mockCommits: CommitInfo[] = [
  {
    hash: "aaa111full",
    abbreviatedHash: "aaa111",
    subject: "feat: add login page",
    body: "",
    authorName: "Alice",
    authorEmail: "alice@test.com",
    authorDate: "2026-03-10T10:00:00Z",
    committerDate: "2026-03-10T10:00:00Z",
    parentHashes: ["parent1"],
    refs: [],
  },
  {
    hash: "bbb222full",
    abbreviatedHash: "bbb222",
    subject: "fix: resolve crash on startup",
    body: "",
    authorName: "Bob",
    authorEmail: "bob@test.com",
    authorDate: "2026-03-11T14:30:00Z",
    committerDate: "2026-03-11T14:30:00Z",
    parentHashes: ["aaa111full"],
    refs: [],
  },
];

const rebaseCommitsMock = vi.fn().mockResolvedValue(mockCommits);
const rebaseWithOptionsMock = vi.fn().mockResolvedValue(undefined);
const rebaseContinueMock = vi.fn().mockResolvedValue(undefined);
const rebaseSkipMock = vi.fn().mockResolvedValue(undefined);
const rebaseAbortMock = vi.fn().mockResolvedValue(undefined);
const isRebaseInProgressMock = vi.fn().mockResolvedValue(false);
const refreshInfoMock = vi.fn().mockResolvedValue(undefined);
const refreshStatusMock = vi.fn().mockResolvedValue(undefined);
const loadGraphMock = vi.fn().mockResolvedValue(undefined);

// Mock stores
vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    repo: { currentBranch: "feature/my-branch", path: "/test", headCommit: "abc", isDirty: false, name: "test" },
    refreshInfo: refreshInfoMock,
    refreshStatus: refreshStatusMock,
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: loadGraphMock,
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: (_label: string, fn: () => Promise<unknown>) => fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    branch: {
      rebaseCommits: rebaseCommitsMock,
      rebaseWithOptions: rebaseWithOptionsMock,
      rebaseContinue: rebaseContinueMock,
      rebaseSkip: rebaseSkipMock,
      rebaseAbort: rebaseAbortMock,
      isRebaseInProgress: isRebaseInProgressMock,
    },
    settings: {
      get: vi.fn().mockResolvedValue({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" }),
    },
    conflict: {
      list: vi.fn().mockResolvedValue([]),
      fileContent: vi.fn().mockResolvedValue({ ours: "", theirs: "", base: "", merged: "" }),
      resolve: vi.fn().mockResolvedValue(undefined),
      saveMerged: vi.fn().mockResolvedValue(undefined),
      launchMergeTool: vi.fn().mockResolvedValue({ exitCode: 0, mergedContent: "" }),
    },
    dialog: {
      open: vi.fn(),
    },
  };
});

describe("RebaseDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RebaseDialog open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows current branch and rebase-on input when opened", async () => {
    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("feature/my-branch")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("commit hash or branch name...");
    expect(input).toHaveValue("main");
  });

  it("loads commits when rebaseOn is set via preselectedOnto", async () => {
    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(rebaseCommitsMock).toHaveBeenCalledWith("main");
    });

    await waitFor(() => {
      expect(screen.getByText("feat: add login page")).toBeInTheDocument();
      expect(screen.getByText("fix: resolve crash on startup")).toBeInTheDocument();
    });
  });

  it("shows commit hashes and authors in the table", async () => {
    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("aaa111")).toBeInTheDocument();
      expect(screen.getByText("bbb222")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("calls rebaseWithOptions on Rebase click", async () => {
    const onClose = vi.fn();
    render(<RebaseDialog open={true} onClose={onClose} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("feat: add login page")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rebase" }));

    await waitFor(() => {
      expect(rebaseWithOptionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ onto: "main" })
      );
    });

    await waitFor(() => {
      expect(refreshInfoMock).toHaveBeenCalled();
      expect(loadGraphMock).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("passes advanced options to rebaseWithOptions", async () => {
    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("feat: add login page")).toBeInTheDocument();
    });

    // Check some advanced options
    fireEvent.click(screen.getByLabelText("Preserve Merges"));
    fireEvent.click(screen.getByLabelText("Auto stash"));
    fireEvent.click(screen.getByLabelText("Ignore date"));

    fireEvent.click(screen.getByRole("button", { name: "Rebase" }));

    await waitFor(() => {
      expect(rebaseWithOptionsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          onto: "main",
          preserveMerges: true,
          autoStash: true,
          ignoreDate: true,
        })
      );
    });
  });

  it("opens in interactive mode when startInteractive is true", async () => {
    render(
      <RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" startInteractive={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("feat: add login page")).toBeInTheDocument();
    });

    // Interactive mode should show action dropdowns
    const checkbox = screen.getByLabelText("Interactive Rebase") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Rebase" }));

    await waitFor(() => {
      expect(rebaseWithOptionsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          onto: "main",
          interactive: true,
          todoEntries: [
            { action: "pick", hash: "aaa111full" },
            { action: "pick", hash: "bbb222full" },
          ],
        })
      );
    });
  });

  it("shows conflict controls when rebase is in progress", async () => {
    isRebaseInProgressMock.mockResolvedValue(true);

    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("There are unresolved merge conflicts")).toBeInTheDocument();
    });

    expect(screen.getByText("Solve conflicts")).toBeInTheDocument();
    expect(screen.getByText("Abort")).toBeInTheDocument();
    expect(screen.getByText("Skip currently applying commit")).toBeInTheDocument();
  });

  it("opens merge conflict dialog on Solve conflicts click", async () => {
    isRebaseInProgressMock.mockResolvedValueOnce(true).mockResolvedValue(false);
    const dialogOpenMock = vi.fn();
    (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
      ...(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI,
      dialog: {
        open: dialogOpenMock,
      },
    };

    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("Solve conflicts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Solve conflicts"));

    expect(dialogOpenMock).toHaveBeenCalledWith({ dialog: "MergeConflictDialog" });
  });

  it("calls rebaseAbort on Abort click", async () => {
    isRebaseInProgressMock.mockResolvedValueOnce(true);
    const onClose = vi.fn();

    render(<RebaseDialog open={true} onClose={onClose} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("Abort")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Abort"));

    await waitFor(() => {
      expect(rebaseAbortMock).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("calls rebaseSkip on Skip click", async () => {
    isRebaseInProgressMock.mockResolvedValueOnce(true).mockResolvedValue(false);

    render(<RebaseDialog open={true} onClose={vi.fn()} preselectedOnto="main" />);

    await waitFor(() => {
      expect(screen.getByText("Skip currently applying commit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Skip currently applying commit"));

    await waitFor(() => {
      expect(rebaseSkipMock).toHaveBeenCalled();
    });
  });

  it("disables Rebase button when rebaseOn is empty", async () => {
    render(<RebaseDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(isRebaseInProgressMock).toHaveBeenCalled();
    });

    const rebaseBtn = screen.getByRole("button", { name: "Rebase" });
    expect(rebaseBtn).toBeDisabled();
  });
});
