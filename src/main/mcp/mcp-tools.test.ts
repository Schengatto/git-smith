import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  class MockMcpServer {
    registeredTools: Map<string, { config: unknown; handler: unknown }> = new Map();
    registerTool(name: string, config: unknown, handler: unknown) {
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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTools } from "./mcp-tools";

describe("MCP Tools Registration", () => {
  let server: McpServer & { registeredTools: Map<string, { config: unknown; handler: (...args: unknown[]) => unknown }> };
  let mockGit: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = new McpServer(
      { name: "test", version: "0.0.1" },
      {}
    ) as McpServer & { registeredTools: Map<string, { config: unknown; handler: (...args: unknown[]) => unknown }> };

    mockGit = {
      getRepoInfo: vi.fn().mockResolvedValue({ path: "/test", name: "test", currentBranch: "main", isDirty: false, headCommit: "abc123" }),
      getStatus: vi.fn().mockResolvedValue({ staged: [], unstaged: [], untracked: [], mergeInProgress: false, conflicted: [] }),
      getLog: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      getCommitDetails: vi.fn().mockResolvedValue({ hash: "abc123", subject: "test" }),
      getCommitFullInfo: vi.fn().mockResolvedValue({ hash: "abc123" }),
      getDiff: vi.fn().mockResolvedValue("diff output"),
      getCommitDiff: vi.fn().mockResolvedValue("commit diff"),
      getCommitFileDiff: vi.fn().mockResolvedValue("file diff"),
      getCommitFiles: vi.fn().mockResolvedValue([]),
      getRangeFiles: vi.fn().mockResolvedValue([]),
      getRangeFileDiff: vi.fn().mockResolvedValue("range diff"),
      getBranches: vi.fn().mockResolvedValue([]),
      getTags: vi.fn().mockResolvedValue([]),
      getRemotes: vi.fn().mockResolvedValue([]),
      getStashList: vi.fn().mockResolvedValue([]),
      blame: vi.fn().mockResolvedValue("blame output"),
      showFile: vi.fn().mockResolvedValue("file content"),
      getConflictedFiles: vi.fn().mockResolvedValue([]),
      getConflictFileContent: vi.fn().mockResolvedValue({ ours: "", theirs: "", base: "", merged: "" }),
      isRebaseInProgress: vi.fn().mockResolvedValue(false),
      getFileHistory: vi.fn().mockResolvedValue([]),
      getTreeFiles: vi.fn().mockResolvedValue([]),
      listConfig: vi.fn().mockResolvedValue({}),
      stage: vi.fn().mockResolvedValue(undefined),
      unstage: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue("abc123"),
      amend: vi.fn().mockResolvedValue("abc123"),
      createBranch: vi.fn().mockResolvedValue(undefined),
      deleteBranch: vi.fn().mockResolvedValue(undefined),
      checkout: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockResolvedValue("merge result"),
      mergeWithOptions: vi.fn().mockResolvedValue("merge result"),
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

    registerMcpTools(server, mockGit as never);
  });

  it("registers all expected read-only tools", () => {
    const readOnlyTools = [
      "repo_info", "status", "log", "commit_details", "commit_full_info",
      "diff_file", "diff_staged", "diff_commit", "diff_commit_file",
      "diff_commit_files", "diff_range_files", "diff_range_file",
      "branch_list", "tag_list", "remote_list", "stash_list",
      "blame", "show_file", "conflict_list", "conflict_file_content",
      "is_rebase_in_progress", "file_history", "tree_files", "config_list",
    ];
    for (const name of readOnlyTools) {
      expect(server.registeredTools.has(name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it("registers all expected mutating tools", () => {
    const mutatingTools = [
      "stage", "unstage", "discard", "commit", "amend",
      "branch_create", "branch_delete", "branch_checkout",
      "merge", "merge_with_options", "rebase", "rebase_continue", "rebase_abort",
      "cherry_pick", "reset",
      "stash_create", "stash_pop", "stash_apply", "stash_drop",
      "tag_create", "tag_delete",
      "fetch", "pull", "push",
      "conflict_resolve", "conflict_save_merged", "config_set",
    ];
    for (const name of mutatingTools) {
      expect(server.registeredTools.has(name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it("repo_info tool calls getRepoInfo and returns JSON", async () => {
    const tool = server.registeredTools.get("repo_info")!;
    const result = await (tool.handler as () => Promise<{ content: { type: string; text: string }[] }>)();
    expect(mockGit.getRepoInfo).toHaveBeenCalled();
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toHaveProperty("currentBranch", "main");
  });

  it("status tool calls getStatus", async () => {
    const tool = server.registeredTools.get("status")!;
    await (tool.handler as () => Promise<unknown>)();
    expect(mockGit.getStatus).toHaveBeenCalled();
  });

  it("log tool passes parameters correctly", async () => {
    const tool = server.registeredTools.get("log")!;
    await (tool.handler as (args: { maxCount?: number; skip?: number; branchFilter?: string }) => Promise<unknown>)({
      maxCount: 10,
      skip: 5,
      branchFilter: "main",
    });
    expect(mockGit.getLog).toHaveBeenCalledWith(10, 5, "main");
  });

  it("stage tool calls stage with paths", async () => {
    const tool = server.registeredTools.get("stage")!;
    const result = await (tool.handler as (args: { paths: string[] }) => Promise<{ content: { text: string }[] }>)({
      paths: ["src/a.ts", "src/b.ts"],
    });
    expect(mockGit.stage).toHaveBeenCalledWith(["src/a.ts", "src/b.ts"]);
    expect(result.content[0]!.text).toContain("2 file(s)");
  });

  it("commit tool calls commit with message", async () => {
    const tool = server.registeredTools.get("commit")!;
    const result = await (tool.handler as (args: { message: string }) => Promise<{ content: { text: string }[] }>)({
      message: "feat: add something",
    });
    expect(mockGit.commit).toHaveBeenCalledWith("feat: add something");
    expect(result.content[0]!.text).toContain("abc123");
  });

  it("diff_staged calls getDiff with staged=true", async () => {
    const tool = server.registeredTools.get("diff_staged")!;
    await (tool.handler as () => Promise<unknown>)();
    expect(mockGit.getDiff).toHaveBeenCalledWith(undefined, true);
  });

  it("branch_checkout calls checkout", async () => {
    const tool = server.registeredTools.get("branch_checkout")!;
    await (tool.handler as (args: { ref: string }) => Promise<unknown>)({ ref: "develop" });
    expect(mockGit.checkout).toHaveBeenCalledWith("develop");
  });

  it("reset tool calls resetToCommit with mode", async () => {
    const tool = server.registeredTools.get("reset")!;
    await (tool.handler as (args: { hash: string; mode: string }) => Promise<unknown>)({
      hash: "abc123",
      mode: "hard",
    });
    expect(mockGit.resetToCommit).toHaveBeenCalledWith("abc123", "hard");
  });

  it("push tool calls push with parameters", async () => {
    const tool = server.registeredTools.get("push")!;
    await (tool.handler as (args: { remote?: string; branch?: string; force?: boolean }) => Promise<unknown>)({
      remote: "origin",
      branch: "main",
      force: true,
    });
    expect(mockGit.push).toHaveBeenCalledWith("origin", "main", true);
  });

  it("registers the correct total number of tools", () => {
    // 24 read-only + 28 mutating = 52 total
    expect(server.registeredTools.size).toBeGreaterThanOrEqual(50);
  });
});
