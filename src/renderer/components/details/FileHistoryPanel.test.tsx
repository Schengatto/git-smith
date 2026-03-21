// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { FileHistoryPanel } from "./FileHistoryPanel";
import type { CommitInfo } from "../../../shared/git-types";

const mockCommits: CommitInfo[] = [
  {
    hash: "aaa111full",
    abbreviatedHash: "aaa111f",
    subject: "feat: latest change",
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
    subject: "fix: earlier change",
    body: "",
    authorName: "Bob",
    authorEmail: "bob@test.com",
    authorDate: "2026-03-20",
    committerDate: "2026-03-20",
    parentHashes: ["ccc333full"],
    refs: [],
  },
  {
    hash: "ccc333full",
    abbreviatedHash: "ccc333f",
    subject: "chore: initial file",
    body: "",
    authorName: "Carol",
    authorEmail: "carol@test.com",
    authorDate: "2026-03-19",
    committerDate: "2026-03-19",
    parentHashes: [],
    refs: [],
  },
];

const fileHistoryMock = vi.fn().mockResolvedValue(mockCommits);
const commitFileDiffMock = vi.fn().mockResolvedValue("diff --git a/file.ts b/file.ts\n+added line");
const rangeFileDiffMock = vi.fn().mockResolvedValue("diff --git a/file.ts b/file.ts\n-old\n+new");
const selectCommitMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    selectCommit: selectCommitMock,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    history: {
      file: fileHistoryMock,
    },
    diff: {
      commitFile: commitFileDiffMock,
      rangeFile: rangeFileDiffMock,
    },
  };
});

describe("FileHistoryPanel", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    filePath: "src/app.ts",
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <FileHistoryPanel open={false} onClose={vi.fn()} filePath="" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("fetches and displays commit history when opened", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalledWith("src/app.ts");
    });

    expect(screen.getByText("feat: latest change")).toBeInTheDocument();
    expect(screen.getByText("fix: earlier change")).toBeInTheDocument();
    expect(screen.getByText("chore: initial file")).toBeInTheDocument();
    expect(screen.getByText("3 commits")).toBeInTheDocument();
  });

  it("shows file path in header", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("loads diff when a commit is clicked in single mode", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("feat: latest change"));

    await waitFor(() => {
      expect(commitFileDiffMock).toHaveBeenCalledWith("aaa111full", "src/app.ts");
    });
  });

  it("switches to compare mode and shows hints", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    const compareBtn = screen.getByText("Compare");
    fireEvent.click(compareBtn);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("select older")).toBeInTheDocument();
    expect(screen.getByText("select newer")).toBeInTheDocument();
  });

  it("selects two commits in compare mode and loads range diff", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    // Enter compare mode
    fireEvent.click(screen.getByText("Compare"));

    // Select first commit (A)
    fireEvent.click(screen.getByText("chore: initial file"));

    await waitFor(() => {
      // The compare hint bar should no longer show "select older"
      expect(screen.queryByText("select older")).not.toBeInTheDocument();
    });

    // Select second commit (B)
    fireEvent.click(screen.getByText("feat: latest change"));

    await waitFor(() => {
      expect(rangeFileDiffMock).toHaveBeenCalledWith("ccc333full", "aaa111full", "src/app.ts");
    });
  });

  it("resets compare selection on Reset click", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("Compare"));
    fireEvent.click(screen.getByText("chore: initial file"));

    await waitFor(() => {
      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Reset"));

    expect(screen.getByText("select older")).toBeInTheDocument();
  });

  it("navigates to commit in graph on search icon click", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    const navButtons = screen.getAllByTitle("Show in graph");
    fireEvent.click(navButtons[0]);

    expect(selectCommitMock).toHaveBeenCalledWith("aaa111full");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("closes on Cancel (backdrop) click", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <FileHistoryPanel open={true} onClose={onClose} filePath="src/app.ts" />
    );

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    // Click backdrop (first child with fixed positioning)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("shows empty state when no history found", async () => {
    fileHistoryMock.mockResolvedValueOnce([]);

    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No history found")).toBeInTheDocument();
    });
  });

  it("toggles back to single mode from compare mode", async () => {
    render(<FileHistoryPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fileHistoryMock).toHaveBeenCalled();
    });

    // Enter compare mode
    fireEvent.click(screen.getByText("Compare"));
    expect(screen.getByText("select older")).toBeInTheDocument();

    // Exit compare mode
    fireEvent.click(screen.getByText("Compare"));

    // Compare hints should be gone
    expect(screen.queryByText("select older")).not.toBeInTheDocument();
  });
});
