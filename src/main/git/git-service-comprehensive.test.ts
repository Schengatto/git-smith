import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Setup ─────────────────────────────────────────────────────────────

const mockRaw = vi.fn().mockResolvedValue("");
const mockBranch = vi.fn().mockResolvedValue({ branches: {} });
const mockCheckout = vi.fn().mockResolvedValue(undefined);
const mockCommit = vi.fn().mockResolvedValue({ commit: "abc123" });
const mockMerge = vi.fn().mockResolvedValue({ result: "Already up-to-date." });
const mockRebase = vi.fn().mockResolvedValue(undefined);
const mockReset = vi.fn().mockResolvedValue(undefined);
const mockStash = vi.fn().mockResolvedValue(undefined);
const mockStashList = vi.fn().mockResolvedValue({ all: [] });
const mockTag = vi.fn().mockResolvedValue(undefined);
const mockTags = vi.fn().mockResolvedValue({ all: [] });
const mockStatus = vi.fn().mockResolvedValue({
  files: [],
  not_added: [],
  renamed: [],
  conflicted: [],
  isClean: () => true,
  current: "main",
});
const mockGetRemotes = vi.fn().mockResolvedValue([]);
const mockAddRemote = vi.fn().mockResolvedValue(undefined);
const mockRemoveRemote = vi.fn().mockResolvedValue(undefined);
const mockFetch = vi.fn().mockResolvedValue(undefined);
const mockPull = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn().mockResolvedValue(undefined);
const mockDiff = vi.fn().mockResolvedValue("");
const mockApplyPatch = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockClean = vi.fn().mockResolvedValue(undefined);
const mockEnv = vi.fn();

const mockGit = {
  raw: mockRaw,
  branch: mockBranch,
  checkout: mockCheckout,
  commit: mockCommit,
  merge: mockMerge,
  rebase: mockRebase,
  reset: mockReset,
  stash: mockStash,
  stashList: mockStashList,
  tag: mockTag,
  tags: mockTags,
  status: mockStatus,
  getRemotes: mockGetRemotes,
  addRemote: mockAddRemote,
  removeRemote: mockRemoveRemote,
  fetch: mockFetch,
  pull: mockPull,
  push: mockPush,
  diff: mockDiff,
  applyPatch: mockApplyPatch,
  add: mockAdd,
  clean: mockClean,
  env: mockEnv,
  outputHandler: vi.fn(),
  revparse: vi.fn().mockResolvedValue("abc123\n"),
  checkIsRepo: vi.fn().mockResolvedValue(true),
  init: vi.fn().mockResolvedValue(undefined),
  listRemote: vi.fn().mockResolvedValue(""),
  clone: vi.fn().mockResolvedValue(undefined),
};

// env returns a new object that also has rebase so interactive rebase works
mockEnv.mockReturnValue({ ...mockGit, rebase: mockRebase });

vi.mock("simple-git", () => {
  const fn = () => mockGit;
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("../store", () => ({
  getSettings: () => ({ gitBinaryPath: "", maxConcurrentGitProcesses: 6 }),
}));

const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue("");
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: (...args: unknown[]) => mockExistsSync(...args),
      readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
      writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
      unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
      mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
      mkdtempSync: vi.fn().mockReturnValue("/tmp/test-merge"),
      constants: { X_OK: 1 },
      accessSync: vi.fn(),
    },
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    mkdtempSync: vi.fn().mockReturnValue("/tmp/test-merge"),
    constants: { X_OK: 1 },
    accessSync: vi.fn(),
  };
});

import { GitService } from "./git-service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeService(): GitService {
  const service = new GitService();
  (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
  (service as unknown as Record<string, unknown>)["git"] = mockGit;
  return service;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset all mocks to clear queued once-values from previous tests
  mockRaw.mockReset();
  mockRaw.mockResolvedValue("");
  mockBranch.mockResolvedValue({ branches: {} });
  mockCheckout.mockResolvedValue(undefined);
  mockCommit.mockResolvedValue({ commit: "abc123" });
  mockMerge.mockResolvedValue({ result: "Already up-to-date." });
  mockRebase.mockResolvedValue(undefined);
  mockReset.mockResolvedValue(undefined);
  mockStash.mockResolvedValue(undefined);
  mockStashList.mockResolvedValue({ all: [] });
  mockTag.mockResolvedValue(undefined);
  mockTags.mockResolvedValue({ all: [] });
  mockStatus.mockResolvedValue({
    files: [],
    not_added: [],
    renamed: [],
    conflicted: [],
    isClean: () => true,
    current: "main",
  });
  mockGetRemotes.mockResolvedValue([]);
  mockAddRemote.mockResolvedValue(undefined);
  mockRemoveRemote.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue(undefined);
  mockPull.mockResolvedValue(undefined);
  mockPush.mockResolvedValue(undefined);
  mockDiff.mockResolvedValue("");
  mockApplyPatch.mockResolvedValue(undefined);
  mockAdd.mockResolvedValue(undefined);
  mockClean.mockResolvedValue(undefined);
  mockEnv.mockReturnValue({ ...mockGit, rebase: mockRebase });
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
  mockWriteFileSync.mockReturnValue(undefined);
  mockUnlinkSync.mockReturnValue(undefined);
});

// ─── Branch Operations ────────────────────────────────────────────────────────

describe("GitService.getBranches", () => {
  it("returns empty array when there are no branches", async () => {
    const service = makeService();
    mockBranch.mockResolvedValue({ branches: {} });
    const result = await service.getBranches();
    expect(result).toEqual([]);
  });

  it("maps branch summary correctly", async () => {
    const service = makeService();
    mockBranch.mockResolvedValue({
      branches: {
        main: {
          current: true,
          label: "[origin/main: ahead 1, behind 2] abc commit",
          commit: "abc123",
        },
        develop: {
          current: false,
          label: "def commit",
          commit: "def456",
        },
      },
    });
    const result = await service.getBranches();
    expect(result).toHaveLength(2);
    const main = result.find((b) => b.name === "main")!;
    expect(main.current).toBe(true);
    expect(main.lastCommitHash).toBe("abc123");
    expect(main.tracking).toBe("origin/main");
    expect(main.ahead).toBe(1);
    expect(main.behind).toBe(2);

    const develop = result.find((b) => b.name === "develop")!;
    expect(develop.current).toBe(false);
    expect(develop.tracking).toBeUndefined();
  });

  it("marks remote branches correctly", async () => {
    const service = makeService();
    mockBranch.mockResolvedValue({
      branches: {
        "remotes/origin/main": {
          current: false,
          label: "",
          commit: "abc123",
        },
      },
    });
    const result = await service.getBranches();
    expect(result[0]!.remote).toBe(true);
  });
});

describe("GitService.createBranch", () => {
  it("creates a branch without start point", async () => {
    const service = makeService();
    await service.createBranch("feature/new");
    expect(mockBranch).toHaveBeenCalledWith(["feature/new"]);
  });

  it("creates a branch from a specific start point", async () => {
    const service = makeService();
    await service.createBranch("feature/new", "main");
    expect(mockBranch).toHaveBeenCalledWith(["feature/new", "main"]);
  });
});

describe("GitService.deleteBranch", () => {
  it("deletes a branch with -d flag by default", async () => {
    const service = makeService();
    await service.deleteBranch("feature/old");
    expect(mockBranch).toHaveBeenCalledWith(["-d", "feature/old"]);
  });

  it("force-deletes a branch with -D flag", async () => {
    const service = makeService();
    await service.deleteBranch("feature/old", true);
    expect(mockBranch).toHaveBeenCalledWith(["-D", "feature/old"]);
  });
});

describe("GitService.deleteRemoteBranch", () => {
  it("pushes --delete to the remote", async () => {
    const service = makeService();
    await service.deleteRemoteBranch("origin", "feature/old");
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "--delete", "feature/old"]);
  });
});

describe("GitService.renameBranch", () => {
  it("renames a branch using -m", async () => {
    const service = makeService();
    await service.renameBranch("old-name", "new-name");
    expect(mockBranch).toHaveBeenCalledWith(["-m", "old-name", "new-name"]);
  });
});

// ─── Commit Operations ────────────────────────────────────────────────────────

describe("GitService.commit", () => {
  it("commits with a message and returns the hash", async () => {
    const service = makeService();
    mockCommit.mockResolvedValue({ commit: "deadbeef" });
    const hash = await service.commit("feat: add new feature");
    expect(mockCommit).toHaveBeenCalledWith("feat: add new feature");
    expect(hash).toBe("deadbeef");
  });
});

