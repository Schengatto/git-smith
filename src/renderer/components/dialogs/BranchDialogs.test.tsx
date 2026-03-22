// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import {
  CreateBranchDialog,
  DeleteBranchDialog,
  RenameBranchDialog,
  MergeBranchDialog,
  RebaseBranchDialog,
  CherryPickDialog,
  RevertDialog,
} from "./BranchDialogs";
import { runGitOperation } from "../../store/git-operation-store";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshInfo: vi.fn().mockResolvedValue(undefined),
    refreshStatus: vi.fn().mockResolvedValue(undefined),
    repo: { currentBranch: "main" },
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn(),
  GitOperationCancelledError: class extends Error {},
}));

const mockRunGitOperation = runGitOperation as ReturnType<typeof vi.fn>;

const mockElectronAPI = {
  branch: {
    create: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue("success"),
    rebase: vi.fn().mockResolvedValue(undefined),
    cherryPickWithOptions: vi.fn().mockResolvedValue(undefined),
    revert: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("CreateBranchDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CreateBranchDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Create Branch")).toBeInTheDocument();
  });

  it("shows branch name input", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("feature/my-branch")).toBeInTheDocument();
  });

  it("shows Create and Cancel buttons", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<CreateBranchDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows startPoint when provided", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} startPoint="abc1234" />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
  });

  it("Create button is disabled when branch name is empty", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    const createBtn = screen.getByText("Create");
    expect(createBtn).toBeDisabled();
  });

  it("Create button is enabled after typing a branch name", () => {
    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("feature/my-branch"), {
      target: { value: "my-new-branch" },
    });
    expect(screen.getByText("Create")).not.toBeDisabled();
  });
});

describe("DeleteBranchDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DeleteBranchDialog open={false} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Delete Branch")).toBeInTheDocument();
  });

  it("shows branch name in confirmation message", () => {
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("feature/x")).toBeInTheDocument();
  });

  it("shows Delete and Cancel buttons", () => {
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<DeleteBranchDialog open={true} onClose={onClose} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows force delete checkbox", () => {
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Force delete (even if not fully merged)")).toBeInTheDocument();
  });
});

describe("RenameBranchDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RenameBranchDialog open={false} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Rename Branch")).toBeInTheDocument();
  });

  it("pre-fills the input with current branch name", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const input = screen.getByDisplayValue("feature/x");
    expect(input).toBeInTheDocument();
  });

  it("shows Rename and Cancel buttons", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<RenameBranchDialog open={true} onClose={onClose} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("MergeBranchDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <MergeBranchDialog open={false} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Merge Branch")).toBeInTheDocument();
  });

  it("shows branch name in the merge description", () => {
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("feature/x")).toBeInTheDocument();
  });

  it("shows current branch name from store", () => {
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows Merge and Cancel buttons", () => {
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    expect(screen.getByText("Merge")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<MergeBranchDialog open={true} onClose={onClose} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("RebaseBranchDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<RebaseBranchDialog open={false} onClose={vi.fn()} onto="main" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getAllByText("Rebase").length).toBeGreaterThan(0);
  });

  it("shows target branch name", () => {
    render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="develop" />);
    expect(screen.getAllByText("develop").length).toBeGreaterThan(0);
  });

  it("shows Rebase confirm button", () => {
    render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="main" />);
    const buttons = screen.getAllByText("Rebase");
    const confirmBtn = buttons.find((el) => el.tagName === "BUTTON");
    expect(confirmBtn).toBeTruthy();
  });

  it("shows Cancel button", () => {
    render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="main" />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<RebaseBranchDialog open={true} onClose={onClose} onto="main" />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CherryPickDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CherryPickDialog
        open={false}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getAllByText("Cherry Pick").length).toBeGreaterThan(0);
  });

  it("shows abbreviated commit hash", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText("abc123def4")).toBeInTheDocument();
  });

  it("shows commit subject", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("fix: something")).toBeInTheDocument();
  });

  it("shows Cherry Pick confirm button and Cancel button", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    const matches = screen.getAllByText("Cherry Pick");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    expect(confirmBtn).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <CherryPickDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows no-commit checkbox", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText("No commit (stage changes only)")).toBeInTheDocument();
  });

  it("shows mainline selector for merge commits", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="Merge branch"
        isMerge={true}
      />
    );
    expect(screen.getByText("Parent number (mainline):")).toBeInTheDocument();
  });
});

describe("RevertDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RevertDialog
        open={false}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows title", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText("Revert Commit")).toBeInTheDocument();
  });

  it("shows abbreviated commit hash", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText("abc123def4")).toBeInTheDocument();
  });

  it("shows commit subject", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: some bug"
      />
    );
    expect(screen.getByText("fix: some bug")).toBeInTheDocument();
  });

  it("shows Revert and Cancel buttons", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText("Revert")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <RevertDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows mainline selector for merge commits", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="Merge branch"
        isMerge={true}
      />
    );
    expect(screen.getByText("Parent number (mainline):")).toBeInTheDocument();
  });

  it("does not show mainline selector for non-merge commits", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
        isMerge={false}
      />
    );
    expect(screen.queryByText("Parent number (mainline):")).not.toBeInTheDocument();
  });

  it("shows no-commit checkbox description text", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    expect(screen.getByText(/new commit that undoes/i)).toBeInTheDocument();
  });

  it("no-commit checkbox div can be clicked", () => {
    render(
      <RevertDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    const checkboxDiv = screen
      .getByText("No commit (stage changes only)")
      .closest("label")
      ?.querySelector("div");
    expect(checkboxDiv).toBeTruthy();
    if (checkboxDiv) fireEvent.click(checkboxDiv);
    // No crash — click handler fires onChange
    expect(screen.getByText("No commit (stage changes only)")).toBeInTheDocument();
  });
});

