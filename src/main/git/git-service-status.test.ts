import { describe, it, expect, vi, beforeEach } from "vitest";
import type fs from "fs";
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

// Mock fs.existsSync for MERGE_HEAD detection
const mockExistsSync = vi.fn();
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof fs>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: (...args: unknown[]) => mockExistsSync(...args),
      readFileSync: actual.readFileSync,
      writeFileSync: actual.writeFileSync,
      mkdtempSync: actual.mkdtempSync,
    },
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
  };
});

import { GitService } from "./git-service";

describe("GitService.getStatus", () => {
  let service: GitService;
  const fakeRepoPath = "/fake/repo";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = fakeRepoPath;
    (service as unknown as Record<string, unknown>)["git"] = {
      status: mockStatus,
      raw: mockRaw,
    };
    mockExistsSync.mockReturnValue(false);
  });

  it("returns mergeInProgress false when no MERGE_HEAD", async () => {
    mockStatus.mockResolvedValue({
      files: [],
      not_added: [],
      renamed: [],
      conflicted: [],
    });
    mockExistsSync.mockReturnValue(false);

    const result = await service.getStatus();
    expect(result.mergeInProgress).toBe(false);
    expect(result.conflicted).toEqual([]);
  });

  it("detects merge in progress via MERGE_HEAD", async () => {
    mockStatus.mockResolvedValue({
      files: [{ path: "greeting.txt", index: "U", working_dir: "U" }],
      not_added: [],
      renamed: [],
      conflicted: ["greeting.txt"],
    });
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(fakeRepoPath, ".git", "MERGE_HEAD")
    );

    const result = await service.getStatus();
    expect(result.mergeInProgress).toBe(true);
    expect(result.conflicted).toEqual([
      { path: "greeting.txt", reason: "both-modified" },
    ]);
  });

  it("reports both-added conflict reason for AA status", async () => {
    mockStatus.mockResolvedValue({
      files: [{ path: "newfile.txt", index: "A", working_dir: "A" }],
      not_added: [],
      renamed: [],
      conflicted: ["newfile.txt"],
    });
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(fakeRepoPath, ".git", "MERGE_HEAD")
    );

    const result = await service.getStatus();
    expect(result.conflicted).toEqual([{ path: "newfile.txt", reason: "both-added" }]);
  });

  it("includes normal files alongside merge state", async () => {
    mockStatus.mockResolvedValue({
      files: [
        { path: "clean.ts", index: "M", working_dir: " " },
        { path: "conflict.txt", index: "U", working_dir: "U" },
      ],
      not_added: ["new.ts"],
      renamed: [],
      conflicted: ["conflict.txt"],
    });
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(fakeRepoPath, ".git", "MERGE_HEAD")
    );

    const result = await service.getStatus();
    expect(result.staged).toEqual([{ path: "clean.ts", status: "modified" }]);
    expect(result.untracked).toEqual(["new.ts"]);
    expect(result.mergeInProgress).toBe(true);
    expect(result.conflicted).toHaveLength(1);
    expect(result.conflicted[0]!.path).toBe("conflict.txt");
  });

  it("returns empty conflicted when merge in progress but no conflicted files", async () => {
    mockStatus.mockResolvedValue({
      files: [{ path: "auto-merged.ts", index: "M", working_dir: " " }],
      not_added: [],
      renamed: [],
      conflicted: [],
    });
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(fakeRepoPath, ".git", "MERGE_HEAD")
    );

    const result = await service.getStatus();
    expect(result.mergeInProgress).toBe(true);
    expect(result.conflicted).toEqual([]);
  });
});
