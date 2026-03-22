import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetRepoPath = vi.fn();
const mockGetDiff = vi.fn();
const mockGetStatus = vi.fn();
const mockGetConflictFileContent = vi.fn();
const mockGetCommitDetails = vi.fn();
const mockGetCommitDiff = vi.fn();
const mockGetCommitFiles = vi.fn();
const mockGetRangeFileDiff = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: (...args: unknown[]) => mockGetRepoPath(...args),
    getDiff: (...args: unknown[]) => mockGetDiff(...args),
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getConflictFileContent: (...args: unknown[]) => mockGetConflictFileContent(...args),
    getCommitDetails: (...args: unknown[]) => mockGetCommitDetails(...args),
    getCommitDiff: (...args: unknown[]) => mockGetCommitDiff(...args),
    getCommitFiles: (...args: unknown[]) => mockGetCommitFiles(...args),
    getRangeFileDiff: (...args: unknown[]) => mockGetRangeFileDiff(...args),
  },
}));

const mockStartMcpServer = vi.fn();
const mockStopMcpServer = vi.fn();
const mockIsMcpServerRunning = vi.fn();
const mockGetMcpServerRepoPath = vi.fn();

vi.mock("../mcp/mcp-server", () => ({
  startMcpServer: (...args: unknown[]) => mockStartMcpServer(...args),
  stopMcpServer: (...args: unknown[]) => mockStopMcpServer(...args),
  isMcpServerRunning: (...args: unknown[]) => mockIsMcpServerRunning(...args),
  getMcpServerRepoPath: (...args: unknown[]) => mockGetMcpServerRepoPath(...args),
}));

const mockGenerateCommitMessage = vi.fn();
const mockSuggestConflictResolution = vi.fn();
const mockGeneratePrDescription = vi.fn();
const mockReviewCommit = vi.fn();

vi.mock("../mcp/mcp-client", () => ({
  McpAiClient: class {
    generateCommitMessage(...args: unknown[]) {
      return mockGenerateCommitMessage(...args);
    }
    suggestConflictResolution(...args: unknown[]) {
      return mockSuggestConflictResolution(...args);
    }
    generatePrDescription(...args: unknown[]) {
      return mockGeneratePrDescription(...args);
    }
    reviewCommit(...args: unknown[]) {
      return mockReviewCommit(...args);
    }
  },
}));

