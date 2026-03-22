import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("Merge successful");
const mockMerge = vi.fn().mockResolvedValue({ result: "Already up to date." });

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw, merge: mockMerge });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.mergeWithOptions", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw, merge: mockMerge };
  });

  it("merges with default options (fast-forward)", async () => {
    await service.mergeWithOptions({
      branch: "feature/test",
      mergeStrategy: "ff",
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "feature/test"]);
  });

  it("merges with --no-ff", async () => {
    await service.mergeWithOptions({
      branch: "feature/test",
      mergeStrategy: "no-ff",
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "--no-ff", "feature/test"]);
  });

  it("merges with --no-commit", async () => {
    await service.mergeWithOptions({
      branch: "develop",
      mergeStrategy: "ff",
      noCommit: true,
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "--no-commit", "develop"]);
  });

  it("merges with --squash", async () => {
    await service.mergeWithOptions({
      branch: "feature/squash",
      mergeStrategy: "no-ff",
      squash: true,
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "--no-ff", "--squash", "feature/squash"]);
  });

  it("merges with --allow-unrelated-histories", async () => {
    await service.mergeWithOptions({
      branch: "unrelated",
      mergeStrategy: "ff",
      allowUnrelatedHistories: true,
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "--allow-unrelated-histories", "unrelated"]);
  });

  it("merges with --log=N", async () => {
    await service.mergeWithOptions({
      branch: "feature/log",
      mergeStrategy: "ff",
      log: 10,
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "--log=10", "feature/log"]);
  });

  it("merges with custom message", async () => {
    await service.mergeWithOptions({
      branch: "feature/msg",
      mergeStrategy: "no-ff",
      message: "Custom merge message",
    });
    expect(mockRaw).toHaveBeenCalledWith([
      "merge",
      "--no-ff",
      "-m",
      "Custom merge message",
      "feature/msg",
    ]);
  });

  it("merges with all options combined", async () => {
    await service.mergeWithOptions({
      branch: "origin/main",
      mergeStrategy: "no-ff",
      noCommit: true,
      squash: true,
      allowUnrelatedHistories: true,
      log: 20,
      message: "Full merge",
    });
    expect(mockRaw).toHaveBeenCalledWith([
      "merge",
      "--no-ff",
      "--no-commit",
      "--squash",
      "--allow-unrelated-histories",
      "--log=20",
      "-m",
      "Full merge",
      "origin/main",
    ]);
  });

  it("does not add --log when log is 0", async () => {
    await service.mergeWithOptions({
      branch: "feature/nolog",
      mergeStrategy: "ff",
      log: 0,
    });
    expect(mockRaw).toHaveBeenCalledWith(["merge", "feature/nolog"]);
  });
});
