import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetDiff = vi.fn();
const mockGetCommitDiff = vi.fn();
const mockGetCommitFileDiff = vi.fn();
const mockGetCommitFiles = vi.fn();
const mockGetTreeFiles = vi.fn();
const mockGetRangeFiles = vi.fn();
const mockGetRangeFileDiff = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getDiff: (...args: unknown[]) => mockGetDiff(...args),
    getCommitDiff: (...args: unknown[]) => mockGetCommitDiff(...args),
    getCommitFileDiff: (...args: unknown[]) => mockGetCommitFileDiff(...args),
    getCommitFiles: (...args: unknown[]) => mockGetCommitFiles(...args),
    getTreeFiles: (...args: unknown[]) => mockGetTreeFiles(...args),
    getRangeFiles: (...args: unknown[]) => mockGetRangeFiles(...args),
    getRangeFileDiff: (...args: unknown[]) => mockGetRangeFileDiff(...args),
  },
}));

import { ipcMain } from "electron";
import { registerDiffHandlers } from "./git-diff.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-diff IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerDiffHandlers();
  });

  it("registers all DIFF channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.DIFF.FILE);
    expect(channels).toContain(IPC.DIFF.COMMIT);
    expect(channels).toContain(IPC.DIFF.COMMIT_FILE);
    expect(channels).toContain(IPC.DIFF.COMMIT_FILES);
    expect(channels).toContain(IPC.DIFF.STAGED);
    expect(channels).toContain(IPC.DIFF.TREE_FILES);
    expect(channels).toContain(IPC.DIFF.RANGE_FILES);
    expect(channels).toContain(IPC.DIFF.RANGE_FILE);
  });

  it("DIFF.FILE calls getDiff with file and staged flag", async () => {
    const diff = "--- a/file.ts\n+++ b/file.ts";
    mockGetDiff.mockResolvedValueOnce(diff);
    const result = await getHandler(IPC.DIFF.FILE)({}, "src/index.ts", false);
    expect(mockGetDiff).toHaveBeenCalledWith("src/index.ts", false);
    expect(result).toBe(diff);
  });

  it("DIFF.COMMIT calls getCommitDiff with hash", async () => {
    const diff = "diff --git a/x b/x";
    mockGetCommitDiff.mockResolvedValueOnce(diff);
    const result = await getHandler(IPC.DIFF.COMMIT)({}, "abc123");
    expect(mockGetCommitDiff).toHaveBeenCalledWith("abc123");
    expect(result).toBe(diff);
  });

  it("DIFF.COMMIT_FILE calls getCommitFileDiff with hash and file", async () => {
    const diff = "diff --git a/f b/f";
    mockGetCommitFileDiff.mockResolvedValueOnce(diff);
    const result = await getHandler(IPC.DIFF.COMMIT_FILE)({}, "abc123", "src/app.ts");
    expect(mockGetCommitFileDiff).toHaveBeenCalledWith("abc123", "src/app.ts");
    expect(result).toBe(diff);
  });

  it("DIFF.COMMIT_FILES calls getCommitFiles with hash", async () => {
    const files = [{ path: "src/app.ts", status: "M" }];
    mockGetCommitFiles.mockResolvedValueOnce(files);
    const result = await getHandler(IPC.DIFF.COMMIT_FILES)({}, "abc123");
    expect(mockGetCommitFiles).toHaveBeenCalledWith("abc123");
    expect(result).toBe(files);
  });

  it("DIFF.STAGED calls getDiff with undefined file and staged=true", async () => {
    const diff = "diff --git a/staged b/staged";
    mockGetDiff.mockResolvedValueOnce(diff);
    const result = await getHandler(IPC.DIFF.STAGED)({});
    expect(mockGetDiff).toHaveBeenCalledWith(undefined, true);
    expect(result).toBe(diff);
  });

  it("DIFF.TREE_FILES calls getTreeFiles with hash", async () => {
    const files = ["src/a.ts", "src/b.ts"];
    mockGetTreeFiles.mockResolvedValueOnce(files);
    const result = await getHandler(IPC.DIFF.TREE_FILES)({}, "abc123");
    expect(mockGetTreeFiles).toHaveBeenCalledWith("abc123");
    expect(result).toBe(files);
  });

  it("DIFF.RANGE_FILES calls getRangeFiles with two hashes", async () => {
    const files = [{ path: "src/c.ts", status: "A" }];
    mockGetRangeFiles.mockResolvedValueOnce(files);
    const result = await getHandler(IPC.DIFF.RANGE_FILES)({}, "abc123", "def456");
    expect(mockGetRangeFiles).toHaveBeenCalledWith("abc123", "def456");
    expect(result).toBe(files);
  });

  it("DIFF.RANGE_FILE calls getRangeFileDiff with two hashes and file", async () => {
    const diff = "diff --git a/x b/x";
    mockGetRangeFileDiff.mockResolvedValueOnce(diff);
    const result = await getHandler(IPC.DIFF.RANGE_FILE)(
      {},
      "abc123",
      "def456",
      "src/x.ts"
    );
    expect(mockGetRangeFileDiff).toHaveBeenCalledWith("abc123", "def456", "src/x.ts");
    expect(result).toBe(diff);
  });
});
