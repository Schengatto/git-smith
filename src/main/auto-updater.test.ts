import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    currentVersion: { version: "0.2.0" },
  },
}));

import { initAutoUpdater } from "./auto-updater";
import { autoUpdater } from "electron-updater";
import { app, ipcMain, dialog } from "electron";

describe("initAutoUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip setup when app is not packaged", () => {
    Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
    initAutoUpdater({} as unknown as Electron.BrowserWindow);
    expect(autoUpdater.on).not.toHaveBeenCalled();
    expect(ipcMain.handle).not.toHaveBeenCalled();
  });

  it("should register event handlers when app is packaged", () => {
    Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    const mockWin = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    initAutoUpdater(mockWin as unknown as Electron.BrowserWindow);
    expect(autoUpdater.on).toHaveBeenCalled();
    expect(ipcMain.handle).toHaveBeenCalled();
  });

  it("should show 'up to date' dialog on manual check when no update available", () => {
    Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    const mockWin = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    initAutoUpdater(mockWin as unknown as Electron.BrowserWindow);

    // Find the IPC handler for CHECK_FOR_UPDATES and call it to set manualCheckInProgress
    const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
    const checkHandler = handleCalls.find((c) => c[0] === "app:check-for-updates");
    expect(checkHandler).toBeDefined();
    checkHandler![1]({} as Electron.IpcMainInvokeEvent);

    // Simulate update-not-available event
    const onCalls = vi.mocked(autoUpdater.on).mock.calls;
    const notAvailableHandler = onCalls.find((c) => c[0] === "update-not-available");
    expect(notAvailableHandler).toBeDefined();
    (notAvailableHandler![1] as () => void)();

    // Should show dialog with "up to date" message
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({
        title: "No Updates Available",
        message: "You are running the latest version.",
      })
    );
  });

  it("should NOT show dialog on startup check when no update available", () => {
    Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    const mockWin = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    initAutoUpdater(mockWin as unknown as Electron.BrowserWindow);

    // Simulate update-not-available without manual check
    const onCalls = vi.mocked(autoUpdater.on).mock.calls;
    const notAvailableHandler = onCalls.find((c) => c[0] === "update-not-available");
    (notAvailableHandler![1] as () => void)();

    // Should NOT show any dialog
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
});