describe("GitService.amend", () => {
  it("amends with a new message", async () => {
    const service = makeService();
    mockCommit.mockResolvedValue({ commit: "newHash" });
    const hash = await service.amend("fix: corrected message");
    expect(hash).toBe("newHash");
    expect(mockCommit).toHaveBeenCalledWith("fix: corrected message", {
      "--amend": null,
    });
  });

  it("amends without changing the message using --no-edit", async () => {
    const service = makeService();
    mockCommit.mockResolvedValue({ commit: "sameHash" });
    const hash = await service.amend();
    expect(hash).toBe("sameHash");
    expect(mockCommit).toHaveBeenCalledWith(undefined as unknown as string, {
      "--amend": null,
      "--no-edit": null,
    });
  });
});

// ─── Stash Operations ─────────────────────────────────────────────────────────

describe("GitService.getStashList", () => {
  it("returns empty array when stash is empty", async () => {
    const service = makeService();
    mockStashList.mockResolvedValue({ all: [] });
    const result = await service.getStashList();
    expect(result).toEqual([]);
  });

  it("maps stash entries with correct fields", async () => {
    const service = makeService();
    mockStashList.mockResolvedValue({
      all: [
        { message: "On main: WIP changes", date: "2026-01-01", hash: "abc123" },
        { message: "On develop: experiment", date: "2026-01-02", hash: "def456" },
      ],
    });
    const result = await service.getStashList();
    expect(result).toHaveLength(2);
    expect(result[0]!.index).toBe(0);
    expect(result[0]!.message).toBe("On main: WIP changes");
    expect(result[0]!.hash).toBe("abc123");
    expect(result[1]!.index).toBe(1);
  });
});

describe("GitService.stashCreate", () => {
  it("stashes with no options (push only)", async () => {
    const service = makeService();
    await service.stashCreate();
    expect(mockStash).toHaveBeenCalledWith(["push"]);
  });

  it("stashes with a message", async () => {
    const service = makeService();
    await service.stashCreate("my stash");
    expect(mockStash).toHaveBeenCalledWith(["push", "-m", "my stash"]);
  });

  it("stashes with --include-untracked", async () => {
    const service = makeService();
    await service.stashCreate(undefined, { includeUntracked: true });
    expect(mockStash).toHaveBeenCalledWith(["push", "--include-untracked"]);
  });

  it("stashes with --keep-index", async () => {
    const service = makeService();
    await service.stashCreate(undefined, { keepIndex: true });
    expect(mockStash).toHaveBeenCalledWith(["push", "--keep-index"]);
  });

  it("stashes with --staged flag", async () => {
    const service = makeService();
    await service.stashCreate(undefined, { staged: true });
    expect(mockStash).toHaveBeenCalledWith(["push", "--staged"]);
  });

  it("stashes with all options combined", async () => {
    const service = makeService();
    await service.stashCreate("full stash", {
      staged: true,
      keepIndex: true,
      includeUntracked: true,
    });
    expect(mockStash).toHaveBeenCalledWith([
      "push",
      "--staged",
      "--keep-index",
      "--include-untracked",
      "-m",
      "full stash",
    ]);
  });
});

describe("GitService.stashPop", () => {
  it("pops stash@{0} by default", async () => {
    const service = makeService();
    await service.stashPop();
    expect(mockStash).toHaveBeenCalledWith(["pop", "stash@{0}"]);
  });

  it("pops a specific stash index", async () => {
    const service = makeService();
    await service.stashPop(2);
    expect(mockStash).toHaveBeenCalledWith(["pop", "stash@{2}"]);
  });
});

describe("GitService.stashApply", () => {
  it("applies stash@{0} by default", async () => {
    const service = makeService();
    await service.stashApply();
    expect(mockStash).toHaveBeenCalledWith(["apply", "stash@{0}"]);
  });

  it("applies a specific stash index", async () => {
    const service = makeService();
    await service.stashApply(3);
    expect(mockStash).toHaveBeenCalledWith(["apply", "stash@{3}"]);
  });
});

describe("GitService.stashDrop", () => {
  it("drops stash@{0} by default", async () => {
    const service = makeService();
    await service.stashDrop();
    expect(mockStash).toHaveBeenCalledWith(["drop", "stash@{0}"]);
  });

  it("drops a specific stash index", async () => {
    const service = makeService();
    await service.stashDrop(1);
    expect(mockStash).toHaveBeenCalledWith(["drop", "stash@{1}"]);
  });
});

// ─── Tag Operations ───────────────────────────────────────────────────────────

describe("GitService.getTags", () => {
  it("returns empty array when there are no tags", async () => {
    const service = makeService();
    mockTags.mockResolvedValue({ all: [] });
    const result = await service.getTags();
    expect(result).toEqual([]);
  });

  it("maps tags to TagInfo objects", async () => {
    const service = makeService();
    mockTags.mockResolvedValue({ all: ["v1.0.0", "v2.0.0", "v2.1.0"] });
    const result = await service.getTags();
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "v1.0.0", hash: "" });
    expect(result[1]).toEqual({ name: "v2.0.0", hash: "" });
  });
});

describe("GitService.createTag", () => {
  it("creates a lightweight tag", async () => {
    const service = makeService();
    await service.createTag("v1.0.0", "abc123");
    expect(mockTag).toHaveBeenCalledWith(["v1.0.0", "abc123"]);
  });

  it("creates an annotated tag with a message", async () => {
    const service = makeService();
    await service.createTag("v1.0.0", "abc123", "Release 1.0.0");
    expect(mockTag).toHaveBeenCalledWith([
      "-a",
      "v1.0.0",
      "abc123",
      "-m",
      "Release 1.0.0",
    ]);
  });
});

describe("GitService.pushTag", () => {
  it("pushes tag to origin by default", async () => {
    const service = makeService();
    mockPush.mockResolvedValue(undefined);
    await service.pushTag("v1.0.0");
    expect(mockPush).toHaveBeenCalledWith("origin", "v1.0.0");
  });

  it("pushes tag to a specific remote", async () => {
    const service = makeService();
    await service.pushTag("v1.0.0", "upstream");
    expect(mockPush).toHaveBeenCalledWith("upstream", "v1.0.0");
  });
});

// ─── Remote Operations ────────────────────────────────────────────────────────

describe("GitService.getRemotes", () => {
  it("returns empty array when there are no remotes", async () => {
    const service = makeService();
    mockGetRemotes.mockResolvedValue([]);
    const result = await service.getRemotes();
    expect(result).toEqual([]);
  });

  it("maps remotes to RemoteInfo objects", async () => {
    const service = makeService();
    mockGetRemotes.mockResolvedValue([
      {
        name: "origin",
        refs: {
          fetch: "https://github.com/user/repo.git",
          push: "https://github.com/user/repo.git",
        },
      },
      {
        name: "upstream",
        refs: { fetch: "https://github.com/original/repo.git", push: "" },
      },
    ]);
    const result = await service.getRemotes();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "origin",
      fetchUrl: "https://github.com/user/repo.git",
      pushUrl: "https://github.com/user/repo.git",
    });
    expect(result[1]!.name).toBe("upstream");
    expect(result[1]!.pushUrl).toBe("");
  });
});

describe("GitService.addRemote", () => {
  it("calls git addRemote with name and url", async () => {
    const service = makeService();
    await service.addRemote("upstream", "https://github.com/original/repo.git");
    expect(mockAddRemote).toHaveBeenCalledWith(
      "upstream",
      "https://github.com/original/repo.git"
    );
  });
});

describe("GitService.removeRemote", () => {
  it("calls git removeRemote with name", async () => {
    const service = makeService();
    await service.removeRemote("upstream");
    expect(mockRemoveRemote).toHaveBeenCalledWith("upstream");
  });
});

// ─── Fetch/Pull Operations ────────────────────────────────────────────────────

