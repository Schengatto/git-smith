import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockLfsStatus = vi.fn();
const mockLfsListTracked = vi.fn();
const mockLfsTrack = vi.fn();
const mockLfsUntrack = vi.fn();
const mockLfsInfo = vi.fn();
const mockLfsInstall = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    lfsStatus: (...args: unknown[]) => mockLfsStatus(...args),
    lfsListTracked: (...args: unknown[]) => mockLfsListTracked(...args),
    lfsTrack: (...args: unknown[]) => mockLfsTrack(...args),
    lfsUntrack: (...args: unknown[]) => mockLfsUntrack(...args),
    lfsInfo: (...args: unknown[]) => mockLfsInfo(...args),
    lfsInstall: (...args: unknown[]) => mockLfsInstall(...args),
  },
}));

import { ipcMain } from "electron";
import { registerLfsHandlers } from "./git-lfs.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("LFS IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all LFS channels", () => {
    registerLfsHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.LFS.STATUS);
    expect(channels).toContain(IPC.LFS.LIST_TRACKED);
    expect(channels).toContain(IPC.LFS.TRACK);
    expect(channels).toContain(IPC.LFS.UNTRACK);
    expect(channels).toContain(IPC.LFS.INFO);
    expect(channels).toContain(IPC.LFS.INSTALL);
  });

  it("LFS.TRACK delegates to gitService.lfsTrack", async () => {
    mockLfsTrack.mockResolvedValueOnce(undefined);
    registerLfsHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.LFS.TRACK);
    const handler = call![1];

    await handler({}, "*.psd");
    expect(mockLfsTrack).toHaveBeenCalledWith("*.psd");
  });

  it("LFS.STATUS delegates to gitService.lfsStatus", async () => {
    const mockResult = { installed: true, version: "3.0", tracked: [], files: [] };
    mockLfsStatus.mockResolvedValueOnce(mockResult);
    registerLfsHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.LFS.STATUS);
    const handler = call![1];

    const result = await handler({});
    expect(result).toEqual(mockResult);
  });

  it("LFS.UNTRACK delegates to gitService.lfsUntrack", async () => {
    mockLfsUntrack.mockResolvedValueOnce(undefined);
    registerLfsHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.LFS.UNTRACK);
    const handler = call![1];

    await handler({}, "*.zip");
    expect(mockLfsUntrack).toHaveBeenCalledWith("*.zip");
  });
});
