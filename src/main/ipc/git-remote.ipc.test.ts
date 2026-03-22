import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetRemotes = vi.fn();
const mockAddRemote = vi.fn();
const mockRemoveRemote = vi.fn();
const mockFetch = vi.fn();
const mockFetchAll = vi.fn();
const mockFetchPrune = vi.fn();
const mockPull = vi.fn();
const mockPullRebase = vi.fn();
const mockPullMerge = vi.fn();
const mockPush = vi.fn();
const mockClone = vi.fn();
const mockListRemoteBranches = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getRemotes: (...args: unknown[]) => mockGetRemotes(...args),
    addRemote: (...args: unknown[]) => mockAddRemote(...args),
    removeRemote: (...args: unknown[]) => mockRemoveRemote(...args),
    fetch: (...args: unknown[]) => mockFetch(...args),
    fetchAll: (...args: unknown[]) => mockFetchAll(...args),
    fetchPrune: (...args: unknown[]) => mockFetchPrune(...args),
    pull: (...args: unknown[]) => mockPull(...args),
    pullRebase: (...args: unknown[]) => mockPullRebase(...args),
    pullMerge: (...args: unknown[]) => mockPullMerge(...args),
    push: (...args: unknown[]) => mockPush(...args),
    clone: (...args: unknown[]) => mockClone(...args),
    listRemoteBranches: (...args: unknown[]) => mockListRemoteBranches(...args),
  },
}));

vi.mock("../notifications/notification-service", () => ({
  showNotification: vi.fn(),
}));

import { ipcMain } from "electron";
import { registerRemoteHandlers } from "./git-remote.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-remote IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerRemoteHandlers();
  });

  it("registers all REMOTE channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.REMOTE.LIST);
    expect(channels).toContain(IPC.REMOTE.ADD);
    expect(channels).toContain(IPC.REMOTE.REMOVE);
    expect(channels).toContain(IPC.REMOTE.FETCH);
    expect(channels).toContain(IPC.REMOTE.FETCH_ALL);
    expect(channels).toContain(IPC.REMOTE.FETCH_PRUNE);
    expect(channels).toContain(IPC.REMOTE.PULL);
    expect(channels).toContain(IPC.REMOTE.PULL_REBASE);
    expect(channels).toContain(IPC.REMOTE.PULL_MERGE);
    expect(channels).toContain(IPC.REMOTE.PUSH);
    expect(channels).toContain(IPC.REMOTE.CLONE);
    expect(channels).toContain(IPC.REMOTE.LIST_REMOTE_BRANCHES);
  });

  it("REMOTE.LIST returns gitService.getRemotes()", async () => {
    const fakeRemotes = [{ name: "origin", url: "https://github.com/x/y" }];
    mockGetRemotes.mockResolvedValueOnce(fakeRemotes);
    const result = await getHandler(IPC.REMOTE.LIST)({});
    expect(mockGetRemotes).toHaveBeenCalled();
    expect(result).toBe(fakeRemotes);
  });

  it("REMOTE.ADD calls addRemote with name and url", async () => {
    mockAddRemote.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.ADD)({}, "upstream", "https://github.com/upstream/repo");
    expect(mockAddRemote).toHaveBeenCalledWith(
      "upstream",
      "https://github.com/upstream/repo"
    );
  });

  it("REMOTE.REMOVE calls removeRemote with name", async () => {
    mockRemoveRemote.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.REMOVE)({}, "upstream");
    expect(mockRemoveRemote).toHaveBeenCalledWith("upstream");
  });

  it("REMOTE.FETCH calls fetch with optional remote", async () => {
    mockFetch.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.FETCH)({}, "origin");
    expect(mockFetch).toHaveBeenCalledWith("origin");
  });

  it("REMOTE.FETCH_ALL calls fetchAll", async () => {
    mockFetchAll.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.FETCH_ALL)({});
    expect(mockFetchAll).toHaveBeenCalled();
  });

  it("REMOTE.FETCH_PRUNE calls fetchPrune", async () => {
    mockFetchPrune.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.FETCH_PRUNE)({});
    expect(mockFetchPrune).toHaveBeenCalled();
  });

  it("REMOTE.PULL calls pull with remote and branch", async () => {
    mockPull.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.PULL)({}, "origin", "main");
    expect(mockPull).toHaveBeenCalledWith("origin", "main");
  });

  it("REMOTE.PULL_REBASE calls pullRebase with remote and branch", async () => {
    mockPullRebase.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.PULL_REBASE)({}, "origin", "main");
    expect(mockPullRebase).toHaveBeenCalledWith("origin", "main");
  });

  it("REMOTE.PULL_MERGE calls pullMerge with remote and branch", async () => {
    mockPullMerge.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.PULL_MERGE)({}, "origin", "main");
    expect(mockPullMerge).toHaveBeenCalledWith("origin", "main");
  });

  it("REMOTE.PUSH calls push with all arguments and shows notification", async () => {
    const { showNotification } = await import("../notifications/notification-service");
    mockPush.mockResolvedValueOnce(undefined);
    await getHandler(IPC.REMOTE.PUSH)({}, "origin", "main", false, true);
    expect(mockPush).toHaveBeenCalledWith("origin", "main", false, true);
    expect(showNotification).toHaveBeenCalled();
  });

  it("REMOTE.CLONE calls clone with url, directory and options", async () => {
    mockClone.mockResolvedValueOnce(undefined);
    const opts = { branch: "develop", bare: false };
    await getHandler(IPC.REMOTE.CLONE)({}, "https://github.com/x/y", "/tmp/repo", opts);
    expect(mockClone).toHaveBeenCalledWith("https://github.com/x/y", "/tmp/repo", opts);
  });

  it("REMOTE.LIST_REMOTE_BRANCHES returns listRemoteBranches result", async () => {
    const branches = ["refs/heads/main", "refs/heads/develop"];
    mockListRemoteBranches.mockResolvedValueOnce(branches);
    const result = await getHandler(IPC.REMOTE.LIST_REMOTE_BRANCHES)(
      {},
      "https://github.com/x/y"
    );
    expect(mockListRemoteBranches).toHaveBeenCalledWith("https://github.com/x/y");
    expect(result).toBe(branches);
  });
});
