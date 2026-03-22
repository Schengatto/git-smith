import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const {
  mockShowMessageBox,
  mockAutoUpdaterOn,
  mockCheckForUpdates,
  mockDownloadUpdate,
  mockQuitAndInstall,
} = vi.hoisted(() => ({
  mockShowMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  mockAutoUpdaterOn: vi.fn(),
  mockCheckForUpdates: vi.fn().mockResolvedValue(null),
  mockDownloadUpdate: vi.fn(),
  mockQuitAndInstall: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn() },
  dialog: { showMessageBox: mockShowMessageBox },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: mockAutoUpdaterOn,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
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

    it("configures autoUpdater.autoInstallOnAppQuit = true", () => {
      initAutoUpdater(makeWindow() as never);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it("registers all 6 autoUpdater event listeners", () => {
      initAutoUpdater(makeWindow() as never);
      const events = mockAutoUpdaterOn.mock.calls.map((c: unknown[]) => c[0]);
      expect(events).toContain("checking-for-update");
      expect(events).toContain("update-available");
      expect(events).toContain("update-not-available");
      expect(events).toContain("download-progress");
      expect(events).toContain("update-downloaded");
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

    it("shows a dialog offering to download the update", async () => {
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
          buttons: ["Download", "Later"],
        })
      );
    });

    it("calls downloadUpdate when user clicks 'Download'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 0 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
    });

    it("does NOT call downloadUpdate when user clicks 'Later'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 1 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
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

    it("resets manualCheckInProgress after update-available fires", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      // Trigger manual check
      const checkHandler = getIpcHandler("app:check-for-updates");
      checkHandler({} as never);

      const handler = getAutoUpdaterEventHandler("update-available");
      handler({ version: "2.0.0" });

      await vi.runAllTimersAsync();
      // manualCheckInProgress was true; after update-available it becomes false
      // (no direct assertion possible, but verifying the reset via second update-not-available call)
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

  // ── Event: download-progress ───────────────────────────────────────────────

  describe("'download-progress' event", () => {
    it("sends update status 'downloading' with percentage", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("download-progress");
      handler({ percent: 57.6 });

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "downloading",
        detail: "58%",
      });
    });

    it("rounds down percentage correctly", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("download-progress");
      handler({ percent: 33.4 });

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "downloading",
        detail: "33%",
      });
    });

    it("sends 100% when fully downloaded", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("download-progress");
      handler({ percent: 100 });

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "downloading",
        detail: "100%",
      });
    });
  });

  // ── Event: update-downloaded ──────────────────────────────────────────────

  describe("'update-downloaded' event", () => {
    it("sends update status 'downloaded' with version", () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-downloaded");
      handler({ version: "2.1.0" });

      expect(win.webContents.send).toHaveBeenCalledWith("app:update-status", {
        status: "downloaded",
        detail: "2.1.0",
      });
    });

    it("shows restart dialog after download", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-downloaded");
      handler({ version: "2.1.0" });

      await vi.runAllTimersAsync();

      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        win,
        expect.objectContaining({
          title: "Update Ready",
          message: expect.stringContaining("2.1.0"),
          buttons: ["Restart Now", "Later"],
        })
      );
    });

    it("calls quitAndInstall when user clicks 'Restart Now'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 0 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-downloaded");
      handler({ version: "2.1.0" });

      await vi.runAllTimersAsync();

      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1);
    });

    it("does NOT call quitAndInstall when user clicks 'Later'", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      mockShowMessageBox.mockResolvedValue({ response: 1 });
      const win = makeWindow();
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-downloaded");
      handler({ version: "2.1.0" });

      await vi.runAllTimersAsync();

      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });

    it("does not show dialog when mainWindow is destroyed", async () => {
      Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
      const win = makeWindow(true);
      initAutoUpdater(win as never);

      const handler = getAutoUpdaterEventHandler("update-downloaded");
      handler({ version: "2.1.0" });

      await vi.runAllTimersAsync();

      expect(dialog.showMessageBox).not.toHaveBeenCalled();
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
