import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

const mockOpenRepo = vi.fn();
const mockInitRepo = vi.fn();
const mockCloseRepo = vi.fn();
const mockIsOpen = vi.fn();
const mockGetRepoInfo = vi.fn();
const mockApplyAccount = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    openRepo: (...args: unknown[]) => mockOpenRepo(...args),
    initRepo: (...args: unknown[]) => mockInitRepo(...args),
    closeRepo: (...args: unknown[]) => mockCloseRepo(...args),
    isOpen: (...args: unknown[]) => mockIsOpen(...args),
    getRepoInfo: (...args: unknown[]) => mockGetRepoInfo(...args),
    applyAccount: (...args: unknown[]) => mockApplyAccount(...args),
  },
}));

const mockAddRecentRepo = vi.fn();
const mockAddMultipleRecentRepos = vi.fn();
const mockGetRecentRepos = vi.fn();
const mockRemoveRecentRepo = vi.fn();
const mockClearRecentRepos = vi.fn();
const mockSetRepoCategory = vi.fn();
const mockGetRepoCategories = vi.fn();
const mockRemoveMissingRepos = vi.fn();
const mockRenameCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockScanForRepos = vi.fn();
const mockGetLastOpenedRepo = vi.fn();
const mockSetLastOpenedRepo = vi.fn();
const mockGetRepoViewSettings = vi.fn();
const mockSetRepoViewSettings = vi.fn();
const mockGetRepoAccount = vi.fn();
const mockGetGitAccounts = vi.fn();

vi.mock("../store", () => ({
  addRecentRepo: (...args: unknown[]) => mockAddRecentRepo(...args),
  addMultipleRecentRepos: (...args: unknown[]) => mockAddMultipleRecentRepos(...args),
  getRecentRepos: (...args: unknown[]) => mockGetRecentRepos(...args),
  removeRecentRepo: (...args: unknown[]) => mockRemoveRecentRepo(...args),
  clearRecentRepos: (...args: unknown[]) => mockClearRecentRepos(...args),
  setRepoCategory: (...args: unknown[]) => mockSetRepoCategory(...args),
  getRepoCategories: (...args: unknown[]) => mockGetRepoCategories(...args),
  removeMissingRepos: (...args: unknown[]) => mockRemoveMissingRepos(...args),
  renameCategory: (...args: unknown[]) => mockRenameCategory(...args),
  deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
  scanForRepos: (...args: unknown[]) => mockScanForRepos(...args),
  getLastOpenedRepo: (...args: unknown[]) => mockGetLastOpenedRepo(...args),
  setLastOpenedRepo: (...args: unknown[]) => mockSetLastOpenedRepo(...args),
  getRepoViewSettings: (...args: unknown[]) => mockGetRepoViewSettings(...args),
  setRepoViewSettings: (...args: unknown[]) => mockSetRepoViewSettings(...args),
  getRepoAccount: (...args: unknown[]) => mockGetRepoAccount(...args),
  getGitAccounts: (...args: unknown[]) => mockGetGitAccounts(...args),
}));

