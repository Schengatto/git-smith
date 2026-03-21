import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitService } from "./git-service";

vi.mock("simple-git", () => {
  const mock = {
    checkIsRepo: vi.fn().mockResolvedValue(true),
    status: vi.fn().mockResolvedValue({
      current: "main",
      isClean: () => false,
    }),
    revparse: vi.fn().mockResolvedValue("abc123\n"),
    init: vi.fn().mockResolvedValue(undefined),
    outputHandler: vi.fn(),
  };
  return { default: () => mock, __mock: mock };
});

vi.mock("../store", () => ({
  getSettings: () => ({
    gitBinaryPath: "",
    maxConcurrentGitProcesses: 6,
  }),
}));

vi.mock("fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    accessSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdtempSync: vi.fn().mockReturnValue("/tmp/test"),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
    constants: { X_OK: 1 },
  },
}));

describe("GitService core", () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService();
  });

  it("isOpen returns false when no repo is open", () => {
    expect(service.isOpen()).toBe(false);
  });

  it("isOpen returns true after opening a repo", async () => {
    const info = await service.openRepo("/test/repo");
    expect(service.isOpen()).toBe(true);
    expect(info.path).toBe("/test/repo");
    expect(info.currentBranch).toBe("main");
  });

  it("closeRepo resets the state", async () => {
    await service.openRepo("/test/repo");
    service.closeRepo();
    expect(service.isOpen()).toBe(false);
    expect(service.getRepoPath()).toBeNull();
  });

  it("getRepoInfo returns branch and head info", async () => {
    await service.openRepo("/test/repo");
    const info = await service.getRepoInfo();
    expect(info.currentBranch).toBe("main");
    expect(info.headCommit).toBe("abc123");
    expect(info.name).toBe("repo");
  });

  it("initRepo creates and opens a repo", async () => {
    const info = await service.initRepo("/test/new-repo");
    expect(service.isOpen()).toBe(true);
    expect(info.path).toBe("/test/new-repo");
  });

  it("throws when calling methods without an open repo", async () => {
    await expect(service.getRepoInfo()).rejects.toThrow("No repository is open");
  });
});

describe("GitService.launchExternalMergeTool validation", () => {
  let service: GitService;

  beforeEach(async () => {
    service = new GitService();
    await service.openRepo("/test/repo");
  });

  it("rejects non-absolute tool path", async () => {
    await expect(
      service.launchExternalMergeTool("file.txt", "meld", "$LOCAL $REMOTE")
    ).rejects.toThrow("absolute path");
  });

  it("rejects args with shell metacharacters", async () => {
    await expect(
      service.launchExternalMergeTool("file.txt", "/usr/bin/meld", "$LOCAL; rm -rf /")
    ).rejects.toThrow("invalid characters");
  });
});
