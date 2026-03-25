import type { UpdateInfo } from "electron-updater";
import { autoUpdater } from "electron-updater";
import type { BrowserWindow } from "electron";
import { app, ipcMain, dialog, shell } from "electron";
import { IPC } from "../shared/ipc-channels";

const RELEASES_URL = "https://github.com/Schengatto/git-smith/releases/latest";

let mainWindow: BrowserWindow | null = null;
let manualCheckInProgress = false;

export function initAutoUpdater(win: BrowserWindow) {
  if (!app.isPackaged) return;

  mainWindow = win;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    sendStatus("checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendStatus("available", info.version);
    manualCheckInProgress = false;

    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available.`,
        detail: "Would you like to open the download page?",
        buttons: ["Open Download Page", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          shell.openExternal(RELEASES_URL);
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus("up-to-date");

    if (manualCheckInProgress && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "No Updates Available",
        message: "You are running the latest version.",
        detail: `Current version: ${autoUpdater.currentVersion.version}`,
        buttons: ["OK"],
      });
    }
    manualCheckInProgress = false;
  });

  autoUpdater.on("error", (err) => {
    sendStatus("error", err.message);

    if (manualCheckInProgress && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Update Error",
        message: "Failed to check for updates.",
        detail: err.message,
        buttons: ["OK"],
      });
    }
    manualCheckInProgress = false;
  });

  // IPC handlers
  ipcMain.handle(IPC.APP.CHECK_FOR_UPDATES, async () => {
    manualCheckInProgress = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      manualCheckInProgress = false;
    }
  });

  ipcMain.handle(IPC.APP.GET_VERSION, () => {
    return autoUpdater.currentVersion.version;
  });

  // Check on startup (after a delay) — silent, no dialog if up-to-date
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      /* silent startup check — ignore network errors */
    });
  }, 10000);
}

function sendStatus(status: string, detail?: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP.UPDATE_STATUS, { status, detail });
  }
}