describe("GitService.fetch", () => {
  it("fetches from all remotes when no remote is specified", async () => {
    const service = makeService();
    await service.fetch();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("fetches from a specific remote", async () => {
    const service = makeService();
    await service.fetch("origin");
    expect(mockFetch).toHaveBeenCalledWith("origin");
  });
});

describe("GitService.fetchAll", () => {
  it("calls git fetch --all", async () => {
    const service = makeService();
    await service.fetchAll();
    expect(mockFetch).toHaveBeenCalledWith(["--all"]);
  });
});

describe("GitService.fetchPrune", () => {
  it("calls git fetch --all --prune", async () => {
    const service = makeService();
    await service.fetchPrune();
    expect(mockFetch).toHaveBeenCalledWith(["--all", "--prune"]);
  });
});

describe("GitService.pull", () => {
  it("pulls with no args", async () => {
    const service = makeService();
    await service.pull();
    expect(mockPull).toHaveBeenCalledWith(undefined, undefined);
  });

  it("pulls from a specific remote and branch", async () => {
    const service = makeService();
    await service.pull("origin", "main");
    expect(mockPull).toHaveBeenCalledWith("origin", "main");
  });
});

describe("GitService.pullRebase", () => {
  it("pulls with --rebase option", async () => {
    const service = makeService();
    await service.pullRebase("origin", "main");
    expect(mockPull).toHaveBeenCalledWith("origin", "main", { "--rebase": null });
  });
});

describe("GitService.pullMerge", () => {
  it("pulls with --no-rebase option", async () => {
    const service = makeService();
    await service.pullMerge("origin", "main");
    expect(mockPull).toHaveBeenCalledWith("origin", "main", { "--no-rebase": null });
  });
});

// ─── Diff Operations ──────────────────────────────────────────────────────────

describe("GitService.getDiff", () => {
  it("gets unstaged diff with no args", async () => {
    const service = makeService();
    mockDiff.mockResolvedValue("diff output");
    const result = await service.getDiff();
    expect(mockDiff).toHaveBeenCalledWith([]);
    expect(result).toBe("diff output");
  });

  it("gets staged diff with --cached flag", async () => {
    const service = makeService();
    await service.getDiff(undefined, true);
    expect(mockDiff).toHaveBeenCalledWith(["--cached"]);
  });

  it("gets diff for a specific file", async () => {
    const service = makeService();
    await service.getDiff("src/app.ts");
    expect(mockDiff).toHaveBeenCalledWith(["--", "src/app.ts"]);
  });

  it("gets staged diff for a specific file", async () => {
    const service = makeService();
    await service.getDiff("src/app.ts", true);
    expect(mockDiff).toHaveBeenCalledWith(["--cached", "--", "src/app.ts"]);
  });
});

describe("GitService.getCommitDiff", () => {
  it("gets diff for a commit vs its parent", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("diff output");
    const result = await service.getCommitDiff("abc123");
    expect(mockRaw).toHaveBeenCalledWith(["diff", "abc123~1", "abc123"]);
    expect(result).toBe("diff output");
  });
});

describe("GitService.getCommitFiles", () => {
  it("returns empty array when no files changed", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getCommitFiles("abc123");
    expect(result).toEqual([]);
  });

  it("parses diff-tree numstat output correctly", async () => {
    const service = makeService();
    // First call: numstat; second call: name-status
    mockRaw
      .mockResolvedValueOnce("5\t3\tsrc/app.ts\n10\t0\tsrc/new.ts\n")
      .mockResolvedValueOnce("M\tsrc/app.ts\nA\tsrc/new.ts\n");

    const result = await service.getCommitFiles("abc123");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      path: "src/app.ts",
      status: "modified",
      additions: 5,
      deletions: 3,
    });
    expect(result[1]).toMatchObject({
      path: "src/new.ts",
      status: "added",
      additions: 10,
      deletions: 0,
    });
  });

  it("handles renamed files (R status)", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("0\t0\tnew-name.ts\n")
      .mockResolvedValueOnce("R\told-name.ts\tnew-name.ts\n");

    const result = await service.getCommitFiles("abc123");
    expect(result[0]!.status).toBe("renamed");
  });
});

describe("GitService.getRangeFiles", () => {
  it("returns files changed between two hashes", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("10\t5\tsrc/app.ts\n")
      .mockResolvedValueOnce("M\tsrc/app.ts\n");

    const result = await service.getRangeFiles("hash1", "hash2");
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("src/app.ts");
    expect(result[0]!.additions).toBe(10);
    expect(result[0]!.deletions).toBe(5);
    expect(result[0]!.status).toBe("modified");
  });

  it("returns empty array for empty diff", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getRangeFiles("hash1", "hash2");
    expect(result).toEqual([]);
  });
});

describe("GitService.getRangeFileDiff", () => {
  it("calls raw diff with the correct args", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("diff content");
    const result = await service.getRangeFileDiff("hash1", "hash2", "src/app.ts");
    expect(mockRaw).toHaveBeenCalledWith(["diff", "hash1", "hash2", "--", "src/app.ts"]);
    expect(result).toBe("diff content");
  });
});

describe("GitService.diffBranches", () => {
  it("calls raw diff with correct args and parses result", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("10\t3\tsrc/app.ts\n")
      .mockResolvedValueOnce("M\tsrc/app.ts\n");

    const result = await service.diffBranches("main", "feature");
    expect(mockRaw).toHaveBeenCalledWith(
      expect.arrayContaining([
        "diff",
        "--numstat",
        "--diff-filter=ACDMR",
        "-M",
        "main...feature",
      ])
    );
    expect(result.files).toHaveLength(1);
    expect(result.stats.additions).toBe(10);
    expect(result.stats.deletions).toBe(3);
    expect(result.stats.filesChanged).toBe(1);
  });

  it("returns empty result for empty diff", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.diffBranches("main", "feature");
    expect(result.files).toEqual([]);
    expect(result.stats.additions).toBe(0);
  });
});

describe("GitService.diffBranchFile", () => {
  it("diffs a specific file between branches", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("file diff");
    const result = await service.diffBranchFile("main", "feature", "src/app.ts");
    expect(mockRaw).toHaveBeenCalledWith(["diff", "main...feature", "--", "src/app.ts"]);
    expect(result).toBe("file diff");
  });
});

// ─── Log Operations ───────────────────────────────────────────────────────────

describe("GitService.getLog", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("   ");
    const result = await service.getLog();
    expect(result).toEqual([]);
  });

  it("calls raw with --all by default", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getLog();
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--all");
  });

  it("uses branchFilter pattern when provided", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getLog(100, 0, "feature");
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args.some((a) => a.includes("*feature*"))).toBe(true);
  });

  it("applies branchVisibility include mode", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getLog(100, 0, undefined, {
      mode: "include",
      branches: ["main", "develop"],
    });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("refs/heads/main");
    expect(args).toContain("refs/heads/develop");
  });

  it("applies branchVisibility exclude mode", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getLog(100, 0, undefined, { mode: "exclude", branches: ["hotfix"] });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--all");
    expect(args.some((a) => a.includes("--exclude=refs/heads/hotfix"))).toBe(true);
  });

  it("parses a commit record correctly", async () => {
    const service = makeService();
    const hash = "a".repeat(40);
    const record = [
      hash,
      "aaaaaaa",
      "feat: new feature",
      "Alice",
      "alice@example.com",
      "2026-01-01T10:00:00+00:00",
      "2026-01-01T10:00:00+00:00",
      "parent1 parent2",
      "HEAD -> main, origin/main",
      "feat: new feature\n\nBody text",
    ].join("\0");
    mockRaw.mockResolvedValue(`\x1e${record}`);
    const result = await service.getLog(10);
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe(hash);
    expect(result[0]!.subject).toBe("feat: new feature");
    expect(result[0]!.authorName).toBe("Alice");
    expect(result[0]!.parentHashes).toEqual(["parent1", "parent2"]);
    expect(result[0]!.refs).toHaveLength(2);
    expect(result[0]!.gravatarHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("includes remote ref in branchVisibility include", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getLog(100, 0, undefined, {
      mode: "include",
      branches: ["remotes/origin/main"],
    });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("remotes/origin/main");
  });
});

describe("GitService.getFileHistory", () => {
  it("returns empty array when no history", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getFileHistory("src/app.ts");
    expect(result).toEqual([]);
  });

  it("calls raw with --follow flag", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getFileHistory("src/app.ts", 50);
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--follow");
    expect(args).toContain("src/app.ts");
    expect(args).toContain("--max-count=50");
  });

  it("parses commit records correctly", async () => {
    const service = makeService();
    const hash = "b".repeat(40);
    const record = [
      hash,
      "bbbbbbb",
      "fix: bug",
      "Bob",
      "bob@b.com",
      "2026-01-01T00:00:00+00:00",
      "2026-01-01T00:00:00+00:00",
      "",
      "",
    ].join("\0");
    mockRaw.mockResolvedValue(`\x1e${record}`);
    const result = await service.getFileHistory("src/app.ts");
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe(hash);
    expect(result[0]!.authorName).toBe("Bob");
  });
});

describe("GitService.logRange", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("   ");
    const result = await service.logRange("main", "feature");
    expect(result).toEqual([]);
  });

  it("calls raw with correct range args", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.logRange("main", "feature");
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("main..feature");
  });
});

describe("GitService.getRebaseCommits", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getRebaseCommits("main");
    expect(result).toEqual([]);
  });

  it("calls raw with --reverse and correct range", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getRebaseCommits("main");
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--reverse");
    expect(args).toContain("main..HEAD");
  });
});

describe("GitService.getSquashPreview", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getSquashPreview("targetHash");
    expect(result).toEqual([]);
  });

  it("calls raw with correct range", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.getSquashPreview("abc123");
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("abc123..HEAD");
  });
});

// ─── Rebase Operations ────────────────────────────────────────────────────────

describe("GitService.rebase", () => {
  it("rebases onto a branch", async () => {
    const service = makeService();
    await service.rebase("main");
    expect(mockRebase).toHaveBeenCalledWith(["main"]);
  });
});