import { ipcMain } from "electron";
import { registerMcpHandlers } from "./mcp.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("mcp IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerMcpHandlers();
  });

  it("registers all MCP channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.MCP.SERVER_START);
    expect(channels).toContain(IPC.MCP.SERVER_STOP);
    expect(channels).toContain(IPC.MCP.SERVER_STATUS);
    expect(channels).toContain(IPC.MCP.GENERATE_COMMIT_MESSAGE);
    expect(channels).toContain(IPC.MCP.SUGGEST_CONFLICT_RESOLUTION);
    expect(channels).toContain(IPC.MCP.GENERATE_PR_DESCRIPTION);
    expect(channels).toContain(IPC.MCP.REVIEW_COMMIT);
  });

  it("MCP.SERVER_START throws when no repo is open", async () => {
    mockGetRepoPath.mockReturnValueOnce(null);
    const handler = getHandler(IPC.MCP.SERVER_START);
    await expect(handler({})).rejects.toThrow("No repository is open");
  });

  it("MCP.SERVER_START calls startMcpServer with repo path", async () => {
    mockGetRepoPath.mockReturnValueOnce("/home/user/repo");
    mockStartMcpServer.mockResolvedValueOnce(undefined);
    await getHandler(IPC.MCP.SERVER_START)({});
    expect(mockStartMcpServer).toHaveBeenCalledWith("/home/user/repo");
  });

  it("MCP.SERVER_STOP calls stopMcpServer", async () => {
    mockStopMcpServer.mockResolvedValueOnce(undefined);
    await getHandler(IPC.MCP.SERVER_STOP)({});
    expect(mockStopMcpServer).toHaveBeenCalled();
  });

  it("MCP.SERVER_STATUS returns running state and repo path", () => {
    mockIsMcpServerRunning.mockReturnValueOnce(true);
    mockGetMcpServerRepoPath.mockReturnValueOnce("/home/user/repo");
    const result = getHandler(IPC.MCP.SERVER_STATUS)({});
    expect(result).toEqual({ running: true, repoPath: "/home/user/repo" });
  });

  it("MCP.GENERATE_COMMIT_MESSAGE calls getDiff, getStatus, and AI client", async () => {
    const diff = "diff --git a/x b/x";
    const status = { staged: [], unstaged: [] };
    const message = "feat: new thing";
    mockGetDiff.mockResolvedValueOnce(diff);
    mockGetStatus.mockResolvedValueOnce(status);
    mockGenerateCommitMessage.mockResolvedValueOnce(message);
    const result = await getHandler(IPC.MCP.GENERATE_COMMIT_MESSAGE)({});
    expect(mockGetDiff).toHaveBeenCalledWith(undefined, true);
    expect(mockGetStatus).toHaveBeenCalled();
    expect(mockGenerateCommitMessage).toHaveBeenCalledWith(diff, status);
    expect(result).toBe(message);
  });

  it("MCP.SUGGEST_CONFLICT_RESOLUTION calls getConflictFileContent and AI client", async () => {
    const content = { ours: "ours", theirs: "theirs", base: "base" };
    const suggestion = "merged content";
    mockGetConflictFileContent.mockResolvedValueOnce(content);
    mockSuggestConflictResolution.mockResolvedValueOnce(suggestion);
    const result = await getHandler(IPC.MCP.SUGGEST_CONFLICT_RESOLUTION)(
      {},
      "src/conflict.ts"
    );
    expect(mockGetConflictFileContent).toHaveBeenCalledWith("src/conflict.ts");
    expect(mockSuggestConflictResolution).toHaveBeenCalledWith(
      content.ours,
      content.theirs,
      content.base,
      "src/conflict.ts"
    );
    expect(result).toBe(suggestion);
  });

  it("MCP.GENERATE_PR_DESCRIPTION with single commit calls getCommitDiff", async () => {
    const details = { hash: "abc123", message: "feat: x" };
    const diff = "diff content";
    const description = "PR description";
    mockGetCommitDetails.mockResolvedValueOnce(details);
    mockGetCommitDiff.mockResolvedValueOnce(diff);
    mockGeneratePrDescription.mockResolvedValueOnce(description);
    const result = await getHandler(IPC.MCP.GENERATE_PR_DESCRIPTION)({}, ["abc123"]);
    expect(mockGetCommitDetails).toHaveBeenCalledWith("abc123");
    expect(mockGetCommitDiff).toHaveBeenCalledWith("abc123");
    expect(mockGeneratePrDescription).toHaveBeenCalledWith([details], diff);
    expect(result).toBe(description);
  });

  it("MCP.REVIEW_COMMIT calls getCommitDiff and getCommitFiles then AI client", async () => {
    const diff = "diff --git a/x b/x";
    const files = [{ path: "x.ts", status: "M" }];
    const review = "LGTM";
    mockGetCommitDiff.mockResolvedValueOnce(diff);
    mockGetCommitFiles.mockResolvedValueOnce(files);
    mockReviewCommit.mockResolvedValueOnce(review);
    const result = await getHandler(IPC.MCP.REVIEW_COMMIT)({}, "abc123");
    expect(mockGetCommitDiff).toHaveBeenCalledWith("abc123");
    expect(mockGetCommitFiles).toHaveBeenCalledWith("abc123");
    expect(mockReviewCommit).toHaveBeenCalledWith("abc123", diff, files);
    expect(result).toBe(review);
  });
});
