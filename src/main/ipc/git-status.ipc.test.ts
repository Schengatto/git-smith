import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetStatus = vi.fn();
const mockStage = vi.fn();
const mockStageLines = vi.fn();
const mockUnstage = vi.fn();
const mockUnstageLines = vi.fn();
const mockDiscard = vi.fn();
const mockDiscardAll = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    stage: (...args: unknown[]) => mockStage(...args),
    stageLines: (...args: unknown[]) => mockStageLines(...args),
    unstage: (...args: unknown[]) => mockUnstage(...args),
    unstageLines: (...args: unknown[]) => mockUnstageLines(...args),
    discard: (...args: unknown[]) => mockDiscard(...args),
    discardAll: (...args: unknown[]) => mockDiscardAll(...args),
  },
}));

import { ipcMain } from "electron";
import { registerStatusHandlers } from "./git-status.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-status IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerStatusHandlers();
  });

  it("registers all STATUS channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.STATUS.GET);
    expect(channels).toContain(IPC.STATUS.STAGE);
    expect(channels).toContain(IPC.STATUS.STAGE_LINES);
    expect(channels).toContain(IPC.STATUS.UNSTAGE);
    expect(channels).toContain(IPC.STATUS.UNSTAGE_LINES);
    expect(channels).toContain(IPC.STATUS.DISCARD);
    expect(channels).toContain(IPC.STATUS.DISCARD_ALL);
  });

  it("STATUS.GET returns gitService.getStatus()", async () => {
    const fakeStatus = { staged: [], unstaged: [] };
    mockGetStatus.mockResolvedValueOnce(fakeStatus);
    const handler = getHandler(IPC.STATUS.GET);
    const result = await handler({});
    expect(mockGetStatus).toHaveBeenCalled();
    expect(result).toBe(fakeStatus);
  });

  it("STATUS.STAGE calls stage then returns updated status", async () => {
    const updatedStatus = { staged: ["a.ts"], unstaged: [] };
    mockStage.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.STAGE);
    const result = await handler({}, ["a.ts"]);
    expect(mockStage).toHaveBeenCalledWith(["a.ts"]);
    expect(mockGetStatus).toHaveBeenCalled();
    expect(result).toBe(updatedStatus);
  });

  it("STATUS.STAGE_LINES calls stageLines then returns updated status", async () => {
    const patch = "@@ -1,3 +1,4 @@\n+new line";
    const updatedStatus = { staged: [], unstaged: [] };
    mockStageLines.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.STAGE_LINES);
    const result = await handler({}, patch);
    expect(mockStageLines).toHaveBeenCalledWith(patch);
    expect(result).toBe(updatedStatus);
  });

  it("STATUS.UNSTAGE calls unstage then returns updated status", async () => {
    const updatedStatus = { staged: [], unstaged: ["b.ts"] };
    mockUnstage.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.UNSTAGE);
    const result = await handler({}, ["b.ts"]);
    expect(mockUnstage).toHaveBeenCalledWith(["b.ts"]);
    expect(result).toBe(updatedStatus);
  });

  it("STATUS.UNSTAGE_LINES calls unstageLines then returns updated status", async () => {
    const patch = "@@ -1,4 +1,3 @@\n-removed";
    const updatedStatus = { staged: [], unstaged: [] };
    mockUnstageLines.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.UNSTAGE_LINES);
    const result = await handler({}, patch);
    expect(mockUnstageLines).toHaveBeenCalledWith(patch);
    expect(result).toBe(updatedStatus);
  });

  it("STATUS.DISCARD calls discard then returns updated status", async () => {
    const updatedStatus = { staged: [], unstaged: [] };
    mockDiscard.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.DISCARD);
    const result = await handler({}, ["c.ts"]);
    expect(mockDiscard).toHaveBeenCalledWith(["c.ts"]);
    expect(result).toBe(updatedStatus);
  });

  it("STATUS.DISCARD_ALL calls discardAll then returns updated status", async () => {
    const updatedStatus = { staged: [], unstaged: [] };
    mockDiscardAll.mockResolvedValueOnce(undefined);
    mockGetStatus.mockResolvedValueOnce(updatedStatus);
    const handler = getHandler(IPC.STATUS.DISCARD_ALL);
    const result = await handler({});
    expect(mockDiscardAll).toHaveBeenCalled();
    expect(result).toBe(updatedStatus);
  });
});
