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

describe("GitService.revertCommit", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("reverts a commit with default options", async () => {
    await service.revertCommit({ hash: "abc123" });
    expect(mockRaw).toHaveBeenCalledWith(["revert", "abc123"]);
  });

  it("reverts with --no-commit", async () => {
    await service.revertCommit({ hash: "abc123", noCommit: true });
    expect(mockRaw).toHaveBeenCalledWith(["revert", "--no-commit", "abc123"]);
  });

  it("reverts a merge commit with mainline", async () => {
    await service.revertCommit({ hash: "abc123", mainline: 1 });
    expect(mockRaw).toHaveBeenCalledWith(["revert", "-m", "1", "abc123"]);
  });

  it("reverts a merge commit with --no-commit and mainline", async () => {
    await service.revertCommit({ hash: "abc123", noCommit: true, mainline: 2 });
    expect(mockRaw).toHaveBeenCalledWith(["revert", "--no-commit", "-m", "2", "abc123"]);
  });
});

describe("GitService.cherryPickWithOptions", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("cherry-picks with default options", async () => {
    await service.cherryPickWithOptions({ hash: "def456" });
    expect(mockRaw).toHaveBeenCalledWith(["cherry-pick", "def456"]);
  });

  it("cherry-picks with --no-commit", async () => {
    await service.cherryPickWithOptions({ hash: "def456", noCommit: true });
    expect(mockRaw).toHaveBeenCalledWith(["cherry-pick", "--no-commit", "def456"]);
  });

  it("cherry-picks a merge commit with mainline", async () => {
    await service.cherryPickWithOptions({ hash: "def456", mainline: 1 });
    expect(mockRaw).toHaveBeenCalledWith(["cherry-pick", "-m", "1", "def456"]);
  });

  it("cherry-picks with all options", async () => {
    await service.cherryPickWithOptions({ hash: "def456", noCommit: true, mainline: 2 });
    expect(mockRaw).toHaveBeenCalledWith(["cherry-pick", "--no-commit", "-m", "2", "def456"]);
  });
});
