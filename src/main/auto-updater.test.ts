import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const { mockShowMessageBox, mockAutoUpdaterOn, mockCheckForUpdates, mockOpenExternal } = vi.hoisted(
  () => ({
    mockShowMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    mockAutoUpdaterOn: vi.fn(),
    mockCheckForUpdates: vi.fn().mockResolvedValue(null),
    mockOpenExternal: vi.fn().mockResolvedValue(undefined),
  })
);

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn() },
  dialog: { showMessageBox: mockShowMessageBox },
  shell: { openExternal: mockOpenExternal },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: mockAutoUpdaterOn,
    checkForUpdates: mockCheckForUpdates,
    currentVersion: { version: "1.0.0" },
  },
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { initAutoUpdater } from "./auto-updater";
import { autoUpdater } from "electron-updater";
import { app, ipcMain, dialog } from "electron";

// ── Helpers ────────────────────────────────────────────────────────────────

function getAutoUpdaterEventHandler(event: string): (...args: unknown[]) => void {
  const call = mockAutoUpdaterOn.mock.calls.find((c: unknown[]) => c[0] === event);
  if (!call) throw new Error(`autoUpdater.on("${event}") not registered`);
  return call[1] as (...args: unknown[]) => void;
}

function getIpcHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`ipcMain.handle("${channel}") not registered`);
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

