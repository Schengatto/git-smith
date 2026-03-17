// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CommitDetailsPanel } from "./CommitDetailsPanel";
import type { CommitFileInfo } from "../../../shared/git-types";

const mockFiles: CommitFileInfo[] = [
  { path: "src/main.ts", status: "modified", additions: 10, deletions: 3 },
  { path: "src/utils/helper.ts", status: "added", additions: 25, deletions: 0 },
];

const mockTreeFiles = [
  "src/main.ts",
  "src/utils/helper.ts",
  "src/utils/format.ts",
  "README.md",
];

const commitFilesMock = vi.fn().mockResolvedValue(mockFiles);
const treeFilesMock = vi.fn().mockResolvedValue(mockTreeFiles);
const commitFileMock = vi.fn().mockResolvedValue("diff content here");
const showFileMock = vi.fn().mockResolvedValue("file content here");
const fullInfoMock = vi.fn().mockResolvedValue({
  hash: "abc123",
  abbreviatedHash: "abc123",
  subject: "test",
  body: "",
  authorName: "Test",
  authorEmail: "test@test.com",
  authorDate: new Date().toISOString(),
  committerName: "Test",
  committerEmail: "test@test.com",
  committerDate: new Date().toISOString(),
  parentHashes: [],
  childHashes: [],
  refs: [],
  containedInBranches: [],
  containedInTags: [],
  derivesFromTag: "",
});

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).electronAPI = {
    diff: {
      commitFiles: commitFilesMock,
      commitFile: commitFileMock,
      treeFiles: treeFilesMock,
    },
    log: {
      fullInfo: fullInfoMock,
      showFile: showFileMock,
    },
  };
  (window as unknown as Record<string, unknown>).electronAPI = (globalThis as unknown as Record<string, unknown>).electronAPI;
});

// Mock stores
const mockSelectedCommit = { hash: "abc123", subject: "test commit" };
const mockRepo = { headCommit: "head456", path: "/repo", name: "repo", currentBranch: "main", isDirty: false };

vi.mock("../../store/graph-store", () => ({
  useGraphStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { selectedCommit: mockSelectedCommit };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { repo: mockRepo };
    return selector ? selector(state) : state;
  }),
}));

describe("CommitDetailsPanel", () => {
  it("renders Diff and Files tabs", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
      expect(screen.getByText("Files")).toBeInTheDocument();
    });
  });

  it("loads changed files for selected commit", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(commitFilesMock).toHaveBeenCalledWith("abc123");
    });
  });

  it("loads tree files for selected commit", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(treeFilesMock).toHaveBeenCalledWith("abc123");
    });
  });

  it("switches to Files tab and shows file tree", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Files")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Files"));
    await waitFor(() => {
      expect(screen.getByText("Select a file to view content")).toBeInTheDocument();
    });
  });

  it("defaults to Diff tab showing file diff placeholder", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Select a file to view diff")).toBeInTheDocument();
    });
  });
});
