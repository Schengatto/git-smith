import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetStashList = vi.fn();
const mockStashCreate = vi.fn();
const mockStashPop = vi.fn();
const mockStashApply = vi.fn();
const mockStashDrop = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getStashList: (...args: unknown[]) => mockGetStashList(...args),
    stashCreate: (...args: unknown[]) => mockStashCreate(...args),
    stashPop: (...args: unknown[]) => mockStashPop(...args),
    stashApply: (...args: unknown[]) => mockStashApply(...args),
    stashDrop: (...args: unknown[]) => mockStashDrop(...args),
  },
}));

import { ipcMain } from "electron";
import { registerStashHandlers } from "./git-stash.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-stash IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerStashHandlers();
  });

  it("registers all STASH channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.STASH.LIST);
    expect(channels).toContain(IPC.STASH.CREATE);
    expect(channels).toContain(IPC.STASH.POP);
    expect(channels).toContain(IPC.STASH.APPLY);
    expect(channels).toContain(IPC.STASH.DROP);
  });

  it("STASH.LIST returns gitService.getStashList()", async () => {
    const fakeStashes = [{ index: 0, message: "WIP on main" }];
    mockGetStashList.mockResolvedValueOnce(fakeStashes);
    const result = await getHandler(IPC.STASH.LIST)({});
    expect(mockGetStashList).toHaveBeenCalled();
    expect(result).toBe(fakeStashes);
  });

  it("STASH.CREATE calls stashCreate with message and options", async () => {
    mockStashCreate.mockResolvedValueOnce(undefined);
    const opts = { keepIndex: true, includeUntracked: false };
    await getHandler(IPC.STASH.CREATE)({}, "work in progress", opts);
    expect(mockStashCreate).toHaveBeenCalledWith("work in progress", opts);
  });

  it("STASH.CREATE works with no message and no options", async () => {
    mockStashCreate.mockResolvedValueOnce(undefined);
    await getHandler(IPC.STASH.CREATE)({}, undefined, undefined);
    expect(mockStashCreate).toHaveBeenCalledWith(undefined, undefined);
  });

  it("STASH.POP calls stashPop with index", async () => {
    mockStashPop.mockResolvedValueOnce(undefined);
    await getHandler(IPC.STASH.POP)({}, 0);
    expect(mockStashPop).toHaveBeenCalledWith(0);
  });

  it("STASH.POP works without index", async () => {
    mockStashPop.mockResolvedValueOnce(undefined);
    await getHandler(IPC.STASH.POP)({}, undefined);
    expect(mockStashPop).toHaveBeenCalledWith(undefined);
  });

  it("STASH.APPLY calls stashApply with index", async () => {
    mockStashApply.mockResolvedValueOnce(undefined);
    await getHandler(IPC.STASH.APPLY)({}, 2);
    expect(mockStashApply).toHaveBeenCalledWith(2);
  });

  it("STASH.DROP calls stashDrop with index", async () => {
    mockStashDrop.mockResolvedValueOnce(undefined);
    await getHandler(IPC.STASH.DROP)({}, 1);
    expect(mockStashDrop).toHaveBeenCalledWith(1);
  });
});