describe("GitService.rebaseAbort", () => {
  it("calls git rebase --abort", async () => {
    const service = makeService();
    await service.rebaseAbort();
    expect(mockRebase).toHaveBeenCalledWith(["--abort"]);
  });
});

describe("GitService.rebaseContinue", () => {
  it("calls git rebase --continue", async () => {
    const service = makeService();
    await service.rebaseContinue();
    expect(mockRebase).toHaveBeenCalledWith(["--continue"]);
  });
});

describe("GitService.rebaseSkip", () => {
  it("calls git rebase --skip", async () => {
    const service = makeService();
    await service.rebaseSkip();
    expect(mockRebase).toHaveBeenCalledWith(["--skip"]);
  });
});

describe("GitService.isRebaseInProgress", () => {
  it("returns false when no rebase sentinel files exist", async () => {
    const service = makeService();
    mockExistsSync.mockReturnValue(false);
    const result = await service.isRebaseInProgress();
    expect(result).toBe(false);
  });

  it("returns true when rebase-merge dir exists", async () => {
    const service = makeService();
    mockExistsSync.mockImplementation((p: string) => p.includes("rebase-merge"));
    const result = await service.isRebaseInProgress();
    expect(result).toBe(true);
  });

  it("returns true when rebase-apply dir exists", async () => {
    const service = makeService();
    mockExistsSync.mockImplementation((p: string) => p.includes("rebase-apply"));
    const result = await service.isRebaseInProgress();
    expect(result).toBe(true);
  });
});

describe("GitService.rebaseWithOptions", () => {
  it("rebases with basic onto option", async () => {
    const service = makeService();
    await service.rebaseWithOptions({ onto: "main" });
    expect(mockRebase).toHaveBeenCalledWith(["main"]);
  });

  it("rebases with interactive flag", async () => {
    const service = makeService();
    await service.rebaseWithOptions({ onto: "main", interactive: true });
    expect(mockRebase).toHaveBeenCalledWith(["-i", "main"]);
  });

  it("rebases with autosquash and autostash", async () => {
    const service = makeService();
    await service.rebaseWithOptions({ onto: "main", autosquash: true, autoStash: true });
    expect(mockRebase).toHaveBeenCalledWith(["--autosquash", "--autostash", "main"]);
  });

  it("rebases with a range", async () => {
    const service = makeService();
    await service.rebaseWithOptions({
      onto: "main",
      rangeFrom: "abc123",
      rangeTo: "def456",
    });
    expect(mockRebase).toHaveBeenCalledWith(["--onto", "main", "abc123", "def456"]);
  });

  it("rebases with preserveMerges", async () => {
    const service = makeService();
    await service.rebaseWithOptions({ onto: "main", preserveMerges: true });
    expect(mockRebase).toHaveBeenCalledWith(["--rebase-merges", "main"]);
  });

  it("writes todo files and uses GIT_SEQUENCE_EDITOR for interactive rebase with todoEntries", async () => {
    const service = makeService();
    await service.rebaseWithOptions({
      onto: "main",
      interactive: true,
      todoEntries: [
        { action: "pick", hash: "abc123" },
        { action: "squash", hash: "def456" },
      ],
    });
    // Should have written the todo file and editor script
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockEnv).toHaveBeenCalledWith("GIT_SEQUENCE_EDITOR", expect.any(String));
    expect(mockRebase).toHaveBeenCalledWith(expect.arrayContaining(["-i", "main"]));
  });
});

describe("GitService.interactiveRebase", () => {
  it("writes a todo file and runs rebase with GIT_SEQUENCE_EDITOR", async () => {
    const service = makeService();
    await service.interactiveRebase("main", [
      { action: "pick", hash: "abc" },
      { action: "drop", hash: "def" },
    ]);
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockEnv).toHaveBeenCalledWith("GIT_SEQUENCE_EDITOR", expect.any(String));
    expect(mockRebase).toHaveBeenCalledWith(["-i", "main"]);
  });
});

// ─── Reset/Squash Operations ──────────────────────────────────────────────────

describe("GitService.resetToCommit", () => {
  it("resets --soft", async () => {
    const service = makeService();
    await service.resetToCommit("abc123", "soft");
    expect(mockReset).toHaveBeenCalledWith(["--soft", "abc123"]);
  });

  it("resets --mixed", async () => {
    const service = makeService();
    await service.resetToCommit("abc123", "mixed");
    expect(mockReset).toHaveBeenCalledWith(["--mixed", "abc123"]);
  });

  it("resets --hard", async () => {
    const service = makeService();
    await service.resetToCommit("abc123", "hard");
    expect(mockReset).toHaveBeenCalledWith(["--hard", "abc123"]);
  });
});

describe("GitService.squashCommits", () => {
  it("soft-resets and re-commits", async () => {
    const service = makeService();
    mockReset.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue({ commit: "newHash" });
    await service.squashCommits({ targetHash: "abc123", message: "combined" });
    expect(mockReset).toHaveBeenCalledWith(["--soft", "abc123~1"]);
    expect(mockCommit).toHaveBeenCalledWith("combined");
  });
});

// ─── Cherry-Pick Operations ───────────────────────────────────────────────────

describe("GitService.cherryPick", () => {
  it("cherry-picks a commit by hash", async () => {
    const service = makeService();
    await service.cherryPick("abc123");
    expect(mockRaw).toHaveBeenCalledWith(["cherry-pick", "abc123"]);
  });
});

// ─── Discard Operations ───────────────────────────────────────────────────────

describe("GitService.discard", () => {
  it("checks out tracked paths", async () => {
    const service = makeService();
    mockStatus.mockResolvedValue({ not_added: [], files: [] });
    await service.discard(["src/app.ts"]);
    expect(mockCheckout).toHaveBeenCalledWith(["--", "src/app.ts"]);
  });

  it("cleans untracked paths", async () => {
    const service = makeService();
    mockStatus.mockResolvedValue({ not_added: ["new-file.ts"], files: [] });
    await service.discard(["new-file.ts"]);
    expect(mockClean).toHaveBeenCalledWith("f", ["--", "new-file.ts"]);
  });

  it("handles mixed tracked and untracked paths", async () => {
    const service = makeService();
    mockStatus.mockResolvedValue({ not_added: ["new-file.ts"], files: [] });
    await service.discard(["src/app.ts", "new-file.ts"]);
    expect(mockCheckout).toHaveBeenCalledWith(["--", "src/app.ts"]);
    expect(mockClean).toHaveBeenCalledWith("f", ["--", "new-file.ts"]);
  });
});

describe("GitService.discardAll", () => {
  it("checks out all and cleans", async () => {
    const service = makeService();
    await service.discardAll();
    expect(mockCheckout).toHaveBeenCalledWith(["."]);
    expect(mockClean).toHaveBeenCalledWith("fd");
  });
});

// ─── Stage/Unstage Operations ─────────────────────────────────────────────────

describe("GitService.unstage", () => {
  it("calls git reset HEAD with the given paths", async () => {
    const service = makeService();
    await service.unstage(["src/app.ts"]);
    expect(mockReset).toHaveBeenCalledWith(["HEAD", "--", "src/app.ts"]);
  });
});

describe("GitService.stageLines", () => {
  it("writes a temp patch file and applies it cached", async () => {
    const service = makeService();
    await service.stageLines("diff content");
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("tmp-patch.diff"),
      "diff content"
    );
    expect(mockApplyPatch).toHaveBeenCalledWith(
      expect.stringContaining("tmp-patch.diff"),
      ["--cached"]
    );
  });
});

describe("GitService.unstageLines", () => {
  it("writes a temp patch file and applies it in reverse", async () => {
    const service = makeService();
    await service.unstageLines("diff content");
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("tmp-patch.diff"),
      "diff content"
    );
    expect(mockApplyPatch).toHaveBeenCalledWith(
      expect.stringContaining("tmp-patch.diff"),
      ["--cached", "--reverse"]
    );
  });
});

// ─── Config Operations ────────────────────────────────────────────────────────

describe("GitService.getConfig", () => {
  it("reads a local config key", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("Alice\n");
    const result = await service.getConfig("user.name");
    expect(mockRaw).toHaveBeenCalledWith(["config", "user.name"]);
    expect(result).toBe("Alice");
  });

  it("reads a global config key", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("alice@example.com\n");
    const result = await service.getConfig("user.email", true);
    expect(mockRaw).toHaveBeenCalledWith(["config", "--global", "user.email"]);
    expect(result).toBe("alice@example.com");
  });

  it("returns empty string when config key is not found", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("exit code 1"));
    const result = await service.getConfig("user.unknown");
    expect(result).toBe("");
  });
});