import { ipcMain, dialog, BrowserWindow } from "electron";
import { registerRepoHandlers } from "./repo.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("repo IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    // No repo account by default
    mockGetRepoAccount.mockReturnValue(null);
    mockGetGitAccounts.mockReturnValue([]);
    registerRepoHandlers();
  });

  it("registers all REPO channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.REPO.OPEN);
    expect(channels).toContain(IPC.REPO.OPEN_DIALOG);
    expect(channels).toContain(IPC.REPO.INIT);
    expect(channels).toContain(IPC.REPO.CLOSE);
    expect(channels).toContain(IPC.REPO.GET_LAST_OPENED);
    expect(channels).toContain(IPC.REPO.GET_RECENT);
    expect(channels).toContain(IPC.REPO.REMOVE_RECENT);
    expect(channels).toContain(IPC.REPO.CLEAR_RECENT);
    expect(channels).toContain(IPC.REPO.REMOVE_MISSING);
    expect(channels).toContain(IPC.REPO.GET_INFO);
    expect(channels).toContain(IPC.REPO.SET_CATEGORY);
    expect(channels).toContain(IPC.REPO.GET_CATEGORIES);
    expect(channels).toContain(IPC.REPO.RENAME_CATEGORY);
    expect(channels).toContain(IPC.REPO.DELETE_CATEGORY);
    expect(channels).toContain(IPC.REPO.SCAN_FOR_REPOS);
    expect(channels).toContain(IPC.REPO.OPEN_EXTERNAL);
    expect(channels).toContain(IPC.REPO.BROWSE_DIRECTORY);
    expect(channels).toContain(IPC.REPO.BROWSE_FILE);
    expect(channels).toContain(IPC.REPO.GET_VIEW_SETTINGS);
    expect(channels).toContain(IPC.REPO.SET_VIEW_SETTINGS);
  });

  it("REPO.OPEN calls openRepo, records recent repo and last opened, returns info", async () => {
    const fakeInfo = { path: "/home/user/repo", branch: "main" };
    mockOpenRepo.mockResolvedValueOnce(fakeInfo);
    const result = await getHandler(IPC.REPO.OPEN)({}, "/home/user/repo");
    expect(mockOpenRepo).toHaveBeenCalledWith("/home/user/repo");
    expect(mockAddRecentRepo).toHaveBeenCalledWith("/home/user/repo");
    expect(mockSetLastOpenedRepo).toHaveBeenCalledWith("/home/user/repo");
    expect(result).toBe(fakeInfo);
  });

  it("REPO.CLOSE calls closeRepo and clears last opened", () => {
    const handler = getHandler(IPC.REPO.CLOSE);
    handler({});
    expect(mockCloseRepo).toHaveBeenCalled();
    expect(mockSetLastOpenedRepo).toHaveBeenCalledWith(null);
  });

  it("REPO.GET_LAST_OPENED returns getLastOpenedRepo result", () => {
    mockGetLastOpenedRepo.mockReturnValueOnce("/home/user/repo");
    const result = getHandler(IPC.REPO.GET_LAST_OPENED)({});
    expect(result).toBe("/home/user/repo");
  });

  it("REPO.GET_RECENT returns getRecentRepos result", () => {
    const repos = ["/home/user/repo1", "/home/user/repo2"];
    mockGetRecentRepos.mockReturnValueOnce(repos);
    const result = getHandler(IPC.REPO.GET_RECENT)({});
    expect(result).toBe(repos);
  });

  it("REPO.REMOVE_RECENT calls removeRecentRepo with path", () => {
    getHandler(IPC.REPO.REMOVE_RECENT)({}, "/home/user/repo");
    expect(mockRemoveRecentRepo).toHaveBeenCalledWith("/home/user/repo");
  });

  it("REPO.CLEAR_RECENT calls clearRecentRepos", () => {
    getHandler(IPC.REPO.CLEAR_RECENT)({});
    expect(mockClearRecentRepos).toHaveBeenCalled();
  });

  it("REPO.REMOVE_MISSING calls removeMissingRepos and returns result", () => {
    const removed = ["/old/path"];
    mockRemoveMissingRepos.mockReturnValueOnce(removed);
    const result = getHandler(IPC.REPO.REMOVE_MISSING)({});
    expect(mockRemoveMissingRepos).toHaveBeenCalled();
    expect(result).toBe(removed);
  });

  it("REPO.GET_INFO returns null when no repo is open", async () => {
    mockIsOpen.mockReturnValueOnce(false);
    const result = await getHandler(IPC.REPO.GET_INFO)({});
    expect(result).toBeNull();
  });

  it("REPO.GET_INFO returns repoInfo when repo is open", async () => {
    const fakeInfo = { path: "/home/user/repo", branch: "main" };
    mockIsOpen.mockReturnValueOnce(true);
    mockGetRepoInfo.mockResolvedValueOnce(fakeInfo);
    const result = await getHandler(IPC.REPO.GET_INFO)({});
    expect(result).toBe(fakeInfo);
  });

  it("REPO.SET_CATEGORY calls setRepoCategory with repoPath and category", () => {
    getHandler(IPC.REPO.SET_CATEGORY)({}, "/home/user/repo", "work");
    expect(mockSetRepoCategory).toHaveBeenCalledWith("/home/user/repo", "work");
  });

  it("REPO.GET_CATEGORIES returns getRepoCategories result", () => {
    const cats = ["work", "personal"];
    mockGetRepoCategories.mockReturnValueOnce(cats);
    const result = getHandler(IPC.REPO.GET_CATEGORIES)({});
    expect(result).toBe(cats);
  });

  it("REPO.RENAME_CATEGORY calls renameCategory", () => {
    getHandler(IPC.REPO.RENAME_CATEGORY)({}, "old", "new");
    expect(mockRenameCategory).toHaveBeenCalledWith("old", "new");
  });

  it("REPO.DELETE_CATEGORY calls deleteCategory", () => {
    getHandler(IPC.REPO.DELETE_CATEGORY)({}, "work");
    expect(mockDeleteCategory).toHaveBeenCalledWith("work");
  });

  it("REPO.GET_VIEW_SETTINGS returns getRepoViewSettings result", () => {
    const settings = { showRemoteBranches: true };
    mockGetRepoViewSettings.mockReturnValueOnce(settings);
    const result = getHandler(IPC.REPO.GET_VIEW_SETTINGS)({}, "/home/user/repo");
    expect(mockGetRepoViewSettings).toHaveBeenCalledWith("/home/user/repo");
    expect(result).toBe(settings);
  });

  it("REPO.SET_VIEW_SETTINGS calls setRepoViewSettings", () => {
    const partial = { showRemoteBranches: false };
    getHandler(IPC.REPO.SET_VIEW_SETTINGS)({}, "/home/user/repo", partial);
    expect(mockSetRepoViewSettings).toHaveBeenCalledWith("/home/user/repo", partial);
  });

  it("REPO.OPEN_DIALOG returns null when dialog is canceled", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.OPEN_DIALOG)(fakeEvent);
    expect(result).toBeNull();
  });

  it("REPO.OPEN_DIALOG opens repo when a path is selected", async () => {
    const mockWin = { id: 1 };
    const fakeInfo = { path: "/home/user/new-repo", branch: "main" };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/home/user/new-repo"],
    });
    mockOpenRepo.mockResolvedValueOnce(fakeInfo);
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.OPEN_DIALOG)(fakeEvent);
    expect(mockOpenRepo).toHaveBeenCalledWith("/home/user/new-repo");
    expect(result).toBe(fakeInfo);
  });

  it("REPO.OPEN_DIALOG returns null when no BrowserWindow found", async () => {
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.OPEN_DIALOG)(fakeEvent);
    expect(result).toBeNull();
  });

  it("REPO.SCAN_FOR_REPOS calls scanForRepos and adds found repos", async () => {
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: vi.fn() },
    };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    const foundRepos = ["/home/user/found1", "/home/user/found2"];
    mockScanForRepos.mockResolvedValueOnce(foundRepos);
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.SCAN_FOR_REPOS)(fakeEvent, "/home/user", 3);
    expect(mockScanForRepos).toHaveBeenCalledWith("/home/user", 3, expect.any(Function));
    expect(mockAddMultipleRecentRepos).toHaveBeenCalledWith(foundRepos);
    expect(result).toBe(foundRepos);
  });

  it("REPO.SCAN_FOR_REPOS does not call addMultipleRecentRepos when no repos found", async () => {
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: vi.fn() },
    };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    mockScanForRepos.mockResolvedValueOnce([]);
    const fakeEvent = { sender: {} };
    await getHandler(IPC.REPO.SCAN_FOR_REPOS)(fakeEvent, "/home/user", 3);
    expect(mockAddMultipleRecentRepos).not.toHaveBeenCalled();
  });

  it("REPO.SCAN_FOR_REPOS progress callback sends IPC event when window is alive", async () => {
    const sendMock = vi.fn();
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: sendMock },
    };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);

    let capturedCallback!: (p: unknown) => void;
    mockScanForRepos.mockImplementation(
      (_root: unknown, _depth: unknown, cb: (p: unknown) => void) => {
        capturedCallback = cb;
        return Promise.resolve([]);
      }
    );

    const fakeEvent = { sender: {} };
    const scanPromise = getHandler(IPC.REPO.SCAN_FOR_REPOS)(fakeEvent, "/home/user", 3);
    capturedCallback({ current: 5, total: 10 });
    await scanPromise;

    expect(sendMock).toHaveBeenCalledWith(IPC.EVENTS.SCAN_PROGRESS, {
      current: 5,
      total: 10,
    });
  });

  it("REPO.SCAN_FOR_REPOS progress callback skips send when window is destroyed", async () => {
    const sendMock = vi.fn();
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(true),
      webContents: { send: sendMock },
    };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);

    let capturedCallback!: (p: unknown) => void;
    mockScanForRepos.mockImplementation(
      (_root: unknown, _depth: unknown, cb: (p: unknown) => void) => {
        capturedCallback = cb;
        return Promise.resolve([]);
      }
    );

    const fakeEvent = { sender: {} };
    const scanPromise = getHandler(IPC.REPO.SCAN_FOR_REPOS)(fakeEvent, "/home/user", 3);
    capturedCallback({ current: 5, total: 10 });
    await scanPromise;

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("REPO.INIT returns null when dialog is cancelled", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.INIT)(fakeEvent);
    expect(result).toBeNull();
    expect(mockInitRepo).not.toHaveBeenCalled();
  });

  it("REPO.INIT returns null when no BrowserWindow found", async () => {
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.INIT)(fakeEvent);
    expect(result).toBeNull();
  });

  it("REPO.INIT initialises repo when path is selected", async () => {
    const mockWin = { id: 1 };
    const fakeInfo = { path: "/home/user/new", branch: "main" };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/home/user/new"],
    });
    mockInitRepo.mockResolvedValueOnce(fakeInfo);
    const fakeEvent = { sender: {} };
    const result = await getHandler(IPC.REPO.INIT)(fakeEvent);
    expect(mockInitRepo).toHaveBeenCalledWith("/home/user/new");
    expect(mockAddRecentRepo).toHaveBeenCalledWith("/home/user/new");
    expect(mockSetLastOpenedRepo).toHaveBeenCalledWith("/home/user/new");
    expect(result).toBe(fakeInfo);
  });

  it("REPO.OPEN_EXTERNAL calls shell.openExternal with the URL", async () => {
    const { shell } = await import("electron");
    await getHandler(IPC.REPO.OPEN_EXTERNAL)({}, "https://github.com/user/repo");
    expect(shell.openExternal).toHaveBeenCalledWith("https://github.com/user/repo");
  });

  it("REPO.BROWSE_DIRECTORY returns null when no BrowserWindow", async () => {
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const result = await getHandler(IPC.REPO.BROWSE_DIRECTORY)({ sender: {} });
    expect(result).toBeNull();
  });

  it("REPO.BROWSE_DIRECTORY returns null when dialog is cancelled", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const result = await getHandler(IPC.REPO.BROWSE_DIRECTORY)({ sender: {} });
    expect(result).toBeNull();
  });

  it("REPO.BROWSE_DIRECTORY returns selected path", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/chosen/dir"],
    });
    const result = await getHandler(IPC.REPO.BROWSE_DIRECTORY)({ sender: {} }, "Pick Dir");
    expect(result).toBe("/chosen/dir");
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({ title: "Pick Dir" })
    );
  });

  it("REPO.BROWSE_DIRECTORY uses default title when none provided", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/chosen/dir"],
    });
    await getHandler(IPC.REPO.BROWSE_DIRECTORY)({ sender: {} });
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({ title: "Select Directory" })
    );
  });

  it("REPO.BROWSE_FILE returns null when no BrowserWindow", async () => {
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const result = await getHandler(IPC.REPO.BROWSE_FILE)({ sender: {} });
    expect(result).toBeNull();
  });

  it("REPO.BROWSE_FILE returns null when dialog is cancelled", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const result = await getHandler(IPC.REPO.BROWSE_FILE)({ sender: {} });
    expect(result).toBeNull();
  });

  it("REPO.BROWSE_FILE returns selected file path", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/chosen/file.ts"],
    });
    const result = await getHandler(IPC.REPO.BROWSE_FILE)({ sender: {} }, "Pick File", [
      { name: "TS", extensions: ["ts"] },
    ]);
    expect(result).toBe("/chosen/file.ts");
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({
        title: "Pick File",
        filters: [{ name: "TS", extensions: ["ts"] }],
      })
    );
  });

  it("REPO.BROWSE_FILE uses default title and filters when none provided", async () => {
    const mockWin = { id: 1 };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/chosen/file.ts"],
    });
    await getHandler(IPC.REPO.BROWSE_FILE)({ sender: {} });
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({
        title: "Select File",
        filters: [{ name: "All Files", extensions: ["*"] }],
      })
    );
  });

  it("REPO.OPEN applies repo account when one is set", async () => {
    const fakeInfo = { path: "/repo", branch: "main" };
    mockOpenRepo.mockResolvedValueOnce(fakeInfo);
    mockGetRepoAccount.mockReturnValueOnce("account-1");
    mockGetGitAccounts.mockReturnValueOnce([
      {
        id: "account-1",
        name: "Alice",
        email: "alice@example.com",
        signingKey: "key",
        sshKeyPath: "/path/key",
      },
    ]);
    await getHandler(IPC.REPO.OPEN)({}, "/repo");
    expect(mockApplyAccount).toHaveBeenCalledWith("Alice", "alice@example.com", {
      signingKey: "key",
      sshKeyPath: "/path/key",
    });
  });

  it("REPO.OPEN skips applyAccount when account not found in list", async () => {
    const fakeInfo = { path: "/repo", branch: "main" };
    mockOpenRepo.mockResolvedValueOnce(fakeInfo);
    mockGetRepoAccount.mockReturnValueOnce("missing-id");
    mockGetGitAccounts.mockReturnValueOnce([]);
    await getHandler(IPC.REPO.OPEN)({}, "/repo");
    expect(mockApplyAccount).not.toHaveBeenCalled();
  });

  it("REPO.OPEN_DIALOG applies repo account when one is set", async () => {
    const mockWin = { id: 1 };
    const fakeInfo = { path: "/repo", branch: "main" };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    (dialog.showOpenDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canceled: false,
      filePaths: ["/repo"],
    });
    mockOpenRepo.mockResolvedValueOnce(fakeInfo);
    mockGetRepoAccount.mockReturnValueOnce("account-2");
    mockGetGitAccounts.mockReturnValueOnce([
      {
        id: "account-2",
        name: "Bob",
        email: "bob@example.com",
        signingKey: null,
        sshKeyPath: null,
      },
    ]);
    await getHandler(IPC.REPO.OPEN_DIALOG)({ sender: {} });
    expect(mockApplyAccount).toHaveBeenCalledWith("Bob", "bob@example.com", {
      signingKey: null,
      sshKeyPath: null,
    });
  });
});
