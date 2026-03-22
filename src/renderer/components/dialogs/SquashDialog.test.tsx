// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SquashDialog } from "./SquashDialog";
import type { CommitInfo } from "../../../shared/git-types";

const mockPreviewCommits: CommitInfo[] = [
  {
    hash: "aaa111full",
    abbreviatedHash: "aaa111f",
    subject: "feat: newest commit",
    body: "",
    authorName: "Alice",
    authorEmail: "alice@test.com",
    authorDate: "2026-03-21",
    committerDate: "2026-03-21",
    parentHashes: ["bbb222full"],
    refs: [],
  },
  {
    hash: "bbb222full",
    abbreviatedHash: "bbb222f",
    subject: "fix: middle commit",
    body: "",
    authorName: "Bob",
    authorEmail: "bob@test.com",
    authorDate: "2026-03-20",
    committerDate: "2026-03-20",
    parentHashes: ["ccc333full"],
    refs: [],
  },
];

const squashPreviewMock = vi.fn().mockResolvedValue(mockPreviewCommits);
const squashExecuteMock = vi.fn().mockResolvedValue(undefined);

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
  runGitOperation: vi.fn((_label: string, fn: () => Promise<void>) => fn()),
  GitOperationCancelledError: class extends Error {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    branch: {
      squashPreview: squashPreviewMock,
      squashExecute: squashExecuteMock,
    },
  };
});

describe("SquashDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    targetHash: "ccc333full",
    targetSubject: "chore: target commit",
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <SquashDialog open={false} onClose={vi.fn()} targetHash="" targetSubject="" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("fetches and displays preview commits when opened", async () => {
    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalledWith("ccc333full");
    });

    expect(screen.getByText("aaa111f")).toBeInTheDocument();
    expect(screen.getByText("feat: newest commit")).toBeInTheDocument();
    expect(screen.getByText("bbb222f")).toBeInTheDocument();
    expect(screen.getByText("fix: middle commit")).toBeInTheDocument();
    // Target commit shown
    expect(screen.getByText("chore: target commit")).toBeInTheDocument();
    // Total count: 2 preview + 1 target = 3
    expect(screen.getByText(/3 commits/)).toBeInTheDocument();
  });

  it("populates the textarea with combined commit messages", async () => {
    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("feat: newest commit");
    expect(textarea.value).toContain("fix: middle commit");
  });

  it("allows editing the commit message", async () => {
    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "feat: squashed message" } });
    expect(textarea.value).toBe("feat: squashed message");
  });

  it("calls squashExecute with correct params on confirm", async () => {
    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "feat: combined" } });

    const confirmBtn = screen.getByText("Squash");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(squashExecuteMock).toHaveBeenCalledWith({
        targetHash: "ccc333full",
        message: "feat: combined",
      });
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows error when trying to squash with empty message", async () => {
    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "   " } });

    const confirmBtn = screen.getByText("Squash");
    fireEvent.click(confirmBtn);

    expect(screen.getByText("Commit message cannot be empty")).toBeInTheDocument();
    expect(squashExecuteMock).not.toHaveBeenCalled();
  });

  it("shows error when squash operation fails", async () => {
    squashExecuteMock.mockRejectedValueOnce(new Error("Cannot squash: dirty working tree"));

    render(<SquashDialog {...defaultProps} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const confirmBtn = screen.getByText("Squash");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cannot squash: dirty working tree/)).toBeInTheDocument();
    });
  });

  it("closes on Cancel click", async () => {
    const onClose = vi.fn();
    render(<SquashDialog {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(squashPreviewMock).toHaveBeenCalled();
    });

    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