describe("GitService.setConfig", () => {
  it("sets a local config key", async () => {
    const service = makeService();
    await service.setConfig("user.name", "Alice");
    expect(mockRaw).toHaveBeenCalledWith(["config", "user.name", "Alice"]);
  });

  it("sets a global config key", async () => {
    const service = makeService();
    await service.setConfig("user.name", "Alice", true);
    expect(mockRaw).toHaveBeenCalledWith(["config", "--global", "user.name", "Alice"]);
  });
});

describe("GitService.listConfig", () => {
  it("returns empty object for empty config", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.listConfig();
    expect(result).toEqual({});
  });

  it("parses config key=value pairs", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("user.name=Alice\nuser.email=alice@example.com\n");
    const result = await service.listConfig();
    expect(result).toEqual({ "user.name": "Alice", "user.email": "alice@example.com" });
  });

  it("reads global config when flag is set", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.listConfig(true);
    expect(mockRaw).toHaveBeenCalledWith(["config", "--global", "--list"]);
  });
});

// ─── Blame Operations ─────────────────────────────────────────────────────────

describe("GitService.blame", () => {
  it("calls git blame --porcelain for the file", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("blame output");
    const result = await service.blame("src/app.ts");
    expect(mockRaw).toHaveBeenCalledWith(["blame", "--porcelain", "src/app.ts"]);
    expect(result).toBe("blame output");
  });
});

// ─── Show File ────────────────────────────────────────────────────────────────

describe("GitService.showFile", () => {
  it("shows file content at a specific commit", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("file contents");
    const result = await service.showFile("abc123", "src/app.ts");
    expect(mockRaw).toHaveBeenCalledWith(["show", "abc123:src/app.ts"]);
    expect(result).toBe("file contents");
  });
});

// ─── Commit Details ───────────────────────────────────────────────────────────

describe("GitService.getCommitDetails", () => {
  it("parses commit show output", async () => {
    const hash = "a".repeat(40);
    const parts = [
      hash,
      "aaaaaaa",
      "feat: test",
      "body text",
      "Alice",
      "alice@a.com",
      "2026-01-01T00:00:00+00:00",
      "2026-01-01T00:00:00+00:00",
      "parent1",
      "HEAD -> main",
    ];
    mockRaw.mockResolvedValue(parts.join("\0"));
    const service = makeService();
    const result = await service.getCommitDetails(hash);
    expect(result.hash).toBe(hash);
    expect(result.subject).toBe("feat: test");
    expect(result.authorName).toBe("Alice");
    expect(result.gravatarHash).toMatch(/^[a-f0-9]{32}$/);
  });
});

// ─── Submodule Operations ─────────────────────────────────────────────────────

describe("GitService.getSubmodules", () => {
  it("returns empty array when there are no submodules", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getSubmodules();
    expect(result).toEqual([]);
  });

  it("parses submodule status lines", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue(" abc1234 libs/mylib (v1.0.0)\n");
    const result = await service.getSubmodules();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("libs/mylib");
    expect(result[0]!.hash).toBe("abc1234");
  });

  it("handles submodules with + prefix (modified)", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("+abc1234 libs/mylib\n");
    const result = await service.getSubmodules();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("libs/mylib");
  });
});

describe("GitService.addSubmodule", () => {
  it("adds a submodule by URL", async () => {
    const service = makeService();
    await service.addSubmodule("https://github.com/user/lib.git");
    expect(mockRaw).toHaveBeenCalledWith([
      "submodule",
      "add",
      "https://github.com/user/lib.git",
    ]);
  });

  it("adds a submodule with a custom path", async () => {
    const service = makeService();
    await service.addSubmodule("https://github.com/user/lib.git", "libs/lib");
    expect(mockRaw).toHaveBeenCalledWith([
      "submodule",
      "add",
      "https://github.com/user/lib.git",
      "libs/lib",
    ]);
  });
});

describe("GitService.submoduleUpdate", () => {
  it("updates submodules recursively", async () => {
    const service = makeService();
    await service.submoduleUpdate(false);
    expect(mockRaw).toHaveBeenCalledWith(["submodule", "update", "--recursive"]);
  });

  it("initializes and updates submodules recursively when init=true", async () => {
    const service = makeService();
    await service.submoduleUpdate(true);
    expect(mockRaw).toHaveBeenCalledWith([
      "submodule",
      "update",
      "--init",
      "--recursive",
    ]);
  });
});

describe("GitService.submoduleSync", () => {
  it("syncs submodules recursively by default", async () => {
    const service = makeService();
    await service.submoduleSync();
    expect(mockRaw).toHaveBeenCalledWith(["submodule", "sync", "--recursive"]);
  });

  it("syncs without recursive when recursive=false", async () => {
    const service = makeService();
    await service.submoduleSync(false);
    expect(mockRaw).toHaveBeenCalledWith(["submodule", "sync"]);
  });
});

describe("GitService.submoduleDeinit", () => {
  it("deinits a submodule", async () => {
    const service = makeService();
    await service.submoduleDeinit("libs/mylib");
    expect(mockRaw).toHaveBeenCalledWith(["submodule", "deinit", "libs/mylib"]);
  });

  it("force-deinits a submodule", async () => {
    const service = makeService();
    await service.submoduleDeinit("libs/mylib", true);
    expect(mockRaw).toHaveBeenCalledWith(["submodule", "deinit", "-f", "libs/mylib"]);
  });
});

// ─── Grep ─────────────────────────────────────────────────────────────────────

describe("GitService.grep", () => {
  it("returns empty result for no matches", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.grep("pattern");
    expect(result).toEqual({ matches: [], totalCount: 0 });
  });

  it("treats exit code 1 as no matches (not an error)", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue({ message: "Command failed: git grep exit code 1" });
    const result = await service.grep("nonexistent");
    expect(result).toEqual({ matches: [], totalCount: 0 });
  });

  it("parses grep output with file headings", async () => {
    const service = makeService();
    const output =
      "src/app.ts\n5:hello world\n10:another hello\n\nsrc/utils.ts\n3:hello there\n";
    mockRaw.mockResolvedValue(output);
    const result = await service.grep("hello");
    expect(result.totalCount).toBe(3);
    expect(result.matches[0]).toEqual({
      file: "src/app.ts",
      line: 5,
      text: "hello world",
    });
    expect(result.matches[1]).toEqual({
      file: "src/app.ts",
      line: 10,
      text: "another hello",
    });
    expect(result.matches[2]).toEqual({
      file: "src/utils.ts",
      line: 3,
      text: "hello there",
    });
  });

  it("adds -i flag when ignoreCase is true", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.grep("pattern", { ignoreCase: true });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("-i");
  });

  it("does NOT add -F flag when regex is true (uses regex mode)", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.grep("pattern", { regex: true });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).not.toContain("-F");
  });

  it("adds -F flag when regex is false (fixed-string mode)", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.grep("pattern", { regex: false });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("-F");
  });

  it("adds -w flag for whole word matching", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.grep("pattern", { wholeWord: true });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("-w");
  });

  it("adds --max-count when specified", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await service.grep("pattern", { maxCount: 50 });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--max-count=50");
  });

  it("rethrows non-exit-code-1 errors", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("Fatal: not a git repo"));
    await expect(service.grep("pattern")).rejects.toThrow("Fatal");
  });
});

// ─── Undo Operations ──────────────────────────────────────────────────────────

describe("GitService.getUndoHistory", () => {
  it("returns empty array for empty reflog", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getUndoHistory();
    expect(result).toEqual([]);
  });

  it("parses reflog entries correctly", async () => {
    const service = makeService();
    const SEP = "\x1e";
    const line = [
      "abc123full",
      "HEAD@{0}",
      "commit: feat: new",
      "feat: new",
      "2026-01-01 10:00:00 +0000",
    ].join(SEP);
    mockRaw.mockResolvedValue(line);
    const result = await service.getUndoHistory(10);
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe("abc123full");
    expect(result[0]!.action).toBe("commit: feat: new");
  });
});

describe("GitService.undoToReflog", () => {
  it("calls git reset --hard HEAD@{index}", async () => {
    const service = makeService();
    await service.undoToReflog(3);
    expect(mockRaw).toHaveBeenCalledWith(["reset", "--hard", "HEAD@{3}"]);
  });
});

// ─── Worktree Operations ──────────────────────────────────────────────────────

describe("GitService.worktreeList", () => {
  it("returns empty array when no worktrees", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.worktreeList();
    expect(result).toEqual([]);
  });

  it("parses worktree --porcelain output", async () => {
    const service = makeService();
    const output = [
      "worktree /main/repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /worktrees/feature",
      "HEAD def456",
      "branch refs/heads/feature",
    ].join("\n");
    mockRaw.mockResolvedValue(output);
    const result = await service.worktreeList();
    expect(result).toHaveLength(2);
    expect(result[0]!.path).toBe("/main/repo");
    expect(result[0]!.branch).toBe("main");
    expect(result[0]!.head).toBe("abc123");
    expect(result[0]!.isMain).toBe(true);
    expect(result[1]!.branch).toBe("feature");
    expect(result[1]!.isMain).toBe(false);
  });

  it("marks bare worktrees correctly", async () => {
    const service = makeService();
    const output = ["worktree /bare/repo", "HEAD abc123", "bare"].join("\n");
    mockRaw.mockResolvedValue(output);
    const result = await service.worktreeList();
    expect(result[0]!.isBare).toBe(true);
  });
});

