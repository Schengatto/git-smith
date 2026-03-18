// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CommitInfoWindow } from "./CommitInfoWindow";
import type { CommitFullInfo, CommitFileInfo } from "../../../shared/git-types";

const mockFullInfo: CommitFullInfo = {
  hash: "abc123def456789012345678901234567890abcd",
  abbreviatedHash: "abc123d",
  subject: "feat: add commit info window",
  body: "Detailed body text",
  authorName: "Test Author",
  authorEmail: "test@example.com",
  authorDate: new Date().toISOString(),
  committerName: "Test Author",
  committerEmail: "test@example.com",
  committerDate: new Date().toISOString(),
  parentHashes: ["parent111aaa"],
  childHashes: ["child222bbb"],
  refs: [],
  gravatarHash: "abc",
  containedInBranches: ["main", "develop"],
  containedInTags: ["v1.0"],
  derivesFromTag: "v1.0",
};

const mockFiles: CommitFileInfo[] = [
  { path: "src/main.ts", status: "modified", additions: 10, deletions: 3 },
  { path: "src/new-file.ts", status: "added", additions: 25, deletions: 0 },
  { path: "src/old-file.ts", status: "deleted", additions: 0, deletions: 15 },
];

const fullInfoMock = vi.fn().mockResolvedValue(mockFullInfo);
const commitFilesMock = vi.fn().mockResolvedValue(mockFiles);
const commitFileMock = vi.fn().mockResolvedValue("diff --git a/src/main.ts b/src/main.ts\n+added line");

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    log: { fullInfo: fullInfoMock },
    diff: { commitFiles: commitFilesMock, commitFile: commitFileMock },
  };
});

describe("CommitInfoWindow", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommitInfoWindow open={false} onClose={vi.fn()} commitHash="abc123" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("fetches commit info and files when opened", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(fullInfoMock).toHaveBeenCalledWith("abc123def456789012345678901234567890abcd");
      expect(commitFilesMock).toHaveBeenCalledWith("abc123def456789012345678901234567890abcd");
    });

    expect(screen.getByText("feat: add commit info window")).toBeInTheDocument();
  });

  it("displays commit metadata (author, hash, branches, tags)", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("feat: add commit info window")).toBeInTheDocument();
    });

    // Author info
    expect(screen.getByText(/Test Author/)).toBeInTheDocument();

    // Commit hash (selectable)
    expect(screen.getByText(mockFullInfo.hash)).toBeInTheDocument();

    // Branches
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("develop")).toBeInTheDocument();

    // Tags (appears in both "Contained in tags" and "Derives from tag")
    expect(screen.getAllByText("v1.0").length).toBeGreaterThanOrEqual(1);
  });

  it("displays parent and child hash links", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("feat: add commit info window")).toBeInTheDocument();
    });

    expect(screen.getByText("parent111a")).toBeInTheDocument();
    expect(screen.getByText("child222bb")).toBeInTheDocument();
  });

  it("shows file list in diff tab with status badges", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    });

    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/old-file.ts")).toBeInTheDocument();

    // Status badges
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("loads diff when clicking a file in diff tab", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("src/main.ts"));

    await waitFor(() => {
      expect(commitFileMock).toHaveBeenCalledWith("abc123def456789012345678901234567890abcd", "src/main.ts");
    });
  });

  it("shows file stats summary", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("+35")).toBeInTheDocument();
      expect(screen.getByText("-18")).toBeInTheDocument();
    });
  });

  it("calls onClose when clicking overlay", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommitInfoWindow open={true} onClose={onClose} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("Commit Information")).toBeInTheDocument();
    });

    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", async () => {
    const onClose = vi.fn();
    render(
      <CommitInfoWindow open={true} onClose={onClose} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("Commit Information")).toBeInTheDocument();
    });

    const header = screen.getByText("Commit Information").parentElement!;
    const closeBtn = header.querySelector("button")!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to commit when clicking parent hash link", async () => {
    const onNavigate = vi.fn();
    render(
      <CommitInfoWindow
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456789012345678901234567890abcd"
        onNavigateToCommit={onNavigate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("parent111a")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("parent111a"));
    expect(onNavigate).toHaveBeenCalledWith("parent111aaa");
  });

  it("switches to file tree tab", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("File tree"));

    // File tree tab should show the "Select a file to view diff" placeholder
    expect(screen.getByText("Select a file to view diff")).toBeInTheDocument();
  });

  it("hides committer when same as author", async () => {
    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText("feat: add commit info window")).toBeInTheDocument();
    });

    // Committer row should not be present since author === committer
    expect(screen.queryAllByText(/Committer/)).toHaveLength(0);
  });

  it("renders without overlay backdrop in window mode", () => {
    render(<CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" mode="window" />);
    const container = document.querySelector('[style*="position: fixed"]');
    expect(container).toBeNull();
  });

  it("shows committer when different from author", async () => {
    const differentCommitter = {
      ...mockFullInfo,
      committerName: "Different Committer",
      committerEmail: "diff@example.com",
    };
    fullInfoMock.mockResolvedValueOnce(differentCommitter);

    render(
      <CommitInfoWindow open={true} onClose={vi.fn()} commitHash="abc123def456789012345678901234567890abcd" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Different Committer/)).toBeInTheDocument();
    });
  });
});