function makeWindow(destroyed = false) {
  return {
    isDestroyed: vi.fn(() => destroyed),
    webContents: { send: vi.fn() },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("initAutoUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Not packaged ──────────────────────────────────────────────────────────

  describe("when app is not packaged", () => {
    it("returns early without registering any handlers", () => {
      Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      expect(mockAutoUpdaterOn).not.toHaveBeenCalled();
      expect(ipcMain.handle).not.toHaveBeenCalled();
    });
  });

  // ── Packaged ──────────────────────────────────────────────────────────────

  describe("when app is packaged", () => {
    beforeEach(() => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    });

    it("configures autoUpdater.autoDownload = false", () => {
      initAutoUpdater(makeWindow() as never);
      expect(autoUpdater.autoDownload).toBe(false);
    });

    it("configures autoUpdater.autoInstallOnAppQuit = false", () => {
      initAutoUpdater(makeWindow() as never);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    });

    it("registers all 4 autoUpdater event listeners", () => {
      initAutoUpdater(makeWindow() as never);
      const events = mockAutoUpdaterOn.mock.calls.map((c: unknown[]) => c[0]);
      expect(events).toContain("checking-for-update");
      expect(events).toContain("update-available");
      expect(events).toContain("update-not-available");
      expect(events).toContain("error");
    });

    it("registers IPC handlers for CHECK_FOR_UPDATES and GET_VERSION", () => {
      initAutoUpdater(makeWindow() as never);
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain("app:check-for-updates");
      expect(channels).toContain("app:get-version");
    });

    it("schedules a startup check after 10 seconds", () => {
      initAutoUpdater(makeWindow() as never);
      expect(mockCheckForUpdates).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10000);
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  // ── Event: checking-for-update ────────────────────────────────────────────

  describe("'checking-for-update' event", () => {
    it("sends update status 'checking' to the window", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("checking-for-update");
      handler();

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "checking",
        detail: undefined,
      });
    });
  });

  // ── Event: update-available ────────────────────────────────────────────────

  describe("'update-available' event", () => {
    it("sends update status 'available' with version", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "available",
        detail: "2.0.0",
      });
    });

    it("shows a dialog offering to open the download page", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        win,
        expect.objectContaining({
          title: "Update Available",
          message: expect.stringContaining("2.0.0"),
          buttons: ["Open Download Page", "Later"],
        })
      );
    });

    it("opens the releases page when user clicks 'Open Download Page'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 0 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(mockOpenExternal).toHaveBeenCalledWith(
        "https://github.com/Schengatto/git-smith/releases/latest"
      );
    });

    it("does NOT open external link when user clicks 'Later'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 1 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(mockOpenExternal).not.toHaveBeenCalled();
    });

    it("does not show dialog when mainWindow is destroyed", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow(true);
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });
  });

  // ── Event: update-not-available ────────────────────────────────────────────

  describe("'update-not-available' event", () => {
    it("sends update status 'up-to-date'", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-not-available");
      handler();

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "up-to-date",
        detail: undefined,
      });
    });

    it("shows dialog on manual check when up-to-date", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const notAvailableHandler = getAutoUpdaterEventHandler("update-not-available");
      notAvailableHandler();

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        win,
        expect.objectContaining({
          title: "No Updates Available",
          message: "You are running the latest version.",
        })
      );
    });

    it("does NOT show dialog on automatic (startup) check when up-to-date", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-not-available");
      handler();

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it("does NOT show dialog when mainWindow is destroyed (manual check)", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow(true);
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const handler = getAutoUpdaterEventHandler("update-not-available");
      handler();

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it("includes current version in the 'up to date' dialog", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const handler = getAutoUpdaterEventHandler("update-not-available");
      handler();

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        win,
        expect.objectContaining({ detail: expect.stringContaining("1.0.0") })
      );
    });

    it("resets manualCheckInProgress after firing", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      // Fire once — should show dialog
      const notAvailable = getAutoUpdaterEventHandler("update-not-available");
      notAvailable();
      expect(mockShowMessageBox).toHaveBeenCalledTimes(1);

      // Fire again without a new manual check — should NOT show dialog
      mockShowMessageBox.mockClear();
      notAvailable();
      expect(mockShowMessageBox).not.toHaveBeenCalled();
    });
  });

  // ── Event: error ──────────────────────────────────────────────────────────

  describe("'error' event", () => {
    it("sends update status 'error' with message", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("error");
      handler(new Error("Network failure"));

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "error",
        detail: "Network failure",
      });
    });

    it("shows error dialog on manual check", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const handler = getAutoUpdaterEventHandler("error");
      handler(new Error("Cannot connect"));

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        win,
        expect.objectContaining({
          type: "error",
          title: "Update Error",
          message: "Failed to check for updates.",
          detail: "Cannot connect",
        })
      );
    });

    it("does NOT show error dialog on automatic check", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("error");
      handler(new Error("Timeout"));

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it("does NOT show error dialog when mainWindow is destroyed", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow(true);
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const handler = getAutoUpdaterEventHandler("error");
      handler(new Error("fail"));

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it("resets manualCheckInProgress after error", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);
      await vi.runAllTimersAsync();

      const errorHandler = getAutoUpdaterEventHandler("error");
      errorHandler(new Error("fail"));

      // manualCheckInProgress reset — next update-not-available should not show dialog
      mockShowMessageBox.mockClear();
      const notAvailableHandler = getAutoUpdaterEventHandler("update-not-available");
      notAvailableHandler();

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });
  });

  // ── IPC handlers ──────────────────────────────────────────────────────────

  describe("IPC handler: app:check-for-updates", () => {
    it("calls autoUpdater.checkForUpdates", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      initAutoUpdater(makeWindow() as never);

      const handler = getIpcHandler("app:check-for-updates");
      await handler({} as never);

      expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it("resets manualCheckInProgress on checkForUpdates failure", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockCheckForUpdates.mockRejectedValueOnce(new Error("offline"));
      initAutoUpdater(makeWindow() as never);

      const handler = getIpcHandler("app:check-for-updates");
      await handler({} as never);

      mockShowMessageBox.mockClear();
      const notAvailableHandler = getAutoUpdaterEventHandler("update-not-available");
      notAvailableHandler();
      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });
  });

  describe("IPC handler: app:get-version", () => {
    it("returns the current version string", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      initAutoUpdater(makeWindow() as never);

      const handler = getIpcHandler("app:get-version");
      const version = handler({} as never);

      expect(version).toBe("1.0.0");
    });
  });

  // ── sendStatus edge cases ─────────────────────────────────────────────────

  describe("sendStatus edge cases", () => {
    it("does not call send when window is destroyed", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow(true);
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("checking-for-update");
      expect(() => handler()).not.toThrow();
      expect(win.webContents.send).not.toHaveBeenCalled();
    });
  });
});
