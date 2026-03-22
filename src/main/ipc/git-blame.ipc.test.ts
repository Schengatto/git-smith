import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockBlame = vi.fn();
const mockGetFileHistory = vi.fn();
const mockGetSubmodules = vi.fn();
const mockAddSubmodule = vi.fn();
const mockSubmoduleUpdate = vi.fn();
const mockSubmoduleSync = vi.fn();
const mockSubmoduleDeinit = vi.fn();
const mockGetSubmoduleStatus = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    blame: (...args: unknown[]) => mockBlame(...args),
    getFileHistory: (...args: unknown[]) => mockGetFileHistory(...args),
    getSubmodules: (...args: unknown[]) => mockGetSubmodules(...args),
    addSubmodule: (...args: unknown[]) => mockAddSubmodule(...args),
    submoduleUpdate: (...args: unknown[]) => mockSubmoduleUpdate(...args),
    submoduleSync: (...args: unknown[]) => mockSubmoduleSync(...args),
    submoduleDeinit: (...args: unknown[]) => mockSubmoduleDeinit(...args),
    getSubmoduleStatus: (...args: unknown[]) => mockGetSubmoduleStatus(...args),
  },
}));

import { ipcMain } from "electron";
import { registerBlameHandlers } from "./git-blame.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-blame IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerBlameHandlers();
  });

  it("registers all BLAME, HISTORY, and SUBMODULE channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.BLAME.FILE);
    expect(channels).toContain(IPC.HISTORY.FILE);
    expect(channels).toContain(IPC.SUBMODULE.LIST);
    expect(channels).toContain(IPC.SUBMODULE.ADD);
    expect(channels).toContain(IPC.SUBMODULE.UPDATE);
    expect(channels).toContain(IPC.SUBMODULE.SYNC);
    expect(channels).toContain(IPC.SUBMODULE.DEINIT);
    expect(channels).toContain(IPC.SUBMODULE.STATUS);
  });

  it("BLAME.FILE calls gitService.blame with file path", async () => {
    const fakeBlame = [{ line: 1, hash: "abc", author: "Alice" }];
    mockBlame.mockResolvedValueOnce(fakeBlame);
    const result = await getHandler(IPC.BLAME.FILE)({}, "src/index.ts");
    expect(mockBlame).toHaveBeenCalledWith("src/index.ts");
    expect(result).toBe(fakeBlame);
  });

  it("HISTORY.FILE calls gitService.getFileHistory with file and maxCount", async () => {
    const fakeHistory = [{ hash: "abc123", message: "feat: init" }];
    mockGetFileHistory.mockResolvedValueOnce(fakeHistory);
    const result = await getHandler(IPC.HISTORY.FILE)({}, "src/app.ts", 50);
    expect(mockGetFileHistory).toHaveBeenCalledWith("src/app.ts", 50);
    expect(result).toBe(fakeHistory);
  });

  it("HISTORY.FILE works without maxCount", async () => {
    mockGetFileHistory.mockResolvedValueOnce([]);
    await getHandler(IPC.HISTORY.FILE)({}, "src/app.ts", undefined);
    expect(mockGetFileHistory).toHaveBeenCalledWith("src/app.ts", undefined);
  });

  it("SUBMODULE.LIST returns getSubmodules result", async () => {
    const subs = [{ path: "libs/core", url: "https://github.com/x/core" }];
    mockGetSubmodules.mockResolvedValueOnce(subs);
    const result = await getHandler(IPC.SUBMODULE.LIST)({});
    expect(mockGetSubmodules).toHaveBeenCalled();
    expect(result).toBe(subs);
  });

  it("SUBMODULE.ADD calls addSubmodule with url and path", async () => {
    mockAddSubmodule.mockResolvedValueOnce(undefined);
    await getHandler(IPC.SUBMODULE.ADD)({}, "https://github.com/x/y", "libs/y");
    expect(mockAddSubmodule).toHaveBeenCalledWith("https://github.com/x/y", "libs/y");
  });

  it("SUBMODULE.UPDATE calls submoduleUpdate with init flag", async () => {
    mockSubmoduleUpdate.mockResolvedValueOnce(undefined);
    await getHandler(IPC.SUBMODULE.UPDATE)({}, true);
    expect(mockSubmoduleUpdate).toHaveBeenCalledWith(true);
  });

  it("SUBMODULE.SYNC calls submoduleSync", async () => {
    mockSubmoduleSync.mockResolvedValueOnce(undefined);
    await getHandler(IPC.SUBMODULE.SYNC)({});
    expect(mockSubmoduleSync).toHaveBeenCalled();
  });

  it("SUBMODULE.DEINIT calls submoduleDeinit with path and force flag", async () => {
    mockSubmoduleDeinit.mockResolvedValueOnce(undefined);
    await getHandler(IPC.SUBMODULE.DEINIT)({}, "libs/old", true);
    expect(mockSubmoduleDeinit).toHaveBeenCalledWith("libs/old", true);
  });

  it("SUBMODULE.STATUS returns getSubmoduleStatus result", async () => {
    const status = [{ path: "libs/core", status: "clean" }];
    mockGetSubmoduleStatus.mockResolvedValueOnce(status);
    const result = await getHandler(IPC.SUBMODULE.STATUS)({});
    expect(mockGetSubmoduleStatus).toHaveBeenCalled();
    expect(result).toBe(status);
  });
});
