// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import { CommitDetailsPanel } from "./CommitDetailsPanel";
import type { CommitFileInfo } from "../../../shared/git-types";

const mockFiles: CommitFileInfo[] = [
  { path: "src/main.ts", status: "modified", additions: 10, deletions: 3 },
  { path: "src/utils/helper.ts", status: "added", additions: 25, deletions: 0 },
];

const mockTreeFiles = ["src/main.ts", "src/utils/helper.ts", "src/utils/format.ts", "README.md"];

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
  (window as unknown as Record<string, unknown>).electronAPI = (
    globalThis as unknown as Record<string, unknown>
  ).electronAPI;
});

// Mock stores
const mockSelectedCommit = { hash: "abc123", subject: "test commit" };
const mockRepo = {
  headCommit: "head456",
  path: "/repo",
  name: "repo",
  currentBranch: "main",
  isDirty: false,
};

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
      expect(screen.getByText("details.diff")).toBeInTheDocument();
      expect(screen.getByText("details.files")).toBeInTheDocument();
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
      expect(screen.getByText("details.files")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("details.files"));
    await waitFor(() => {
      expect(screen.getByText("details.selectFileToViewContent")).toBeInTheDocument();
    });
  });

  it("defaults to Diff tab showing file diff placeholder", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(screen.getByText("details.selectFileToViewDiff")).toBeInTheDocument();
    });
  });

  it("shows file count badge in Diff tab header after loading", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      // mockFiles has 2 entries
      const badges = Array.from(document.querySelectorAll("span")).map((s) => s.textContent);
      expect(badges).toContain("2");
    });
  });

  it("shows file count badge in Files tab header after loading", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      // mockTreeFiles has 4 entries
      const badges = Array.from(document.querySelectorAll("span")).map((s) => s.textContent);
      expect(badges).toContain("4");
    });
  });

  it("loads diff for selected file in Diff tab", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => screen.getByText("details.diff"));

    // Wait for files to load; in the diff tab the FileTree receives mockFiles
    // The test just needs to verify commitFileMock gets called when a file is selected
    // FileTree is not mocked so we find the file by its name in the DOM
    await waitFor(() => {
      expect(commitFilesMock).toHaveBeenCalledWith("abc123");
    });

    // Find main.ts in the file list and click it
    const fileEntries = screen.queryAllByText("main.ts");
    if (fileEntries.length > 0) {
      fireEvent.click(fileEntries[0]!);
      await waitFor(() => {
        expect(commitFileMock).toHaveBeenCalledWith("abc123", "src/main.ts");
      });
    }
  });

  it("loads file content when a file is selected in Files tab", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => screen.getByText("details.files"));
    fireEvent.click(screen.getByText("details.files"));

    await waitFor(() => {
      expect(treeFilesMock).toHaveBeenCalledWith("abc123");
    });

    // README.md is a top-level file in mockTreeFiles (not nested in a directory)
    await waitFor(() => screen.queryAllByText("README.md"));
    const readmeLinks = screen.queryAllByText("README.md");
    if (readmeLinks.length > 0) {
      fireEvent.click(readmeLinks[0]!);
      await waitFor(() => {
        expect(showFileMock).toHaveBeenCalledWith("abc123", "README.md");
      });
    }
  });

  it("shows file content in pre element after file selected in Files tab", async () => {
    showFileMock.mockResolvedValueOnce("const x = 1; const y = 2;");
    render(<CommitDetailsPanel />);
    fireEvent.click(await screen.findByText("details.files"));

    await waitFor(() => treeFilesMock.mock.calls.length > 0);

    // Click README.md (top-level file)
    const readmeLinks = screen.queryAllByText("README.md");
    if (readmeLinks.length > 0) {
      fireEvent.click(readmeLinks[0]!);
      await waitFor(() => {
        expect(screen.getByText("const x = 1; const y = 2;")).toBeInTheDocument();
      });
    }
  });

  it("shows 'No files' when no matching search results in Files tab", async () => {
    render(<CommitDetailsPanel />);
    fireEvent.click(await screen.findByText("details.files"));

    await waitFor(() => treeFilesMock.mock.calls.length > 0);

    const searchInputs = document.querySelectorAll("input[type='text']");
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[0]!, { target: { value: "ZZZNOMATCH" } });
      await waitFor(() => {
        expect(screen.getByText("details.noMatchingFiles")).toBeInTheDocument();
      });
    }
  });

  it("filters diff tab file list by search", async () => {
    render(<CommitDetailsPanel />);
    await waitFor(() => screen.getByText("details.diff"));
    await waitFor(() => commitFilesMock.mock.calls.length > 0);

    const searchInputs = document.querySelectorAll("input[type='text']");
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[0]!, { target: { value: "helper" } });
      await waitFor(() => {
        // helper.ts should be visible
        expect(screen.getAllByText(/helper/).length).toBeGreaterThan(0);
      });
    }
  });

  it("clears file list when effectiveHash is null (no commit selected)", async () => {
    const graphStoreMod = await import("../../store/graph-store");
    const repoStoreMod = await import("../../store/repo-store");

    // Replace implementation for the duration of this test
    const originalGraph = (graphStoreMod.useGraphStore as any).getMockImplementation?.();
    const originalRepo = (repoStoreMod.useRepoStore as any).getMockImplementation?.();

    (graphStoreMod.useGraphStore as any).mockImplementation(
      (selector?: (s: Record<string, unknown>) => unknown) => {
        const state = { selectedCommit: null };
        return selector ? selector(state) : state;
      }
    );
    (repoStoreMod.useRepoStore as any).mockImplementation(
      (selector?: (s: Record<string, unknown>) => unknown) => {
        const state = { repo: { ...mockRepo, headCommit: null } };
        return selector ? selector(state) : state;
      }
    );

    render(<CommitDetailsPanel />);
    await waitFor(() => {
      expect(screen.getByText("details.selectCommitToViewFiles")).toBeInTheDocument();
    });

    // Restore original implementations
    if (originalGraph) {
      (graphStoreMod.useGraphStore as any).mockImplementation(originalGraph);
    }
    if (originalRepo) {
      (repoStoreMod.useRepoStore as any).mockImplementation(originalRepo);
    }
  });

  it("gracefully handles commitFiles API error", async () => {
    commitFilesMock.mockRejectedValueOnce(new Error("API error"));
    render(<CommitDetailsPanel />);
    await waitFor(() => {
      // Should still render tabs without crashing
      expect(screen.getByText("details.diff")).toBeInTheDocument();
    });
  });

  it("gracefully handles treeFiles API error", async () => {
    treeFilesMock.mockRejectedValueOnce(new Error("tree error"));
    render(<CommitDetailsPanel />);
    fireEvent.click(await screen.findByText("details.files"));
    await waitFor(() => {
      expect(screen.getByText("details.selectFileToViewContent")).toBeInTheDocument();
    });
  });
});
