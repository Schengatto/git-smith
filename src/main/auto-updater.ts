import { autoUpdater, UpdateInfo } from "electron-updater";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { IPC } from "../shared/ipc-channels";

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow) {
  if (!app.isPackaged) return;

  mainWindow = win;

  // Configure
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendStatus("checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendStatus("available", info.version);

    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available.`,
        detail: "Would you like to download it now?",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus("up-to-date");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendStatus("downloading", `${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    sendStatus("downloaded", info.version);

    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded.`,
        detail: "Restart the application to apply the update.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    sendStatus("error", err.message);
  });

  // IPC handlers
  ipcMain.handle(IPC.APP.CHECK_FOR_UPDATES, async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // silent — may fail without internet
    }
  });

  ipcMain.handle(IPC.APP.GET_VERSION, () => {
    return autoUpdater.currentVersion.version;
  });

  // Check on startup (after a delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10000);
}

function sendStatus(status: string, detail?: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP.UPDATE_STATUS, { status, detail });
  }
}