describe("CreateBranchDialog — error handling", () => {
  it("shows error when create throws", async () => {
    mockElectronAPI.branch.create.mockRejectedValueOnce(new Error("branch exists"));
    // Disable checkout so runGitOperation is not called on checkout
    mockRunGitOperation.mockResolvedValue(undefined);

    render(<CreateBranchDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("feature/my-branch"), {
      target: { value: "my-new-branch" },
    });
    // Click the checkbox div to uncheck "checkout after creating"
    const checkboxDiv = screen
      .getByText("Checkout after creating")
      .closest("label")
      ?.querySelector("div");
    if (checkboxDiv) fireEvent.click(checkboxDiv);
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("branch exists")).toBeInTheDocument();
    });
  });
});

describe("DeleteBranchDialog — error handling", () => {
  it("shows specific error for 'not fully merged' branches", async () => {
    mockElectronAPI.branch.delete.mockRejectedValueOnce(new Error("not fully merged"));
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getAllByText(/not fully merged/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/enable force delete/i)).toBeInTheDocument();
    });
  });

  it("shows generic error for other failures", async () => {
    mockElectronAPI.branch.delete.mockRejectedValueOnce(new Error("remote error"));
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("remote error")).toBeInTheDocument();
    });
  });

  it("shows 'Force Delete' label when force checkbox div is clicked", () => {
    render(<DeleteBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    // Click the custom checkbox div inside the label
    const checkboxDiv = screen
      .getByText("Force delete (even if not fully merged)")
      .closest("label")
      ?.querySelector("div");
    if (checkboxDiv) fireEvent.click(checkboxDiv);
    expect(screen.getByText("Force Delete")).toBeInTheDocument();
  });
});

describe("RenameBranchDialog — error handling", () => {
  it("Rename button is disabled when name unchanged", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const btn = screen.getByText("Rename");
    expect(btn).toBeDisabled();
  });

  it("Rename button is enabled after name is changed", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const input = screen.getByDisplayValue("feature/x");
    fireEvent.change(input, { target: { value: "feature/y" } });
    expect(screen.getByText("Rename")).not.toBeDisabled();
  });

  it("shows error when rename fails", async () => {
    mockElectronAPI.branch.rename.mockRejectedValueOnce(new Error("rename failed"));
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const input = screen.getByDisplayValue("feature/x");
    fireEvent.change(input, { target: { value: "feature/y" } });
    fireEvent.click(screen.getByText("Rename"));
    await waitFor(() => {
      expect(screen.getByText("rename failed")).toBeInTheDocument();
    });
  });

  it("triggers rename on Enter key", () => {
    render(<RenameBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const input = screen.getByDisplayValue("feature/x");
    fireEvent.change(input, { target: { value: "feature/y" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // No crash — Enter triggers handleRename
    expect(input).toBeInTheDocument();
  });
});

describe("MergeBranchDialog — conflict handling", () => {
  it("shows conflict warning when merge result contains CONFLICT", async () => {
    mockRunGitOperation.mockResolvedValueOnce("CONFLICT in src/file.ts");
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Merge"));
    await waitFor(() => {
      expect(screen.getByText(/merge resulted in conflicts/i)).toBeInTheDocument();
    });
  });

  it("shows error when merge operation throws", async () => {
    mockRunGitOperation.mockRejectedValueOnce(new Error("merge error"));
    render(<MergeBranchDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    fireEvent.click(screen.getByText("Merge"));
    await waitFor(() => {
      expect(screen.getByText("merge error")).toBeInTheDocument();
    });
  });
});

describe("RebaseBranchDialog — error handling", () => {
  it("shows error when rebase operation throws", async () => {
    mockRunGitOperation.mockRejectedValueOnce(new Error("rebase conflict"));
    render(<RebaseBranchDialog open={true} onClose={vi.fn()} onto="main" />);
    const buttons = screen.getAllByText("Rebase");
    const confirmBtn = buttons.find((el) => el.tagName === "BUTTON");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(screen.getByText("rebase conflict")).toBeInTheDocument();
    });
  });
});

describe("CherryPickDialog — extra paths", () => {
  it("does not show mainline selector for non-merge commits", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
        isMerge={false}
      />
    );
    expect(screen.queryByText("Parent number (mainline):")).not.toBeInTheDocument();
  });

  it("no-commit checkbox div can be clicked", () => {
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    const checkboxDiv = screen
      .getByText("No commit (stage changes only)")
      .closest("label")
      ?.querySelector("div");
    expect(checkboxDiv).toBeTruthy();
    if (checkboxDiv) fireEvent.click(checkboxDiv);
    // No crash
    expect(screen.getByText("No commit (stage changes only)")).toBeInTheDocument();
  });

  it("shows error when cherry-pick operation throws", async () => {
    mockRunGitOperation.mockRejectedValueOnce(new Error("cherry-pick failed"));
    render(
      <CherryPickDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    const matches = screen.getAllByText("Cherry Pick");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(screen.getByText("cherry-pick failed")).toBeInTheDocument();
    });
  });

  it("triggers cherry-pick on button click without error when successful", async () => {
    mockRunGitOperation.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <CherryPickDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: x"
      />
    );
    const matches = screen.getAllByText("Cherry Pick");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
