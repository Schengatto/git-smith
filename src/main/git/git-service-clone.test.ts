import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock simple-git before importing GitService
const mockClone = vi.fn().mockResolvedValue(undefined);
const mockListRemote = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({
    clone: mockClone,
    listRemote: mockListRemote,
  });
  fn.default = fn;
  return { default: fn };
});

// Mock electron
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.clone", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
  });

  it("clones with just url and directory (no options)", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo");
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      []
    );
  });

  it("clones with branch option", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      branch: "develop",
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      ["--branch", "develop"]
    );
  });

  it("clones with bare option", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      bare: true,
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      ["--bare"]
    );
  });

  it("clones with recurse-submodules option", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      recurseSubmodules: true,
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      ["--recurse-submodules"]
    );
  });

  it("clones with shallow option (depth 1)", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      shallow: true,
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      ["--depth", "1"]
    );
  });

  it("clones with all options combined", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      branch: "main",
      bare: true,
      recurseSubmodules: true,
      shallow: true,
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      ["--branch", "main", "--bare", "--recurse-submodules", "--depth", "1"]
    );
  });

  it("ignores empty branch string", async () => {
    await service.clone("https://github.com/user/repo.git", "/tmp/repo", {
      branch: "",
    });
    expect(mockClone).toHaveBeenCalledWith(
      "https://github.com/user/repo.git",
      "/tmp/repo",
      []
    );
  });
});

describe("GitService.listRemoteBranches", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
  });

  it("parses remote branch list correctly", async () => {
    mockListRemote.mockResolvedValue(
      "abc123\trefs/heads/main\n" +
      "def456\trefs/heads/develop\n" +
      "ghi789\trefs/heads/feature/test\n"
    );
    const branches = await service.listRemoteBranches("https://github.com/user/repo.git");
    expect(branches).toEqual(["main", "develop", "feature/test"]);
    expect(mockListRemote).toHaveBeenCalledWith([
      "--heads",
      "https://github.com/user/repo.git",
    ]);
  });

  it("returns empty array for empty response", async () => {
    mockListRemote.mockResolvedValue("");
    const branches = await service.listRemoteBranches("https://github.com/user/repo.git");
    expect(branches).toEqual([]);
  });

  it("handles response with trailing newlines", async () => {
    mockListRemote.mockResolvedValue("abc123\trefs/heads/main\n\n\n");
    const branches = await service.listRemoteBranches("https://github.com/user/repo.git");
    expect(branches).toEqual(["main"]);
  });
});
