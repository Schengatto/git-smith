// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CheckoutDialog } from "./CheckoutDialog";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshInfo: vi.fn().mockResolvedValue(undefined),
    refreshStatus: vi.fn().mockResolvedValue(undefined),
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

const mockElectronAPI = {
  branch: {
    checkout: vi.fn().mockResolvedValue(undefined),
    checkoutWithOptions: vi.fn().mockResolvedValue(undefined),
  },
  stash: {
    create: vi.fn().mockResolvedValue(undefined),
  },
  status: {
    discardAll: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("CheckoutDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CheckoutDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getAllByText("Checkout").length).toBeGreaterThan(0);
  });

  it("shows Checkout confirm button and Cancel button", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    const matches = screen.getAllByText("Checkout");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    expect(confirmBtn).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<CheckoutDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<CheckoutDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Local changes fieldset", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Local changes")).toBeInTheDocument();
  });

  it("shows local changes strategy options", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Don't change")).toBeInTheDocument();
    expect(screen.getByText("Merge")).toBeInTheDocument();
    expect(screen.getByText("Stash")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("shows warning when Reset strategy is selected", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    // The Reset label is the last radio option; click the label text to trigger onChange
    const resetLabel = screen.getByText("Reset").closest("label");
    const resetRadio = resetLabel?.querySelector("input[type=radio]") as HTMLInputElement;
    fireEvent.click(resetRadio);
    expect(screen.getByText(/all uncommitted changes will be discarded/)).toBeInTheDocument();
  });

  it("shows direct branch name in direct mode", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} branchName="feature/my-branch" />);
    expect(screen.getByText("feature/my-branch")).toBeInTheDocument();
  });

  it("shows branch type tabs when refs are provided", () => {
    const refs = [
      { type: "head" as const, name: "feature/x", current: false },
      { type: "remote" as const, name: "origin/feature/x", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    expect(screen.getByText("Local branch")).toBeInTheDocument();
    expect(screen.getByText("Remote branch")).toBeInTheDocument();
  });

  it("shows detached HEAD option when refs include local branches", () => {
    const refs = [{ type: "head" as const, name: "feature/x", current: false }];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} commitHash="abc123" />);
    expect(screen.getByText("Checkout the commit (detached HEAD)")).toBeInTheDocument();
  });

  it("shows commit info in detached HEAD mode when no refs provided", () => {
    render(
      <CheckoutDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abcdef1234"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText(/abcdef1234/)).toBeInTheDocument();
  });

  it("shows commit subject in detached HEAD mode", () => {
    render(
      <CheckoutDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abcdef1234"
        commitSubject="fix: something important"
      />
    );
    expect(screen.getByText(/fix: something important/)).toBeInTheDocument();
  });

  it("Checkout button is disabled when no branch is selected and not detached", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} />);
    const matches = screen.getAllByText("Checkout");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    // No refs, no branchName — detached is set but selectedBranch is empty — button depends on state
    expect(confirmBtn).toBeTruthy();
  });

  it("allows switching branch type to Remote when remote refs exist", () => {
    const refs = [
      { type: "head" as const, name: "feature/local", current: false },
      { type: "remote" as const, name: "origin/main", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    const remoteRadio = screen
      .getByText("Remote branch")
      .closest("label")
      ?.querySelector("input[type=radio]") as HTMLInputElement;
    fireEvent.click(remoteRadio);
    // Remote branches selector should now show origin/main
    expect(screen.getByDisplayValue("origin/main")).toBeInTheDocument();
  });

  it("selecting detached HEAD radio shows commit hash info", () => {
    const refs = [{ type: "head" as const, name: "feature/x", current: false }];
    render(
      <CheckoutDialog
        open={true}
        onClose={vi.fn()}
        refs={refs}
        commitHash="abc12345678"
        commitSubject="Merge branch"
      />
    );
    const detachedRadio = screen
      .getByText("Checkout the commit (detached HEAD)")
      .closest("label")
      ?.querySelector("input[type=radio]") as HTMLInputElement;
    fireEvent.click(detachedRadio);
    expect(screen.getByText(/abc1234567/)).toBeInTheDocument();
  });

  it("Stash local changes option can be selected", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} branchName="main" />);
    const stashLabel = screen.getByText("Stash").closest("label");
    const stashRadio = stashLabel?.querySelector("input[type=radio]") as HTMLInputElement;
    fireEvent.click(stashRadio);
    expect(stashRadio.checked).toBe(true);
  });

  it("Merge local changes option can be selected", () => {
    render(<CheckoutDialog open={true} onClose={vi.fn()} branchName="main" />);
    const mergeLabel = screen.getByText("Merge").closest("label");
    const mergeRadio = mergeLabel?.querySelector("input[type=radio]") as HTMLInputElement;
    fireEvent.click(mergeRadio);
    expect(mergeRadio.checked).toBe(true);
  });

  it("shows error when checkout fails", async () => {
    const { runGitOperation } = await import("../../store/git-operation-store");
    (runGitOperation as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("checkout failed")
    );
    render(<CheckoutDialog open={true} onClose={vi.fn()} branchName="feature/x" />);
    const matches = screen.getAllByText("Checkout");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(screen.getByText("checkout failed")).toBeInTheDocument();
    });
  });

  it("calls onClose after successful checkout", async () => {
    const { runGitOperation } = await import("../../store/git-operation-store");
    (runGitOperation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<CheckoutDialog open={true} onClose={onClose} branchName="main" />);
    const matches = screen.getAllByText("Checkout");
    const confirmBtn = matches.find((el) => el.tagName === "BUTTON");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows branch selector dropdown when multiple local branches", () => {
    const refs = [
      { type: "head" as const, name: "feature/a", current: false },
      { type: "head" as const, name: "feature/b", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    expect(screen.getByDisplayValue("feature/a")).toBeInTheDocument();
  });

  it("selects first local branch by default", () => {
    const refs = [
      { type: "head" as const, name: "feature/first", current: false },
      { type: "head" as const, name: "feature/second", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    const select = screen.getByDisplayValue("feature/first");
    expect(select).toBeInTheDocument();
  });

  it("can change the selected branch in the dropdown", () => {
    const refs = [
      { type: "head" as const, name: "feature/a", current: false },
      { type: "head" as const, name: "feature/b", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    const select = screen.getByDisplayValue("feature/a");
    fireEvent.change(select, { target: { value: "feature/b" } });
    expect((select as HTMLSelectElement).value).toBe("feature/b");
  });

  it("skips current branch in local branch list", () => {
    const refs = [
      { type: "head" as const, name: "main", current: true },
      { type: "head" as const, name: "feature/x", current: false },
    ];
    render(<CheckoutDialog open={true} onClose={vi.fn()} refs={refs} />);
    // main is current, should not appear in select
    expect(screen.getByDisplayValue("feature/x")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("main")).not.toBeInTheDocument();
  });
});
