import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  class MockMcpServer {
    registeredTools = new Map<
      string,
      { config: unknown; handler: (...args: unknown[]) => unknown }
    >();
    registerTool(name: string, config: unknown, handler: (...args: unknown[]) => unknown) {
      this.registeredTools.set(name, { config, handler });
    }
    connect = vi.fn();
    close = vi.fn();
  }
  return { McpServer: MockMcpServer };
});

vi.mock("zod", async () => {
  const actual = await vi.importActual("zod");
  return actual;
});

// ── Imports ────────────────────────────────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTools } from "./mcp-tools";

// ── Types ──────────────────────────────────────────────────────────────────

type ToolResult = { content: Array<{ type: string; text: string }> };
type RegisteredServer = McpServer & {
  registeredTools: Map<
    string,
    { config: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }
  >;
};

// ── Setup ──────────────────────────────────────────────────────────────────

function createMockGit() {
  return {
    getRepoInfo: vi.fn().mockResolvedValue({
      path: "/repo",
      name: "test",
      currentBranch: "main",
      isDirty: false,
      headCommit: "abc123",
    }),
    getStatus: vi.fn().mockResolvedValue({
      staged: [],
      unstaged: [],
      untracked: [],
      mergeInProgress: false,
      conflicted: [],
    }),
    getLog: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getCommitDetails: vi.fn().mockResolvedValue({ hash: "abc123", subject: "test commit" }),
    getCommitFullInfo: vi.fn().mockResolvedValue({ hash: "abc123", branches: [] }),
    getDiff: vi.fn().mockResolvedValue("diff output"),
    getCommitDiff: vi.fn().mockResolvedValue("commit diff content"),
    getCommitFileDiff: vi.fn().mockResolvedValue("file diff content"),
    getCommitFiles: vi.fn().mockResolvedValue([{ path: "src/a.ts", additions: 5, deletions: 2 }]),
    getRangeFiles: vi.fn().mockResolvedValue([{ path: "src/b.ts" }]),
    getRangeFileDiff: vi.fn().mockResolvedValue("range diff content"),
    getBranches: vi.fn().mockResolvedValue([{ name: "main", current: true }]),
    getTags: vi.fn().mockResolvedValue([{ name: "v1.0.0", hash: "abc" }]),
    getRemotes: vi
      .fn()
      .mockResolvedValue([{ name: "origin", fetchUrl: "https://github.com/u/r.git", pushUrl: "" }]),
    getStashList: vi.fn().mockResolvedValue([{ index: 0, message: "WIP" }]),
    blame: vi.fn().mockResolvedValue("blame output"),
    showFile: vi.fn().mockResolvedValue("file content at commit"),
    getConflictedFiles: vi.fn().mockResolvedValue(["src/conflict.ts"]),
    getConflictFileContent: vi.fn().mockResolvedValue({
      ours: "ours",
      theirs: "theirs",
      base: "base",
      merged: "merged",
    }),
    isRebaseInProgress: vi.fn().mockResolvedValue(false),
    getFileHistory: vi.fn().mockResolvedValue([{ hash: "aaa", subject: "initial" }]),
    getTreeFiles: vi.fn().mockResolvedValue(["src/a.ts", "src/b.ts"]),
    listConfig: vi
      .fn()
      .mockResolvedValue({ "user.name": "Alice", "user.email": "alice@example.com" }),
    stage: vi.fn().mockResolvedValue(undefined),
    unstage: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue("newcommithash"),
    amend: vi.fn().mockResolvedValue("amendedcommithash"),
    createBranch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue("merge result"),
    mergeWithOptions: vi.fn().mockResolvedValue("merge with options result"),
    rebase: vi.fn().mockResolvedValue(undefined),
    rebaseContinue: vi.fn().mockResolvedValue(undefined),
    rebaseAbort: vi.fn().mockResolvedValue(undefined),
    cherryPick: vi.fn().mockResolvedValue(undefined),
    resetToCommit: vi.fn().mockResolvedValue(undefined),
    stashCreate: vi.fn().mockResolvedValue(undefined),
    stashPop: vi.fn().mockResolvedValue(undefined),
    stashApply: vi.fn().mockResolvedValue(undefined),
    stashDrop: vi.fn().mockResolvedValue(undefined),
    createTag: vi.fn().mockResolvedValue(undefined),
    deleteTag: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    resolveConflict: vi.fn().mockResolvedValue(undefined),
    saveMergedFile: vi.fn().mockResolvedValue(undefined),
    setConfig: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("registerMcpTools", () => {
  let server: RegisteredServer;
  let mockGit: ReturnType<typeof createMockGit>;

  function getTool(name: string) {
    const tool = server.registeredTools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);
    return tool.handler;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: "test", version: "0.0.1" }, {}) as RegisteredServer;
    mockGit = createMockGit();
    registerMcpTools(server, mockGit as never);
  });

  // ── Registration ──────────────────────────────────────────────────────────

  describe("tool registration", () => {
    const allReadOnlyTools = [
      "repo_info",
      "status",
      "log",
      "commit_details",
      "commit_full_info",
      "diff_file",
      "diff_staged",
      "diff_commit",
      "diff_commit_file",
      "diff_commit_files",
      "diff_range_files",
      "diff_range_file",
      "branch_list",
      "tag_list",
      "remote_list",
      "stash_list",
      "blame",
      "show_file",
      "conflict_list",
      "conflict_file_content",
      "is_rebase_in_progress",
      "file_history",
      "tree_files",
      "config_list",
    ];

    const allMutatingTools = [
      "stage",
      "unstage",
      "discard",
      "commit",
      "amend",
      "branch_create",
      "branch_delete",
      "branch_checkout",
      "merge",
      "merge_with_options",
      "rebase",
      "rebase_continue",
      "rebase_abort",
      "cherry_pick",
      "reset",
      "stash_create",
      "stash_pop",
      "stash_apply",
      "stash_drop",
      "tag_create",
      "tag_delete",
      "fetch",
      "pull",
      "push",
      "conflict_resolve",
      "conflict_save_merged",
      "config_set",
    ];

    it("registers all read-only tools", () => {
      for (const name of allReadOnlyTools) {
        expect(server.registeredTools.has(name), `Missing read-only tool: ${name}`).toBe(true);
      }
    });

    it("registers all mutating tools", () => {
      for (const name of allMutatingTools) {
        expect(server.registeredTools.has(name), `Missing mutating tool: ${name}`).toBe(true);
      }
    });

    it("registers the correct total number of tools (>= 50)", () => {
      expect(server.registeredTools.size).toBeGreaterThanOrEqual(50);
    });
  });

  // ── Read-only tools ────────────────────────────────────────────────────────

  describe("repo_info", () => {
    it("calls git.getRepoInfo and returns JSON text", async () => {
      const result = await getTool("repo_info")({});
      expect(mockGit.getRepoInfo).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.currentBranch).toBe("main");
      expect(parsed.headCommit).toBe("abc123");
    });
  });

  describe("status", () => {
    it("calls git.getStatus and returns JSON text", async () => {
      const result = await getTool("status")({});
      expect(mockGit.getStatus).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.staged).toEqual([]);
    });
  });

  describe("log", () => {
    it("calls git.getLog with all parameters", async () => {
      await getTool("log")({ maxCount: 20, skip: 5, branchFilter: "develop" });
      expect(mockGit.getLog).toHaveBeenCalledWith(20, 5, "develop");
    });

    it("calls git.getLog with undefined optional params", async () => {
      await getTool("log")({});
      expect(mockGit.getLog).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe("commit_details", () => {
    it("calls git.getCommitDetails with hash", async () => {
      const result = await getTool("commit_details")({ hash: "abc123" });
      expect(mockGit.getCommitDetails).toHaveBeenCalledWith("abc123");
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.hash).toBe("abc123");
    });
  });

  describe("commit_full_info", () => {
    it("calls git.getCommitFullInfo with hash", async () => {
      await getTool("commit_full_info")({ hash: "deadbeef" });
      expect(mockGit.getCommitFullInfo).toHaveBeenCalledWith("deadbeef");
    });
  });

  describe("diff_file", () => {
    it("calls git.getDiff with file and staged flag", async () => {
      const result = await getTool("diff_file")({ file: "src/a.ts", staged: true });
      expect(mockGit.getDiff).toHaveBeenCalledWith("src/a.ts", true);
      expect(result.content[0]!.text).toBe("diff output");
    });

    it("calls git.getDiff without staged when not provided", async () => {
      await getTool("diff_file")({ file: "src/b.ts" });
      expect(mockGit.getDiff).toHaveBeenCalledWith("src/b.ts", undefined);
    });
  });

  describe("diff_staged", () => {
    it("calls git.getDiff with undefined file and staged=true", async () => {
      await getTool("diff_staged")({});
      expect(mockGit.getDiff).toHaveBeenCalledWith(undefined, true);
    });
  });

  describe("diff_commit", () => {
    it("calls git.getCommitDiff with hash", async () => {
      const result = await getTool("diff_commit")({ hash: "abc123" });
      expect(mockGit.getCommitDiff).toHaveBeenCalledWith("abc123");
      expect(result.content[0]!.text).toBe("commit diff content");
    });
  });

  describe("diff_commit_file", () => {
    it("calls git.getCommitFileDiff with hash and file", async () => {
      await getTool("diff_commit_file")({ hash: "abc123", file: "src/x.ts" });
      expect(mockGit.getCommitFileDiff).toHaveBeenCalledWith("abc123", "src/x.ts");
    });
  });

  describe("diff_commit_files", () => {
    it("calls git.getCommitFiles and returns JSON", async () => {
      const result = await getTool("diff_commit_files")({ hash: "abc123" });
      expect(mockGit.getCommitFiles).toHaveBeenCalledWith("abc123");
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed[0]!.path).toBe("src/a.ts");
    });
  });

  describe("diff_range_files", () => {
    it("calls git.getRangeFiles with two hashes", async () => {
      await getTool("diff_range_files")({ hash1: "aaa", hash2: "bbb" });
      expect(mockGit.getRangeFiles).toHaveBeenCalledWith("aaa", "bbb");
    });
  });

  describe("diff_range_file", () => {
    it("calls git.getRangeFileDiff with both hashes and file", async () => {
      await getTool("diff_range_file")({ hash1: "aaa", hash2: "bbb", file: "src/c.ts" });
      expect(mockGit.getRangeFileDiff).toHaveBeenCalledWith("aaa", "bbb", "src/c.ts");
    });
  });

  describe("branch_list", () => {
    it("calls git.getBranches and returns JSON", async () => {
      const result = await getTool("branch_list")({});
      expect(mockGit.getBranches).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed[0]!.name).toBe("main");
    });
  });

  describe("tag_list", () => {
    it("calls git.getTags and returns JSON", async () => {
      const result = await getTool("tag_list")({});
      expect(mockGit.getTags).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed[0]!.name).toBe("v1.0.0");
    });
  });

  describe("remote_list", () => {
    it("calls git.getRemotes and returns JSON", async () => {
      const result = await getTool("remote_list")({});
      expect(mockGit.getRemotes).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed[0]!.name).toBe("origin");
    });
  });

  describe("stash_list", () => {
    it("calls git.getStashList and returns JSON", async () => {
      const result = await getTool("stash_list")({});
      expect(mockGit.getStashList).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed[0]!.message).toBe("WIP");
    });
  });

  describe("blame", () => {
    it("calls git.blame with file path", async () => {
      const result = await getTool("blame")({ file: "src/a.ts" });
      expect(mockGit.blame).toHaveBeenCalledWith("src/a.ts");
      expect(result.content[0]!.text).toBe("blame output");
    });
  });

  describe("show_file", () => {
    it("calls git.showFile with hash and file", async () => {
      const result = await getTool("show_file")({ hash: "HEAD", file: "README.md" });
      expect(mockGit.showFile).toHaveBeenCalledWith("HEAD", "README.md");
      expect(result.content[0]!.text).toBe("file content at commit");
    });
  });

  describe("conflict_list", () => {
    it("calls git.getConflictedFiles and returns JSON", async () => {
      const result = await getTool("conflict_list")({});
      expect(mockGit.getConflictedFiles).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed).toContain("src/conflict.ts");
    });
  });

  describe("conflict_file_content", () => {
    it("calls git.getConflictFileContent with file path", async () => {
      const result = await getTool("conflict_file_content")({ file: "src/conflict.ts" });
      expect(mockGit.getConflictFileContent).toHaveBeenCalledWith("src/conflict.ts");
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.ours).toBe("ours");
      expect(parsed.theirs).toBe("theirs");
    });
  });

  describe("is_rebase_in_progress", () => {
    it("calls git.isRebaseInProgress and returns JSON", async () => {
      const result = await getTool("is_rebase_in_progress")({});
      expect(mockGit.isRebaseInProgress).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.inProgress).toBe(false);
    });

    it("returns inProgress=true when rebase is active", async () => {
      mockGit.isRebaseInProgress.mockResolvedValueOnce(true);
      const result = await getTool("is_rebase_in_progress")({});
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.inProgress).toBe(true);
    });
  });

  describe("file_history", () => {
    it("calls git.getFileHistory with file and maxCount", async () => {
      await getTool("file_history")({ file: "src/a.ts", maxCount: 10 });
      expect(mockGit.getFileHistory).toHaveBeenCalledWith("src/a.ts", 10);
    });

    it("calls git.getFileHistory without maxCount when omitted", async () => {
      await getTool("file_history")({ file: "src/a.ts" });
      expect(mockGit.getFileHistory).toHaveBeenCalledWith("src/a.ts", undefined);
    });
  });

  describe("tree_files", () => {
    it("calls git.getTreeFiles with hash", async () => {
      const result = await getTool("tree_files")({ hash: "abc123" });
      expect(mockGit.getTreeFiles).toHaveBeenCalledWith("abc123");
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed).toContain("src/a.ts");
    });
  });

  describe("config_list", () => {
    it("calls git.listConfig with global flag", async () => {
      await getTool("config_list")({ global: true });
      expect(mockGit.listConfig).toHaveBeenCalledWith(true);
    });

    it("calls git.listConfig without global flag when omitted", async () => {
      await getTool("config_list")({});
      expect(mockGit.listConfig).toHaveBeenCalledWith(undefined);
    });
  });

  // ── Mutating tools ─────────────────────────────────────────────────────────

  describe("stage", () => {
    it("calls git.stage with paths and returns confirmation text", async () => {
      const result = await getTool("stage")({ paths: ["src/a.ts", "src/b.ts"] });
      expect(mockGit.stage).toHaveBeenCalledWith(["src/a.ts", "src/b.ts"]);
      expect(result.content[0]!.text).toContain("2 file(s)");
    });
  });

  describe("unstage", () => {
    it("calls git.unstage with paths", async () => {
      const result = await getTool("unstage")({ paths: ["src/c.ts"] });
      expect(mockGit.unstage).toHaveBeenCalledWith(["src/c.ts"]);
      expect(result.content[0]!.text).toContain("1 file(s)");
    });
  });

  describe("discard", () => {
    it("calls git.discard with paths", async () => {
      const result = await getTool("discard")({
        paths: ["src/d.ts", "src/e.ts", "src/f.ts"],
      });
      expect(mockGit.discard).toHaveBeenCalledWith(["src/d.ts", "src/e.ts", "src/f.ts"]);
      expect(result.content[0]!.text).toContain("3 file(s)");
    });
  });

  describe("commit", () => {
    it("calls git.commit and returns hash", async () => {
      const result = await getTool("commit")({ message: "feat: add feature" });
      expect(mockGit.commit).toHaveBeenCalledWith("feat: add feature");
      expect(result.content[0]!.text).toContain("newcommithash");
    });
  });

  describe("amend", () => {
    it("calls git.amend with message", async () => {
      const result = await getTool("amend")({ message: "fix: correct typo" });
      expect(mockGit.amend).toHaveBeenCalledWith("fix: correct typo");
      expect(result.content[0]!.text).toContain("amendedcommithash");
    });

    it("calls git.amend without message when omitted", async () => {
      await getTool("amend")({});
      expect(mockGit.amend).toHaveBeenCalledWith(undefined);
    });
  });

  describe("branch_create", () => {
    it("calls git.createBranch with name and startPoint", async () => {
      const result = await getTool("branch_create")({
        name: "feature/foo",
        startPoint: "main",
      });
      expect(mockGit.createBranch).toHaveBeenCalledWith("feature/foo", "main");
      expect(result.content[0]!.text).toContain("feature/foo");
    });

    it("calls git.createBranch without startPoint when omitted", async () => {
      await getTool("branch_create")({ name: "feature/bar" });
      expect(mockGit.createBranch).toHaveBeenCalledWith("feature/bar", undefined);
    });
  });

  describe("branch_delete", () => {
    it("calls git.deleteBranch with name and force flag", async () => {
      const result = await getTool("branch_delete")({ name: "old-branch", force: true });
      expect(mockGit.deleteBranch).toHaveBeenCalledWith("old-branch", true);
      expect(result.content[0]!.text).toContain("old-branch");
    });

    it("calls git.deleteBranch without force when omitted", async () => {
      await getTool("branch_delete")({ name: "old-branch" });
      expect(mockGit.deleteBranch).toHaveBeenCalledWith("old-branch", undefined);
    });
  });

  describe("branch_checkout", () => {
    it("calls git.checkout with ref", async () => {
      const result = await getTool("branch_checkout")({ ref: "develop" });
      expect(mockGit.checkout).toHaveBeenCalledWith("develop");
      expect(result.content[0]!.text).toContain("develop");
    });
  });

  describe("merge", () => {
    it("calls git.merge and returns result", async () => {
      const result = await getTool("merge")({ branch: "feature/x" });
      expect(mockGit.merge).toHaveBeenCalledWith("feature/x");
      expect(result.content[0]!.text).toBe("merge result");
    });
  });

  describe("merge_with_options", () => {
    it("calls git.mergeWithOptions with all provided options", async () => {
      await getTool("merge_with_options")({
        branch: "feature/y",
        mergeStrategy: "no-ff",
        noCommit: true,
        squash: false,
        allowUnrelatedHistories: true,
        message: "Merge feature/y",
      });
      expect(mockGit.mergeWithOptions).toHaveBeenCalledWith({
        branch: "feature/y",
        mergeStrategy: "no-ff",
        noCommit: true,
        squash: false,
        allowUnrelatedHistories: true,
        message: "Merge feature/y",
      });
    });

    it("defaults mergeStrategy to 'ff' when not provided", async () => {
      await getTool("merge_with_options")({ branch: "feature/z" });
      expect(mockGit.mergeWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({ mergeStrategy: "ff" })
      );
    });
  });

  describe("rebase", () => {
    it("calls git.rebase with onto", async () => {
      const result = await getTool("rebase")({ onto: "main" });
      expect(mockGit.rebase).toHaveBeenCalledWith("main");
      expect(result.content[0]!.text).toContain("main");
    });
  });

  describe("rebase_continue", () => {
    it("calls git.rebaseContinue", async () => {
      const result = await getTool("rebase_continue")({});
      expect(mockGit.rebaseContinue).toHaveBeenCalled();
      expect(result.content[0]!.text).toContain("continued");
    });
  });

  describe("rebase_abort", () => {
    it("calls git.rebaseAbort", async () => {
      const result = await getTool("rebase_abort")({});
      expect(mockGit.rebaseAbort).toHaveBeenCalled();
      expect(result.content[0]!.text).toContain("aborted");
    });
  });

  describe("cherry_pick", () => {
    it("calls git.cherryPick with hash", async () => {
      const result = await getTool("cherry_pick")({ hash: "deadbeef" });
      expect(mockGit.cherryPick).toHaveBeenCalledWith("deadbeef");
      expect(result.content[0]!.text).toContain("deadbeef");
    });
  });

  describe("reset", () => {
    it("calls git.resetToCommit with hash and mode", async () => {
      const result = await getTool("reset")({ hash: "abc123", mode: "hard" });
      expect(mockGit.resetToCommit).toHaveBeenCalledWith("abc123", "hard");
      expect(result.content[0]!.text).toContain("abc123");
      expect(result.content[0]!.text).toContain("hard");
    });

    it("works with soft mode", async () => {
      await getTool("reset")({ hash: "def456", mode: "soft" });
      expect(mockGit.resetToCommit).toHaveBeenCalledWith("def456", "soft");
    });

    it("works with mixed mode", async () => {
      await getTool("reset")({ hash: "ghi789", mode: "mixed" });
      expect(mockGit.resetToCommit).toHaveBeenCalledWith("ghi789", "mixed");
    });
  });

  describe("stash_create", () => {
    it("calls git.stashCreate with all options", async () => {
      const result = await getTool("stash_create")({
        message: "WIP: work in progress",
        keepIndex: true,
        includeUntracked: true,
      });
      expect(mockGit.stashCreate).toHaveBeenCalledWith("WIP: work in progress", {
        keepIndex: true,
        includeUntracked: true,
      });
      expect(result.content[0]!.text).toContain("created");
    });

    it("calls git.stashCreate without options when omitted", async () => {
      await getTool("stash_create")({});
      expect(mockGit.stashCreate).toHaveBeenCalledWith(undefined, {
        keepIndex: undefined,
        includeUntracked: undefined,
      });
    });
  });

  describe("stash_pop", () => {
    it("calls git.stashPop with index", async () => {
      const result = await getTool("stash_pop")({ index: 2 });
      expect(mockGit.stashPop).toHaveBeenCalledWith(2);
      expect(result.content[0]!.text).toContain("2");
    });

    it("calls git.stashPop without index (default 0)", async () => {
      const result = await getTool("stash_pop")({});
      expect(mockGit.stashPop).toHaveBeenCalledWith(undefined);
      expect(result.content[0]!.text).toContain("0");
    });
  });

  describe("stash_apply", () => {
    it("calls git.stashApply with index", async () => {
      const result = await getTool("stash_apply")({ index: 1 });
      expect(mockGit.stashApply).toHaveBeenCalledWith(1);
      expect(result.content[0]!.text).toContain("1");
    });
  });

  describe("stash_drop", () => {
    it("calls git.stashDrop with index", async () => {
      const result = await getTool("stash_drop")({ index: 3 });
      expect(mockGit.stashDrop).toHaveBeenCalledWith(3);
      expect(result.content[0]!.text).toContain("3");
    });
  });

  describe("tag_create", () => {
    it("calls git.createTag with name, commitHash, and message", async () => {
      const result = await getTool("tag_create")({
        name: "v2.0.0",
        commitHash: "abc123",
        message: "Release v2.0.0",
      });
      expect(mockGit.createTag).toHaveBeenCalledWith("v2.0.0", "abc123", "Release v2.0.0");
      expect(result.content[0]!.text).toContain("v2.0.0");
    });

    it("calls git.createTag without message when omitted", async () => {
      await getTool("tag_create")({ name: "v3.0.0", commitHash: "def456" });
      expect(mockGit.createTag).toHaveBeenCalledWith("v3.0.0", "def456", undefined);
    });
  });

  describe("tag_delete", () => {
    it("calls git.deleteTag with name", async () => {
      const result = await getTool("tag_delete")({ name: "v1.0.0" });
      expect(mockGit.deleteTag).toHaveBeenCalledWith("v1.0.0");
      expect(result.content[0]!.text).toContain("v1.0.0");
    });
  });

  describe("fetch", () => {
    it("calls git.fetch with remote", async () => {
      const result = await getTool("fetch")({ remote: "upstream" });
      expect(mockGit.fetch).toHaveBeenCalledWith("upstream");
      expect(result.content[0]!.text).toContain("upstream");
    });

    it("calls git.fetch without remote when omitted", async () => {
      const result = await getTool("fetch")({});
      expect(mockGit.fetch).toHaveBeenCalledWith(undefined);
      expect(result.content[0]!.text).toContain("default remote");
    });
  });

  describe("pull", () => {
    it("calls git.pull with remote and branch", async () => {
      const result = await getTool("pull")({ remote: "origin", branch: "main" });
      expect(mockGit.pull).toHaveBeenCalledWith("origin", "main");
      expect(result.content[0]!.text).toContain("successfully");
    });

    it("calls git.pull without params when omitted", async () => {
      await getTool("pull")({});
      expect(mockGit.pull).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe("push", () => {
    it("calls git.push with remote, branch, and force", async () => {
      const result = await getTool("push")({
        remote: "origin",
        branch: "main",
        force: true,
      });
      expect(mockGit.push).toHaveBeenCalledWith("origin", "main", true);
      expect(result.content[0]!.text).toContain("successfully");
    });

    it("calls git.push without optional params", async () => {
      await getTool("push")({});
      expect(mockGit.push).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe("conflict_resolve", () => {
    it("calls git.resolveConflict with file", async () => {
      const result = await getTool("conflict_resolve")({ file: "src/conflict.ts" });
      expect(mockGit.resolveConflict).toHaveBeenCalledWith("src/conflict.ts");
      expect(result.content[0]!.text).toContain("src/conflict.ts");
    });
  });

  describe("conflict_save_merged", () => {
    it("calls git.saveMergedFile with file and content", async () => {
      const result = await getTool("conflict_save_merged")({
        file: "src/conflict.ts",
        content: "merged content here",
      });
      expect(mockGit.saveMergedFile).toHaveBeenCalledWith("src/conflict.ts", "merged content here");
      expect(result.content[0]!.text).toContain("src/conflict.ts");
    });
  });

  describe("config_set", () => {
    it("calls git.setConfig with key, value, and global flag", async () => {
      const result = await getTool("config_set")({
        key: "user.name",
        value: "Alice",
        global: true,
      });
      expect(mockGit.setConfig).toHaveBeenCalledWith("user.name", "Alice", true);
      expect(result.content[0]!.text).toContain("user.name");
      expect(result.content[0]!.text).toContain("Alice");
    });

    it("calls git.setConfig without global when omitted", async () => {
      await getTool("config_set")({ key: "core.autocrlf", value: "false" });
      expect(mockGit.setConfig).toHaveBeenCalledWith("core.autocrlf", "false", undefined);
    });
  });

  // ── Content format validation ──────────────────────────────────────────────

  describe("result content format", () => {
    it("all read-only tools return content with type='text'", async () => {
      const simpleTools = [
        "repo_info",
        "status",
        "branch_list",
        "tag_list",
        "remote_list",
        "stash_list",
        "conflict_list",
      ];
      for (const name of simpleTools) {
        const result = await getTool(name)({});
        expect(result.content[0]!.type, `Tool "${name}" content type`).toBe("text");
      }
    });

    it("all mutating tools return content with type='text'", async () => {
      const results = await Promise.all([
        getTool("stage")({ paths: ["a"] }),
        getTool("unstage")({ paths: ["b"] }),
        getTool("discard")({ paths: ["c"] }),
        getTool("rebase_continue")({}),
        getTool("rebase_abort")({}),
      ]);
      for (const result of results) {
        expect(result.content[0]!.type).toBe("text");
      }
    });
  });
});