describe("GitService.worktreeAdd", () => {
  it("adds a worktree with a path only", async () => {
    const service = makeService();
    await service.worktreeAdd("/path/to/worktree");
    expect(mockRaw).toHaveBeenCalledWith(["worktree", "add", "/path/to/worktree"]);
  });

  it("adds a worktree with a branch", async () => {
    const service = makeService();
    await service.worktreeAdd("/path/to/worktree", "feature");
    expect(mockRaw).toHaveBeenCalledWith([
      "worktree",
      "add",
      "/path/to/worktree",
      "feature",
    ]);
  });

  it("creates a new branch when createBranch=true", async () => {
    const service = makeService();
    await service.worktreeAdd("/path/to/worktree", "new-feature", true);
    expect(mockRaw).toHaveBeenCalledWith([
      "worktree",
      "add",
      "-b",
      "new-feature",
      "/path/to/worktree",
    ]);
  });
});

describe("GitService.worktreeRemove", () => {
  it("removes a worktree", async () => {
    const service = makeService();
    await service.worktreeRemove("/path/to/worktree");
    expect(mockRaw).toHaveBeenCalledWith(["worktree", "remove", "/path/to/worktree"]);
  });

  it("force-removes a worktree", async () => {
    const service = makeService();
    await service.worktreeRemove("/path/to/worktree", true);
    expect(mockRaw).toHaveBeenCalledWith([
      "worktree",
      "remove",
      "--force",
      "/path/to/worktree",
    ]);
  });
});

// ─── Patch Operations ─────────────────────────────────────────────────────────

describe("GitService.formatPatch", () => {
  it("generates patch files for each hash", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("/output/0001-fix.patch\n");
    const result = await service.formatPatch(["abc123", "def456"], "/output");
    expect(mockRaw).toHaveBeenCalledTimes(2);
    expect(mockRaw).toHaveBeenCalledWith([
      "format-patch",
      "-1",
      "abc123",
      "-o",
      "/output",
    ]);
    expect(result).toContain("/output/0001-fix.patch");
  });
});

describe("GitService.applyPatch", () => {
  it("applies a patch file", async () => {
    const service = makeService();
    await service.applyPatch("/path/to/patch.diff");
    expect(mockRaw).toHaveBeenCalledWith(["apply", "/path/to/patch.diff"]);
  });

  it("applies a patch with --check flag", async () => {
    const service = makeService();
    await service.applyPatch("/path/to/patch.diff", true);
    expect(mockRaw).toHaveBeenCalledWith(["apply", "--check", "/path/to/patch.diff"]);
  });
});

describe("GitService.previewPatch", () => {
  it("previews a patch with --stat", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("stats output");
    const result = await service.previewPatch("/path/to/patch.diff");
    expect(mockRaw).toHaveBeenCalledWith(["apply", "--stat", "/path/to/patch.diff"]);
    expect(result).toBe("stats output");
  });
});

// ─── Git Notes ────────────────────────────────────────────────────────────────

describe("GitService.getNote", () => {
  it("returns note content for a commit", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("My note");
    const result = await service.getNote("abc123");
    expect(mockRaw).toHaveBeenCalledWith(["notes", "show", "abc123"]);
    expect(result).toBe("My note");
  });

  it("returns empty string when note does not exist", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("No note found"));
    const result = await service.getNote("abc123");
    expect(result).toBe("");
  });
});

describe("GitService.addNote", () => {
  it("adds a note to a commit", async () => {
    const service = makeService();
    await service.addNote("abc123", "This is a note");
    expect(mockRaw).toHaveBeenCalledWith([
      "notes",
      "add",
      "-f",
      "-m",
      "This is a note",
      "abc123",
    ]);
  });
});

describe("GitService.removeNote", () => {
  it("removes a note from a commit", async () => {
    const service = makeService();
    await service.removeNote("abc123");
    expect(mockRaw).toHaveBeenCalledWith(["notes", "remove", "abc123"]);
  });
});

// ─── Bisect Operations ────────────────────────────────────────────────────────

describe("GitService.bisectStart", () => {
  it("starts bisect without args", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("Bisecting: ...");
    await service.bisectStart();
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "start"]);
  });

  it("starts bisect with bad and good commits", async () => {
    const service = makeService();
    await service.bisectStart("badHash", "goodHash");
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "start", "badHash", "goodHash"]);
  });
});

describe("GitService.bisectGood", () => {
  it("marks current HEAD as good", async () => {
    const service = makeService();
    await service.bisectGood();
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "good"]);
  });

  it("marks a specific ref as good", async () => {
    const service = makeService();
    await service.bisectGood("abc123");
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "good", "abc123"]);
  });
});

describe("GitService.bisectBad", () => {
  it("marks current HEAD as bad", async () => {
    const service = makeService();
    await service.bisectBad();
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "bad"]);
  });
});

describe("GitService.bisectSkip", () => {
  it("skips current HEAD", async () => {
    const service = makeService();
    await service.bisectSkip();
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "skip"]);
  });
});

describe("GitService.bisectReset", () => {
  it("resets bisect state", async () => {
    const service = makeService();
    await service.bisectReset();
    expect(mockRaw).toHaveBeenCalledWith(["bisect", "reset"]);
  });
});

describe("GitService.bisectLog", () => {
  it("returns bisect log output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("# good: [abc123]");
    const result = await service.bisectLog();
    expect(result).toBe("# good: [abc123]");
  });

  it("returns empty string on error", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("No bisect in progress"));
    const result = await service.bisectLog();
    expect(result).toBe("");
  });
});

describe("GitService.bisectStatus", () => {
  it("returns active=false when no bisect log", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.bisectStatus();
    expect(result.active).toBe(false);
    expect(result.good).toEqual([]);
    expect(result.bad).toEqual([]);
  });

  it("parses good and bad commits from bisect log", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce(
        "# good: [abc123def456]\n# bad: [def456abc123]\n# good: [aabbccdd1122]\n"
      )
      .mockResolvedValueOnce("currentHead\n");
    const result = await service.bisectStatus();
    expect(result.active).toBe(true);
    expect(result.good).toContain("abc123def456");
    expect(result.good).toContain("aabbccdd1122");
    expect(result.bad).toContain("def456abc123");
    expect(result.current).toBe("currentHead");
  });
});

// ─── LFS Operations ───────────────────────────────────────────────────────────

describe("GitService.lfsInstall", () => {
  it("calls git lfs install", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("Git LFS initialized.");
    const result = await service.lfsInstall();
    expect(mockRaw).toHaveBeenCalledWith(["lfs", "install"]);
    expect(result).toBe("Git LFS initialized.");
  });
});

describe("GitService.lfsTrack", () => {
  it("tracks a file pattern with LFS", async () => {
    const service = makeService();
    await service.lfsTrack("*.psd");
    expect(mockRaw).toHaveBeenCalledWith(["lfs", "track", "*.psd"]);
  });
});

describe("GitService.lfsUntrack", () => {
  it("untracks a file pattern", async () => {
    const service = makeService();
    await service.lfsUntrack("*.psd");
    expect(mockRaw).toHaveBeenCalledWith(["lfs", "untrack", "*.psd"]);
  });
});

describe("GitService.lfsListTracked", () => {
  it("returns empty array when nothing is tracked", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("Listing tracked patterns\n");
    const result = await service.lfsListTracked();
    expect(result).toEqual([]);
  });

  it("parses tracked patterns", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue(
      "Listing tracked patterns\n    *.psd (gitattributes)\n    *.zip (gitattributes)\n"
    );
    const result = await service.lfsListTracked();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ pattern: "*.psd", filter: "gitattributes" });
    expect(result[1]).toEqual({ pattern: "*.zip", filter: "gitattributes" });
  });
});

describe("GitService.lfsStatus", () => {
  it("returns installed=false when git lfs is not available", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("git: 'lfs' is not a git command"));
    const result = await service.lfsStatus();
    expect(result.installed).toBe(false);
    expect(result.version).toBe("");
    expect(result.tracked).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it("returns installed=true with version when LFS is available", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("git-lfs/3.4.0 (GitHub; linux amd64; go 1.21.0)\n") // lfs version
      .mockResolvedValueOnce("") // lfs track
      .mockResolvedValueOnce(""); // lfs ls-files
    const result = await service.lfsStatus();
    expect(result.installed).toBe(true);
    expect(result.version).toBe("git-lfs/3.4.0 (GitHub; linux amd64; go 1.21.0)");
  });
});

