import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockWorktreeList = vi.fn();
const mockWorktreeAdd = vi.fn();
const mockWorktreeRemove = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    worktreeList: (...args: unknown[]) => mockWorktreeList(...args),
    worktreeAdd: (...args: unknown[]) => mockWorktreeAdd(...args),
    worktreeRemove: (...args: unknown[]) => mockWorktreeRemove(...args),
  },
}));

import { ipcMain } from "electron";
import { registerWorktreeHandlers } from "./git-worktree.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("worktree IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all worktree channels", () => {
    registerWorktreeHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.WORKTREE.LIST);
    expect(channels).toContain(IPC.WORKTREE.ADD);
    expect(channels).toContain(IPC.WORKTREE.REMOVE);
  });

  it("WORKTREE.LIST delegates to gitService.worktreeList", async () => {
    const list = [{ path: "/tmp/wt", branch: "main", head: "abc", isBare: false, isMain: true }];
    mockWorktreeList.mockResolvedValueOnce(list);
    registerWorktreeHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.WORKTREE.LIST);
    const result = await call![1]({});
    expect(result).toEqual(list);
  });

  it("WORKTREE.ADD delegates to gitService.worktreeAdd", async () => {
    mockWorktreeAdd.mockResolvedValueOnce(undefined);
    registerWorktreeHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.WORKTREE.ADD);
    await call![1]({}, "/tmp/new-wt", "feature", true);
    expect(mockWorktreeAdd).toHaveBeenCalledWith("/tmp/new-wt", "feature", true);
  });

  it("WORKTREE.REMOVE delegates to gitService.worktreeRemove", async () => {
    mockWorktreeRemove.mockResolvedValueOnce(undefined);
    registerWorktreeHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.WORKTREE.REMOVE);
    await call![1]({}, "/tmp/old-wt", true);
    expect(mockWorktreeRemove).toHaveBeenCalledWith("/tmp/old-wt", true);
  });
});
