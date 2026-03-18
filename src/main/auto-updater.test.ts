import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
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
import { app, ipcMain } from "electron";

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
});
