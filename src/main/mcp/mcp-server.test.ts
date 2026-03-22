import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

const mockConnect = vi.fn();
const mockClose = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  class MockMcpServer {
    registeredTools = new Map();
    registerTool(name: string, config: unknown, handler: unknown) {
      this.registeredTools.set(name, { config, handler });
    }
    connect = mockConnect;
    close = mockClose;
  }
  return { McpServer: MockMcpServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

const mockOpenRepo = vi.fn().mockResolvedValue({
  path: "/test",
  name: "test",
  currentBranch: "main",
  isDirty: false,
  headCommit: "abc",
});
const mockCloseRepo = vi.fn();
const mockGetRepoPath = vi.fn().mockReturnValue("/test");

vi.mock("../git/git-service", () => {
  return {
    GitService: class MockGitService {
      openRepo = mockOpenRepo;
      closeRepo = mockCloseRepo;
      getRepoPath = mockGetRepoPath;
      getRepoInfo = vi.fn();
      getStatus = vi.fn();
      getLog = vi.fn();
      getCommitDetails = vi.fn();
      getCommitFullInfo = vi.fn();
      getDiff = vi.fn();
      getCommitDiff = vi.fn();
      getCommitFileDiff = vi.fn();
      getCommitFiles = vi.fn();
      getRangeFiles = vi.fn();
      getRangeFileDiff = vi.fn();
      getBranches = vi.fn();
      getTags = vi.fn();
      getRemotes = vi.fn();
      getStashList = vi.fn();
      blame = vi.fn();
      showFile = vi.fn();
      getConflictedFiles = vi.fn();
      getConflictFileContent = vi.fn();
      isRebaseInProgress = vi.fn();
      getFileHistory = vi.fn();
      getTreeFiles = vi.fn();
      listConfig = vi.fn();
      stage = vi.fn();
      unstage = vi.fn();
      discard = vi.fn();
      commit = vi.fn();
      amend = vi.fn();
      createBranch = vi.fn();
      deleteBranch = vi.fn();
      checkout = vi.fn();
      merge = vi.fn();
      mergeWithOptions = vi.fn();
      rebase = vi.fn();
      rebaseContinue = vi.fn();
      rebaseAbort = vi.fn();
      cherryPick = vi.fn();
      resetToCommit = vi.fn();
      stashCreate = vi.fn();
      stashPop = vi.fn();
      stashApply = vi.fn();
      stashDrop = vi.fn();
      createTag = vi.fn();
      deleteTag = vi.fn();
      fetch = vi.fn();
      pull = vi.fn();
      push = vi.fn();
      resolveConflict = vi.fn();
      saveMergedFile = vi.fn();
      setConfig = vi.fn();
    },
  };
});

import {
  startMcpServer,
  stopMcpServer,
  isMcpServerRunning,
  getMcpServerRepoPath,
} from "./mcp-server";

describe("MCP Server lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure server is stopped between tests
    if (isMcpServerRunning()) {
      await stopMcpServer();
    }
  });

  it("starts the server and opens a repo", async () => {
    await startMcpServer("/test/repo");
    expect(mockOpenRepo).toHaveBeenCalledWith("/test/repo");
    expect(mockConnect).toHaveBeenCalled();
    expect(isMcpServerRunning()).toBe(true);
  });

  it("returns correct repo path when running", async () => {
    await startMcpServer("/test/repo");
    expect(getMcpServerRepoPath()).toBe("/test");
  });

  it("throws if started twice", async () => {
    await startMcpServer("/test/repo");
    await expect(startMcpServer("/test/repo")).rejects.toThrow("already running");
  });

  it("stops the server and cleans up", async () => {
    await startMcpServer("/test/repo");
    await stopMcpServer();
    expect(mockClose).toHaveBeenCalled();
    expect(mockCloseRepo).toHaveBeenCalled();
    expect(isMcpServerRunning()).toBe(false);
    expect(getMcpServerRepoPath()).toBeNull();
  });

  it("is not running initially", () => {
    expect(isMcpServerRunning()).toBe(false);
    expect(getMcpServerRepoPath()).toBeNull();
  });
});
