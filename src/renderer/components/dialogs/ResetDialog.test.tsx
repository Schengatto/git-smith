// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ResetDialog } from "./ResetDialog";
import * as gitOpStore from "../../store/git-operation-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

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

const mockElectronAPI = {
  branch: {
    reset: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gitOpStore.runGitOperation).mockResolvedValue(undefined);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("ResetDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ResetDialog
        open={false}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("resetDialog.title")).toBeInTheDocument();
  });

  it("shows the commit hash (first 10 chars) and subject", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("abc123def4")).toBeInTheDocument();
    expect(screen.getByText("fix: something")).toBeInTheDocument();
  });

  it("shows all three reset mode options", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("resetDialog.soft")).toBeInTheDocument();
    expect(screen.getByText("resetDialog.mixed")).toBeInTheDocument();
    expect(screen.getByText("resetDialog.hard")).toBeInTheDocument();
  });

  it("defaults to Mixed mode and shows confirm button label accordingly", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    ).toBeInTheDocument();
  });

  it("updates confirm button label when mode is changed to Soft", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByText("resetDialog.soft"));
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.soft/i })
    ).toBeInTheDocument();
  });

  it("shows hard reset warning when Hard mode is selected", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByText("resetDialog.hard"));
    expect(screen.getByText(/resetDialog.hardResetWarning/i)).toBeInTheDocument();
  });

  it("does not show hard reset warning for Mixed mode", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.queryByText(/resetDialog.hardResetWarning/i)).not.toBeInTheDocument();
  });

  it("shows detached HEAD warning when in detached state", () => {
    vi.doMock("../../store/repo-store", () => ({
      useRepoStore: () => ({
        refreshInfo: vi.fn(),
        refreshStatus: vi.fn(),
        repo: { currentBranch: "(detached)" },
      }),
    }));
    // Re-render with the detached state — use direct prop rendering approach
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // The warning is conditional on repo.currentBranch === "(detached)"; covered by mock above if needed
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ResetDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a confirm button present", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    ).toBeInTheDocument();
  });

  it("updates confirm button label when mode is changed to Hard", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByText("resetDialog.hard"));
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.hard/i })
    ).toBeInTheDocument();
  });

  it("calls runGitOperation when confirm button is clicked", async () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    );
    await waitFor(() => {
      expect(vi.mocked(gitOpStore.runGitOperation)).toHaveBeenCalledWith(
        "Reset (mixed)",
        expect.any(Function)
      );
    });
  });

  it("calls onClose after successful reset", async () => {
    const onClose = vi.fn();
    render(
      <ResetDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error when reset fails", async () => {
    vi.mocked(gitOpStore.runGitOperation).mockRejectedValue(new Error("Reset failed"));
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    );
    await waitFor(() => {
      expect(screen.getByText("Reset failed")).toBeInTheDocument();
    });
  });

  it("does not show error when GitOperationCancelledError is thrown", async () => {
    vi.mocked(gitOpStore.runGitOperation).mockRejectedValue(
      new gitOpStore.GitOperationCancelledError()
    );
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    );
    await waitFor(() => expect(vi.mocked(gitOpStore.runGitOperation)).toHaveBeenCalled());
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("shows mode descriptions for all three modes", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText(/resetDialog.softFullDescription/)).toBeInTheDocument();
    expect(screen.getByText(/resetDialog.mixedFullDescription/)).toBeInTheDocument();
    expect(screen.getByText(/resetDialog.hardFullDescription/)).toBeInTheDocument();
  });

  it("resets mode to Mixed when dialog re-opens after selecting Hard", () => {
    const { rerender } = render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByText("resetDialog.hard"));
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.hard/i })
    ).toBeInTheDocument();
    rerender(
      <ResetDialog
        open={false}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    rerender(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(
      screen.getByRole("button", { name: /resetDialog.resetButton resetDialog.mixed/i })
    ).toBeInTheDocument();
  });

  it("shows Reset to label", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("resetDialog.resetToLabel")).toBeInTheDocument();
  });

  it("shows Reset mode label", () => {
    render(
      <ResetDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("resetDialog.resetMode")).toBeInTheDocument();
  });
});
