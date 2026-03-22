import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetConflictedFiles = vi.fn();
const mockGetConflictFileContent = vi.fn();
const mockResolveConflict = vi.fn();
const mockSaveMergedFile = vi.fn();
const mockLaunchExternalMergeTool = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getConflictedFiles: (...args: unknown[]) => mockGetConflictedFiles(...args),
    getConflictFileContent: (...args: unknown[]) => mockGetConflictFileContent(...args),
    resolveConflict: (...args: unknown[]) => mockResolveConflict(...args),
    saveMergedFile: (...args: unknown[]) => mockSaveMergedFile(...args),
    launchExternalMergeTool: (...args: unknown[]) => mockLaunchExternalMergeTool(...args),
  },
}));

import { ipcMain } from "electron";
import { registerConflictHandlers } from "./git-conflict.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-conflict IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerConflictHandlers();
  });

  it("registers all CONFLICT channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.CONFLICT.LIST);
    expect(channels).toContain(IPC.CONFLICT.FILE_CONTENT);
    expect(channels).toContain(IPC.CONFLICT.RESOLVE);
    expect(channels).toContain(IPC.CONFLICT.SAVE_MERGED);
    expect(channels).toContain(IPC.CONFLICT.LAUNCH_MERGE_TOOL);
  });

  it("CONFLICT.LIST returns gitService.getConflictedFiles()", async () => {
    const files = ["src/a.ts", "src/b.ts"];
    mockGetConflictedFiles.mockResolvedValueOnce(files);
    const result = await getHandler(IPC.CONFLICT.LIST)({});
    expect(mockGetConflictedFiles).toHaveBeenCalled();
    expect(result).toBe(files);
  });

  it("CONFLICT.FILE_CONTENT calls getConflictFileContent with filePath", async () => {
    const content = { ours: "our version", theirs: "their version", base: "base" };
    mockGetConflictFileContent.mockResolvedValueOnce(content);
    const result = await getHandler(IPC.CONFLICT.FILE_CONTENT)({}, "src/conflict.ts");
    expect(mockGetConflictFileContent).toHaveBeenCalledWith("src/conflict.ts");
    expect(result).toBe(content);
  });

  it("CONFLICT.RESOLVE calls resolveConflict with filePath", async () => {
    mockResolveConflict.mockResolvedValueOnce(undefined);
    await getHandler(IPC.CONFLICT.RESOLVE)({}, "src/conflict.ts");
    expect(mockResolveConflict).toHaveBeenCalledWith("src/conflict.ts");
  });

  it("CONFLICT.SAVE_MERGED calls saveMergedFile with filePath and content", async () => {
    mockSaveMergedFile.mockResolvedValueOnce(undefined);
    await getHandler(IPC.CONFLICT.SAVE_MERGED)({}, "src/conflict.ts", "merged content here");
    expect(mockSaveMergedFile).toHaveBeenCalledWith("src/conflict.ts", "merged content here");
  });

  it("CONFLICT.LAUNCH_MERGE_TOOL calls launchExternalMergeTool with args", async () => {
    const toolResult = { exitCode: 0 };
    mockLaunchExternalMergeTool.mockResolvedValueOnce(toolResult);
    const result = await getHandler(IPC.CONFLICT.LAUNCH_MERGE_TOOL)(
      {},
      "src/conflict.ts",
      "/usr/bin/vimdiff",
      "$LOCAL $REMOTE"
    );
    expect(mockLaunchExternalMergeTool).toHaveBeenCalledWith(
      "src/conflict.ts",
      "/usr/bin/vimdiff",
      "$LOCAL $REMOTE"
    );
    expect(result).toBe(toolResult);
  });
});
