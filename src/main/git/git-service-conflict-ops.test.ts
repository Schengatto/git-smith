import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const mockStatus = vi.fn();
const mockRaw = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ status: mockStatus, raw: mockRaw });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

// Mock fs for sentinel file detection and rebase step reading
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: (...args: unknown[]) => mockExistsSync(...args),
      readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
      writeFileSync: actual.writeFileSync,
      mkdtempSync: actual.mkdtempSync,
    },
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  };
});

import { GitService } from "./git-service";

const fakeRepoPath = "/fake/repo";

function makeStatusResult(overrides: Partial<{
  files: { path: string; index: string; working_dir: string }[];
  not_added: string[];
  renamed: { from: string; to: string }[];
  conflicted: string[];
  isClean: () => boolean;
}> = {}) {
  return {
    files: [],
    not_added: [],
    renamed: [],
    conflicted: [],
    isClean: () => true,
    ...overrides,
  };
}

function setupService(): GitService {
  const service = new GitService();
  (service as unknown as Record<string, unknown>)["repoPath"] = fakeRepoPath;
  (service as unknown as Record<string, unknown>)["git"] = {
    status: mockStatus,
    raw: mockRaw,
  };
  return service;
}

describe("GitService.getStatus - operation detection", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = setupService();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue("");
  });

  it("detects merge in progress (MERGE_HEAD exists)", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "MERGE_HEAD")
    );

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("merge");
    expect(result.mergeInProgress).toBe(true);
    expect(result.rebaseStep).toBeUndefined();
  });

  it("detects interactive rebase (rebase-merge dir with msgnum/end files)", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "rebase-merge")
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === path.join(fakeRepoPath, ".git", "rebase-merge", "msgnum")) return "3\n";
      if (p === path.join(fakeRepoPath, ".git", "rebase-merge", "end")) return "7\n";
      return "";
    });

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("rebase");
    expect(result.rebaseStep).toEqual({ current: 3, total: 7 });
    expect(result.mergeInProgress).toBe(false);
  });

  it("detects non-interactive rebase (rebase-apply dir with next/last files)", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "rebase-apply")
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === path.join(fakeRepoPath, ".git", "rebase-apply", "next")) return "2\n";
      if (p === path.join(fakeRepoPath, ".git", "rebase-apply", "last")) return "5\n";
      return "";
    });

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("rebase");
    expect(result.rebaseStep).toEqual({ current: 2, total: 5 });
  });

  it("detects cherry-pick in progress (CHERRY_PICK_HEAD exists)", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "CHERRY_PICK_HEAD")
    );

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("cherry-pick");
    expect(result.mergeInProgress).toBe(false);
    expect(result.rebaseStep).toBeUndefined();
  });

  it("returns null when no operation in progress", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockReturnValue(false);

    const result = await service.getStatus();
    expect(result.operationInProgress).toBeNull();
    expect(result.mergeInProgress).toBe(false);
    expect(result.rebaseStep).toBeUndefined();
  });

  it("detects conflicted files during rebase (not just merge)", async () => {
    mockStatus.mockResolvedValue(makeStatusResult({
      files: [
        { path: "conflicted.ts", index: "U", working_dir: "U" },
      ],
      conflicted: ["conflicted.ts"],
    }));
    // Only rebase-merge exists, NOT MERGE_HEAD
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "rebase-merge")
    );
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === path.join(fakeRepoPath, ".git", "rebase-merge", "msgnum")) return "1\n";
      if (p === path.join(fakeRepoPath, ".git", "rebase-merge", "end")) return "3\n";
      return "";
    });

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("rebase");
    expect(result.mergeInProgress).toBe(false);
    // Conflicted files should still be detected even though it's a rebase, not a merge
    expect(result.conflicted).toEqual([
      { path: "conflicted.ts", reason: "both-modified" },
    ]);
  });

  it("detects conflicted files during cherry-pick", async () => {
    mockStatus.mockResolvedValue(makeStatusResult({
      files: [
        { path: "file.ts", index: "A", working_dir: "A" },
      ],
      conflicted: ["file.ts"],
    }));
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "CHERRY_PICK_HEAD")
    );

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("cherry-pick");
    expect(result.conflicted).toEqual([
      { path: "file.ts", reason: "both-added" },
    ]);
  });

  it("handles missing rebase step files gracefully", async () => {
    mockStatus.mockResolvedValue(makeStatusResult());
    mockExistsSync.mockImplementation((p: string) =>
      p === path.join(fakeRepoPath, ".git", "rebase-merge")
    );
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const result = await service.getStatus();
    expect(result.operationInProgress).toBe("rebase");
    expect(result.rebaseStep).toBeUndefined();
  });
});