describe("GitService.lfsInfo", () => {
  it("parses endpoint and storagePath from lfs env output", async () => {
    const service = makeService();
    // The lfsInfo regex is: /Endpoint[^=]+=\s*(.+)/ and /LocalMediaDir[^=]+=\s*(.+)/
    // For "Endpoint (auth=basic) = https://..." the [^=]+ matches " (auth" then = then "basic) = https://..."
    // So we use a simpler format without nested = to get a clean capture
    mockRaw.mockResolvedValue(
      "Endpoint = https://github.com/user/repo.git/info/lfs\nLocalMediaDir = /home/user/.git/lfs/objects\n"
    );
    const result = await service.lfsInfo();
    expect(result.endpoint).toBe("https://github.com/user/repo.git/info/lfs");
    expect(result.storagePath).toBe("/home/user/.git/lfs/objects");
  });
});

// ─── Archive ──────────────────────────────────────────────────────────────────

describe("GitService.archive", () => {
  it("archives as zip", async () => {
    const service = makeService();
    await service.archive("main", "/output/archive.zip", "zip");
    expect(mockRaw).toHaveBeenCalledWith([
      "archive",
      "--format",
      "zip",
      "-o",
      "/output/archive.zip",
      "main",
    ]);
  });

  it("archives as tar.gz", async () => {
    const service = makeService();
    await service.archive("main", "/output/archive.tar.gz", "tar.gz");
    expect(mockRaw).toHaveBeenCalledWith([
      "archive",
      "--format",
      "tar.gz",
      "-o",
      "/output/archive.tar.gz",
      "main",
    ]);
  });
});

// ─── GPG Signature ────────────────────────────────────────────────────────────

describe("GitService.verifyCommitSignature", () => {
  it("returns signed=true for a valid signature (G status)", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("G\0ABCDEF1234\0Alice <alice@example.com>\0Good signature");
    const result = await service.verifyCommitSignature("abc123");
    expect(result.signed).toBe(true);
    expect(result.key).toBe("ABCDEF1234");
  });

  it("returns signed=false for no signature (N status)", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("N\0\0\0");
    const result = await service.verifyCommitSignature("abc123");
    expect(result.signed).toBe(false);
  });

  it("returns signed=false on error", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("git error"));
    const result = await service.verifyCommitSignature("abc123");
    expect(result.signed).toBe(false);
  });

  it("returns signed=true for U (untrusted) and E (expired) statuses", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("U\0KEY\0Signer\0")
      .mockResolvedValueOnce("E\0KEY\0Signer\0");
    const res1 = await service.verifyCommitSignature("hash1");
    expect(res1.signed).toBe(true);
  });
});

// ─── Provider Detection ───────────────────────────────────────────────────────

describe("GitService.detectProvider", () => {
  it("detects GitHub SSH remote", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("git@github.com:user/repo.git\n");
    const result = await service.detectProvider();
    expect(result.provider).toBe("github");
    expect(result.owner).toBe("user");
    expect(result.repo).toBe("repo");
  });

  it("detects GitHub HTTPS remote", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("https://github.com/user/repo.git\n");
    const result = await service.detectProvider();
    expect(result.provider).toBe("github");
  });

  it("detects GitLab remote", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("https://gitlab.com/user/repo.git\n");
    const result = await service.detectProvider();
    expect(result.provider).toBe("gitlab");
    expect(result.owner).toBe("user");
  });

  it("returns unknown for unrecognized remote", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("https://bitbucket.org/user/repo.git\n");
    const result = await service.detectProvider();
    expect(result.provider).toBe("unknown");
  });

  it("returns unknown when no remote is configured", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.detectProvider();
    expect(result.provider).toBe("unknown");
  });
});

// ─── Conflict Resolution ──────────────────────────────────────────────────────

describe("GitService.getConflictedFiles", () => {
  it("returns empty array when there are no conflicts", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getConflictedFiles();
    expect(result).toEqual([]);
  });

  it("parses conflicted files with reason from status", async () => {
    const service = makeService();
    // First raw call: diff --name-only --diff-filter=U
    // Second raw call: status --porcelain
    mockRaw
      .mockResolvedValueOnce("src/app.ts\n")
      .mockResolvedValueOnce("UU src/app.ts\n");
    const result = await service.getConflictedFiles();
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("src/app.ts");
    expect(result[0]!.reason).toBe("both-modified");
  });

  it("detects both-added conflict reason", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce("new-file.ts\n")
      .mockResolvedValueOnce("AA new-file.ts\n");
    const result = await service.getConflictedFiles();
    expect(result[0]!.reason).toBe("both-added");
  });

  it("detects deleted-by-us conflict reason", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("file.ts\n").mockResolvedValueOnce("DU file.ts\n");
    const result = await service.getConflictedFiles();
    expect(result[0]!.reason).toBe("deleted-by-us");
  });

  it("detects deleted-by-them conflict reason", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("file.ts\n").mockResolvedValueOnce("UD file.ts\n");
    const result = await service.getConflictedFiles();
    expect(result[0]!.reason).toBe("deleted-by-them");
  });

  it("detects added-by-us conflict reason", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("file.ts\n").mockResolvedValueOnce("AU file.ts\n");
    const result = await service.getConflictedFiles();
    expect(result[0]!.reason).toBe("added-by-us");
  });

  it("detects added-by-them conflict reason", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("file.ts\n").mockResolvedValueOnce("UA file.ts\n");
    const result = await service.getConflictedFiles();
    expect(result[0]!.reason).toBe("added-by-them");
  });
});

describe("GitService.resolveConflict", () => {
  it("calls git add on the conflicted file", async () => {
    const service = makeService();
    await service.resolveConflict("src/app.ts");
    expect(mockAdd).toHaveBeenCalledWith("src/app.ts");
  });
});

describe("GitService.saveMergedFile", () => {
  it("writes merged content to disk", async () => {
    const service = makeService();
    await service.saveMergedFile("src/app.ts", "merged content");
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/fake/repo/src/app.ts",
      "merged content",
      "utf-8"
    );
  });
});

// ─── Timeline & Churn ─────────────────────────────────────────────────────────

describe("GitService.getTimeline", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getTimeline("week");
    expect(result).toEqual([]);
  });

  it("counts commits per period and sorts ascending", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("2026-10\n2026-11\n2026-10\n2026-12\n");
    const result = await service.getTimeline("month");
    expect(result).toEqual([
      { date: "2026-10", count: 2 },
      { date: "2026-11", count: 1 },
      { date: "2026-12", count: 1 },
    ]);
  });
});

describe("GitService.getChurn", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getChurn("week");
    expect(result).toEqual([]);
  });

  it("parses numstat output grouped by date", async () => {
    const service = makeService();
    const output =
      "DATE:2026-10\n10\t5\tsrc/app.ts\n3\t1\tsrc/utils.ts\nDATE:2026-11\n2\t0\tsrc/new.ts\n";
    mockRaw.mockResolvedValue(output);
    const result = await service.getChurn("month");
    expect(result).toHaveLength(2);
    const oct = result.find((e) => e.date === "2026-10")!;
    expect(oct.additions).toBe(13);
    expect(oct.deletions).toBe(6);
  });
});

describe("GitService.getContributorsTimeline", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getContributorsTimeline("month");
    expect(result).toEqual([]);
  });

  it("counts commits per author per period", async () => {
    const service = makeService();
    const SEP = "\x1e";
    const output = [
      `Alice${SEP}2026-10`,
      `Bob${SEP}2026-10`,
      `Alice${SEP}2026-10`,
      `Alice${SEP}2026-11`,
    ].join("\n");
    mockRaw.mockResolvedValue(output);
    const result = await service.getContributorsTimeline("month");
    const alice2610 = result.find((e) => e.author === "Alice" && e.date === "2026-10");
    expect(alice2610?.count).toBe(2);
    const bob2610 = result.find((e) => e.author === "Bob" && e.date === "2026-10");
    expect(bob2610?.count).toBe(1);
  });
});

// ─── Reflog ───────────────────────────────────────────────────────────────────

describe("GitService.getReflog", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getReflog();
    expect(result).toEqual([]);
  });

  it("parses reflog entries correctly", async () => {
    const service = makeService();
    const SEP = "‖";
    const line = [
      `abc123full`,
      `abc123f`,
      `HEAD@{0}`,
      `commit: feat: test`,
      `feat: test`,
      `2026-01-01 10:00:00 +0000`,
    ].join(SEP);
    mockRaw.mockResolvedValue(line);
    const result = await service.getReflog(5);
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe("abc123full");
    expect(result[0]!.abbreviatedHash).toBe("abc123f");
    expect(result[0]!.action).toBe("commit: feat: test");
    expect(result[0]!.selector).toBe("HEAD@{0}");
  });
});

