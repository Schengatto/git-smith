import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.getStaleRemoteBranches", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("returns empty array when no remote branches exist", async () => {
    mockRaw.mockResolvedValueOnce("");
    const result = await service.getStaleRemoteBranches(30);
    expect(result).toEqual([]);
  });

  it("filters branches older than specified days", async () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    mockRaw.mockResolvedValueOnce(
      `origin/old-branch\t${oldDate}\tabc1234\told commit\tAlice\n` +
      `origin/recent-branch\t${recentDate}\tdef5678\tnew commit\tBob`
    );

    const result = await service.getStaleRemoteBranches(30);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("origin/old-branch");
    expect(result[0].remote).toBe("origin");
    expect(result[0].branchName).toBe("old-branch");
    expect(result[0].lastCommitAuthor).toBe("Alice");
  });

  it("skips HEAD references", async () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockRaw.mockResolvedValueOnce(
      `origin/HEAD\t${oldDate}\tabc1234\tpointer\tSystem\n` +
      `origin/stale\t${oldDate}\tdef5678\told work\tBob`
    );

    const result = await service.getStaleRemoteBranches(30);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("origin/stale");
  });

  it("parses multi-segment remote names correctly", async () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockRaw.mockResolvedValueOnce(
      `upstream/feature/deep-path\t${oldDate}\tabc1234\tdeep commit\tCarol`
    );

    const result = await service.getStaleRemoteBranches(30);
    expect(result).toHaveLength(1);
    expect(result[0].remote).toBe("upstream");
    expect(result[0].branchName).toBe("feature/deep-path");
  });
});

describe("GitService.getRemoteBranchCommits", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("returns empty array when no commits", async () => {
    mockRaw.mockResolvedValueOnce("");
    const result = await service.getRemoteBranchCommits("origin/branch");
    expect(result).toEqual([]);
  });

  it("parses commit log output correctly", async () => {
    const sep = "\x00";
    const line = [
      "abc123full",  // hash
      "abc123f",     // abbreviated hash
      "test commit", // subject
      "",            // body
      "Alice",       // authorName
      "alice@t.com", // authorEmail
      "2025-01-01",  // authorDate
      "2025-01-01",  // committerDate
      "parent1",     // parentHashes
      "",            // refs
    ].join(sep);

    mockRaw.mockResolvedValueOnce(line);
    const result = await service.getRemoteBranchCommits("origin/branch", 10);

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("abc123full");
    expect(result[0].subject).toBe("test commit");
    expect(result[0].authorName).toBe("Alice");

    // Check that the git command includes max-count
    expect(mockRaw).toHaveBeenCalledWith(
      expect.arrayContaining(["log", "origin/branch", "--max-count=10"])
    );
  });
});
