// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { StaleBranchesDialog } from "./StaleBranchesDialog";
import type { StaleRemoteBranch, CommitInfo } from "../../../shared/git-types";

const mockBranches: StaleRemoteBranch[] = [
  {
    name: "origin/old-feature",
    remote: "origin",
    branchName: "old-feature",
    lastCommitHash: "abc1234",
    lastCommitDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    lastCommitSubject: "last change on old feature",
    lastCommitAuthor: "Alice",
  },
  {
    name: "origin/stale-fix",
    remote: "origin",
    branchName: "stale-fix",
    lastCommitHash: "def5678",
    lastCommitDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastCommitSubject: "fix something old",
    lastCommitAuthor: "Bob",
  },
];

const mockCommits: CommitInfo[] = [
  {
    hash: "abc1234full",
    abbreviatedHash: "abc1234",
    subject: "last change on old feature",
    body: "",
    authorName: "Alice",
    authorEmail: "alice@test.com",
    authorDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    committerDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    parentHashes: ["parent1"],
    refs: [],
  },
  {
    hash: "xyz9876full",
    abbreviatedHash: "xyz9876",
    subject: "earlier commit",
    body: "",
    authorName: "Alice",
    authorEmail: "alice@test.com",
    authorDate: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
    committerDate: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
    parentHashes: [],
    refs: [],
  },
];

const staleRemoteMock = vi.fn().mockResolvedValue(mockBranches);
const remoteCommitsMock = vi.fn().mockResolvedValue(mockCommits);
const deleteRemoteMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    branch: {
      staleRemote: staleRemoteMock,
      remoteCommits: remoteCommitsMock,
      deleteRemote: deleteRemoteMock,
    },
  };
});

describe("StaleBranchesDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<StaleBranchesDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("fetches and displays stale branches when opened", async () => {
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(staleRemoteMock).toHaveBeenCalledWith(30);
    });

    expect(screen.getByText("origin/old-feature")).toBeInTheDocument();
    expect(screen.getByText("origin/stale-fix")).toBeInTheDocument();
    expect(screen.getByText("2 stale branches found")).toBeInTheDocument();
  });

  it("shows no-results message when no stale branches found", async () => {
    staleRemoteMock.mockResolvedValueOnce([]);
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No remote branches older than 30 days found.")).toBeInTheDocument();
    });
  });

  it("loads commits when expanding a branch", async () => {
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("origin/old-feature")).toBeInTheDocument();
    });

    // Click expand chevron (first button in the row)
    const expandBtns = screen.getAllByRole("button");
    // The first button with the chevron SVG for origin/old-feature
    const firstChevron = expandBtns.find(
      (btn) => btn.querySelector("svg polyline[points='9 18 15 12 9 6']") !== null
    );
    if (firstChevron) fireEvent.click(firstChevron);

    await waitFor(() => {
      expect(remoteCommitsMock).toHaveBeenCalledWith("origin/old-feature", 20);
    });

    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("earlier commit")).toBeInTheDocument();
  });

  it("requires confirm before deleting a branch", async () => {
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("origin/old-feature")).toBeInTheDocument();
    });

    // Click first Delete button
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]!);

    // Should show Confirm button, not call deleteRemote yet
    expect(deleteRemoteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm")).toBeInTheDocument();

    // Cancel the confirmation - find the small inline Cancel, not the DialogActions one
    const cancelButtons = screen.getAllByText("Cancel");
    // The inline cancel is the one inside the branch row (not the dialog footer)
    const inlineCancel = cancelButtons.find(
      (btn) => btn.closest("div[style*='gap: 4px']") !== null
    );
    fireEvent.click(inlineCancel!);
    expect(deleteRemoteMock).not.toHaveBeenCalled();
  });

  it("deletes branch on confirm", async () => {
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("origin/old-feature")).toBeInTheDocument();
    });

    // Click Delete
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]!);

    // Click Confirm
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(deleteRemoteMock).toHaveBeenCalledWith("origin", "old-feature");
    });
  });

  it("allows changing the days threshold", async () => {
    render(<StaleBranchesDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(staleRemoteMock).toHaveBeenCalledWith(30);
      // Wait for loading to complete
      expect(screen.getByText("Search")).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue("30");
    fireEvent.change(input, { target: { value: "60" } });

    await waitFor(() => {
      expect(staleRemoteMock).toHaveBeenCalledWith(60);
    });
  });
});
