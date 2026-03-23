// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CommitDetailsDialog } from "./CommitDetailsDialog";
import type { CommitFullInfo, CommitFileInfo } from "../../../shared/git-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const mockFullInfo: CommitFullInfo = {
  hash: "abc123def456",
  abbreviatedHash: "abc123d",
  subject: "feat: add commit details dialog",
  body: "Detailed body text",
  authorName: "Test Author",
  authorEmail: "test@example.com",
  authorDate: new Date().toISOString(),
  committerName: "Test Author",
  committerEmail: "test@example.com",
  committerDate: new Date().toISOString(),
  parentHashes: ["parent111"],
  childHashes: [],
  refs: [],
  gravatarHash: "abc",
  containedInBranches: ["main"],
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
const commitFileMock = vi.fn().mockResolvedValue(
  `diff --git a/src/main.ts b/src/main.ts
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,5 @@
+import { foo } from 'bar';
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;`
);

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    log: { fullInfo: fullInfoMock },
    diff: { commitFiles: commitFilesMock, commitFile: commitFileMock },
  };
});

describe("CommitDetailsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommitDetailsDialog open={false} onClose={vi.fn()} commitHash="abc123" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("fetches commit info and files when opened", async () => {
    render(<CommitDetailsDialog open={true} onClose={vi.fn()} commitHash="abc123def456" />);

    await waitFor(() => {
      expect(fullInfoMock).toHaveBeenCalledWith("abc123def456");
      expect(commitFilesMock).toHaveBeenCalledWith("abc123def456");
    });

    expect(screen.getByText("feat: add commit details dialog")).toBeInTheDocument();
    expect(screen.getByText("commitDetails.filesChanged")).toBeInTheDocument();
  });

  it("displays file list with status badges and stats", async () => {
    render(<CommitDetailsDialog open={true} onClose={vi.fn()} commitHash="abc123def456" />);

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

  it("loads and shows diff when clicking a file", async () => {
    render(<CommitDetailsDialog open={true} onClose={vi.fn()} commitHash="abc123def456" />);

    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("src/main.ts"));

    await waitFor(() => {
      expect(commitFileMock).toHaveBeenCalledWith("abc123def456", "src/main.ts");
    });
  });

  it("calls onClose when clicking overlay", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommitDetailsDialog open={true} onClose={onClose} commitHash="abc123def456" />
    );

    await waitFor(() => {
      expect(screen.getByText("commitDetails.title")).toBeInTheDocument();
    });

    // Click the overlay (first child of container)
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", async () => {
    const onClose = vi.fn();
    render(<CommitDetailsDialog open={true} onClose={onClose} commitHash="abc123def456" />);

    await waitFor(() => {
      expect(screen.getByText("commitDetails.title")).toBeInTheDocument();
    });

    // Find the close button (the X button in header)
    const header = screen.getByText("commitDetails.title").parentElement!;
    const closeBtn = header.querySelector("button")!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows total additions and deletions", async () => {
    render(<CommitDetailsDialog open={true} onClose={vi.fn()} commitHash="abc123def456" />);

    await waitFor(() => {
      expect(screen.getByText("+35")).toBeInTheDocument();
      expect(screen.getByText("-18")).toBeInTheDocument();
    });
  });
});
