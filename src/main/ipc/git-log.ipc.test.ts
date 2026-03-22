import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetLog = vi.fn();
const mockGetCommitDetails = vi.fn();
const mockGetCommitFullInfo = vi.fn();
const mockShowFile = vi.fn();
const mockSearchCommits = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getLog: (...args: unknown[]) => mockGetLog(...args),
    getCommitDetails: (...args: unknown[]) => mockGetCommitDetails(...args),
    getCommitFullInfo: (...args: unknown[]) => mockGetCommitFullInfo(...args),
    showFile: (...args: unknown[]) => mockShowFile(...args),
    searchCommits: (...args: unknown[]) => mockSearchCommits(...args),
  },
}));

import { ipcMain } from "electron";
import { registerLogHandlers } from "./git-log.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-log IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerLogHandlers();
  });

  it("registers all LOG channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.LOG.GRAPH);
    expect(channels).toContain(IPC.LOG.DETAILS);
    expect(channels).toContain(IPC.LOG.FULL_INFO);
    expect(channels).toContain(IPC.LOG.SHOW_FILE);
    expect(channels).toContain(IPC.LOG.SEARCH);
  });

  it("LOG.GRAPH calls gitService.getLog with defaults when no args provided", async () => {
    const fakeLog = [{ hash: "abc" }];
    mockGetLog.mockResolvedValueOnce(fakeLog);
    const handler = getHandler(IPC.LOG.GRAPH);
    const result = await handler({}, undefined, undefined, undefined, undefined);
    expect(mockGetLog).toHaveBeenCalledWith(500, 0, undefined, undefined);
    expect(result).toBe(fakeLog);
  });

  it("LOG.GRAPH passes provided args to getLog", async () => {
    const fakeLog = [{ hash: "def" }];
    mockGetLog.mockResolvedValueOnce(fakeLog);
    const handler = getHandler(IPC.LOG.GRAPH);
    const branchVisibility = { mode: "include" as const, branches: ["main"] };
    await handler({}, 100, 50, "main", branchVisibility);
    expect(mockGetLog).toHaveBeenCalledWith(100, 50, "main", branchVisibility);
  });

  it("LOG.GRAPH treats empty string branchFilter as undefined", async () => {
    mockGetLog.mockResolvedValueOnce([]);
    const handler = getHandler(IPC.LOG.GRAPH);
    await handler({}, 200, 0, "", undefined);
    expect(mockGetLog).toHaveBeenCalledWith(200, 0, undefined, undefined);
  });

  it("LOG.DETAILS calls gitService.getCommitDetails with hash", async () => {
    const fakeDetails = { hash: "abc123", message: "feat: something" };
    mockGetCommitDetails.mockResolvedValueOnce(fakeDetails);
    const handler = getHandler(IPC.LOG.DETAILS);
    const result = await handler({}, "abc123");
    expect(mockGetCommitDetails).toHaveBeenCalledWith("abc123");
    expect(result).toBe(fakeDetails);
  });

  it("LOG.FULL_INFO calls gitService.getCommitFullInfo with hash", async () => {
    const fakeInfo = { hash: "def456", files: [] };
    mockGetCommitFullInfo.mockResolvedValueOnce(fakeInfo);
    const handler = getHandler(IPC.LOG.FULL_INFO);
    const result = await handler({}, "def456");
    expect(mockGetCommitFullInfo).toHaveBeenCalledWith("def456");
    expect(result).toBe(fakeInfo);
  });

  it("LOG.SHOW_FILE calls gitService.showFile with hash and filePath", async () => {
    const content = "file content at revision";
    mockShowFile.mockResolvedValueOnce(content);
    const handler = getHandler(IPC.LOG.SHOW_FILE);
    const result = await handler({}, "abc123", "src/index.ts");
    expect(mockShowFile).toHaveBeenCalledWith("abc123", "src/index.ts");
    expect(result).toBe(content);
  });

  it("LOG.SEARCH calls gitService.searchCommits with options", async () => {
    const opts = { query: "feat", author: "alice" };
    const fakeResults = [{ hash: "ghi789" }];
    mockSearchCommits.mockResolvedValueOnce(fakeResults);
    const handler = getHandler(IPC.LOG.SEARCH);
    const result = await handler({}, opts);
    expect(mockSearchCommits).toHaveBeenCalledWith(opts);
    expect(result).toBe(fakeResults);
  });
});