// ─── Changelog Operations ─────────────────────────────────────────────────────

describe("GitService.getTagsBefore", () => {
  it("returns sorted tags merged into the given hash", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("v2.0.0\nv1.0.0\nv1.1.0\n");
    const result = await service.getTagsBefore("abc123");
    expect(result).toEqual(["v2.0.0", "v1.0.0", "v1.1.0"]);
    expect(mockRaw).toHaveBeenCalledWith([
      "tag",
      "--merged",
      "abc123",
      "--sort=-creatordate",
    ]);
  });

  it("returns empty array when there are no tags", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("\n");
    const result = await service.getTagsBefore("abc123");
    expect(result).toEqual([]);
  });

  it("throws for invalid ref (starts with -)", async () => {
    const service = makeService();
    await expect(service.getTagsBefore("-bad-ref")).rejects.toThrow("Invalid git ref");
  });
});

describe("GitService.getChangelogCommits", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getChangelogCommits("v1.0.0", "v2.0.0");
    expect(result).toEqual([]);
  });

  it("parses changelog commit records", async () => {
    const service = makeService();
    const FIELD_SEP = "\x00";
    const RECORD_SEP = "\x1e";
    const record = [
      "abc123full",
      "abc123f",
      "feat: add feature",
      "Detailed body",
      "Alice",
      "2026-01-01T00:00:00+00:00",
    ].join(FIELD_SEP);
    mockRaw.mockResolvedValue(record + RECORD_SEP);
    const result = await service.getChangelogCommits("v1.0.0", "v2.0.0");
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe("abc123full");
    expect(result[0]!.subject).toBe("feat: add feature");
    expect(result[0]!.authorName).toBe("Alice");
  });

  it("validates ref and throws for invalid ref", async () => {
    const service = makeService();
    await expect(service.getChangelogCommits("-invalid", "v2.0.0")).rejects.toThrow(
      "Invalid git ref"
    );
  });
});

// ─── getIgnoredFiles ──────────────────────────────────────────────────────────

describe("GitService.getIgnoredFiles", () => {
  it("returns empty array when nothing is ignored", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getIgnoredFiles();
    expect(result).toEqual([]);
  });

  it("returns ignored file paths", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("!! node_modules/\n!! dist/\n!! .env\n");
    const result = await service.getIgnoredFiles();
    expect(result).toEqual(["node_modules/", "dist/", ".env"]);
  });
});

// ─── getTreeFiles ─────────────────────────────────────────────────────────────

describe("GitService.getTreeFiles", () => {
  it("returns empty array for empty output", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getTreeFiles("abc123");
    expect(result).toEqual([]);
  });

  it("parses ls-tree output into file list", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("src/app.ts\nsrc/utils.ts\nREADME.md\n");
    const result = await service.getTreeFiles("abc123");
    expect(result).toEqual(["src/app.ts", "src/utils.ts", "README.md"]);
    expect(mockRaw).toHaveBeenCalledWith(["ls-tree", "-r", "--name-only", "abc123"]);
  });
});

// ─── merge (simple) ───────────────────────────────────────────────────────────

describe("GitService.merge", () => {
  it("merges a branch and returns the result", async () => {
    const service = makeService();
    mockMerge.mockResolvedValue({ result: "Already up-to-date." });
    const result = await service.merge("feature");
    expect(mockMerge).toHaveBeenCalledWith(["feature"]);
    expect(result).toBe("Already up-to-date.");
  });
});

// ─── applyAccount ─────────────────────────────────────────────────────────────

describe("GitService.applyAccount", () => {
  it("sets user.name and user.email locally", async () => {
    const service = makeService();
    await service.applyAccount("Alice", "alice@example.com");
    expect(mockRaw).toHaveBeenCalledWith(["config", "user.name", "Alice"]);
    expect(mockRaw).toHaveBeenCalledWith(["config", "user.email", "alice@example.com"]);
  });

  it("sets signing key when provided", async () => {
    const service = makeService();
    await service.applyAccount("Alice", "alice@example.com", { signingKey: "KEY123" });
    expect(mockRaw).toHaveBeenCalledWith(["config", "user.signingKey", "KEY123"]);
  });

  it("sets core.sshCommand when sshKeyPath is provided", async () => {
    const service = makeService();
    await service.applyAccount("Alice", "alice@example.com", {
      sshKeyPath: "/home/alice/.ssh/id_ed25519",
    });
    expect(mockRaw).toHaveBeenCalledWith(
      expect.arrayContaining([
        "config",
        "core.sshCommand",
        expect.stringContaining("id_ed25519"),
      ])
    );
  });

  it("unsets core.sshCommand when no sshKeyPath is given", async () => {
    const service = makeService();
    // The unset call uses raw directly on the internal git object
    await service.applyAccount("Alice", "alice@example.com");
    // Should have called raw with config --unset
    expect(mockRaw).toHaveBeenCalledWith(
      expect.arrayContaining(["config", "--unset", "--local", "core.sshCommand"])
    );
  });

  it("applies config globally when global option is true", async () => {
    const service = makeService();
    await service.applyAccount("Alice", "alice@example.com", { global: true });
    expect(mockRaw).toHaveBeenCalledWith(["config", "--global", "user.name", "Alice"]);
    expect(mockRaw).toHaveBeenCalledWith([
      "config",
      "--global",
      "user.email",
      "alice@example.com",
    ]);
  });
});

// ─── validateRef ─────────────────────────────────────────────────────────────

describe("GitService validateRef (via getTagsBefore)", () => {
  it("throws for empty ref", async () => {
    const service = makeService();
    await expect(service.getTagsBefore("")).rejects.toThrow("Invalid git ref");
  });

  it("throws for ref with control characters", async () => {
    const service = makeService();
    await expect(service.getTagsBefore("ref\x01bad")).rejects.toThrow("Invalid git ref");
  });

  it("accepts normal hashes and tag names", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    await expect(service.getTagsBefore("abc123def456")).resolves.toEqual([]);
  });
});

// ─── getSubmoduleStatus ───────────────────────────────────────────────────────

describe("GitService.getSubmoduleStatus", () => {
  it("returns empty array when there are no submodules", async () => {
    const service = makeService();
    mockRaw.mockResolvedValue("");
    const result = await service.getSubmoduleStatus();
    expect(result).toEqual([]);
  });

  it("parses submodule status with gitmodules config", async () => {
    const service = makeService();
    mockRaw
      .mockResolvedValueOnce(" abc1234 libs/mylib (v1.0.0)\n")
      .mockResolvedValueOnce(
        "submodule.libs/mylib.url=https://github.com/user/mylib.git\nsubmodule.libs/mylib.branch=main\n"
      );
    const result = await service.getSubmoduleStatus();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("libs/mylib");
    expect(result[0]!.url).toBe("https://github.com/user/mylib.git");
    expect(result[0]!.branch).toBe("main");
    expect(result[0]!.status).toBe("up-to-date");
  });

  it("marks modified submodule with + prefix", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("+abc1234 libs/mylib\n").mockResolvedValueOnce("");
    const result = await service.getSubmoduleStatus();
    expect(result[0]!.status).toBe("modified");
  });

  it("marks uninitialized submodule with - prefix", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("-abc1234 libs/mylib\n").mockResolvedValueOnce("");
    const result = await service.getSubmoduleStatus();
    expect(result[0]!.status).toBe("uninitialized");
  });
});

// ─── killCurrentOperation ─────────────────────────────────────────────────────

describe("GitService.killCurrentOperation", () => {
  it("does nothing when no active process", () => {
    const service = makeService();
    expect(() => service.killCurrentOperation()).not.toThrow();
  });

  it("kills the active child process", () => {
    const service = makeService();
    const mockKill = vi.fn();
    const fakeProc = { kill: mockKill, killed: false };
    (service as unknown as Record<string, unknown>)["_activeChildProcess"] = fakeProc;
    service.killCurrentOperation();
    expect(mockKill).toHaveBeenCalled();
    expect(
      (service as unknown as Record<string, unknown>)["_activeChildProcess"]
    ).toBeNull();
  });

  it("does not kill an already-killed process", () => {
    const service = makeService();
    const mockKill = vi.fn();
    const fakeProc = { kill: mockKill, killed: true };
    (service as unknown as Record<string, unknown>)["_activeChildProcess"] = fakeProc;
    service.killCurrentOperation();
    expect(mockKill).not.toHaveBeenCalled();
  });
});

// ─── setMainWindow ────────────────────────────────────────────────────────────

describe("GitService.setMainWindow", () => {
  it("stores the main window reference", () => {
    const service = makeService();
    const fakeWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    service.setMainWindow(fakeWindow as unknown as import("electron").BrowserWindow);
    expect((service as unknown as Record<string, unknown>)["mainWindow"]).toBe(
      fakeWindow
    );
  });
});
