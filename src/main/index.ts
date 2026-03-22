import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
if (started) app.quit();

import path from "path";
import { registerAllHandlers } from "./ipc/index";
import { killTerminal } from "./ipc/terminal.ipc";
import { gitService } from "./git/git-service";
import {
  getWindowBounds,
  setWindowBounds,
  getSettings,
  updateSettings,
  getAutoFetchInterval,
  setAutoFetchInterval,
} from "./store";
import type { AppSettings } from "./store";
import { createMenu } from "./menu";
import { initAutoUpdater } from "./auto-updater";
import { IPC } from "../shared/ipc-channels";
import { startMcpServer } from "./mcp/mcp-server";
import { showNotification } from "./notifications/notification-service";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let autoFetchTimer: ReturnType<typeof setInterval> | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow() {
  const bounds = getWindowBounds();

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    title: "Git Expansion",
    icon: path.join(__dirname, "../../assets/icon.png"),
    backgroundColor: "#1e1e2e",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  gitService.setMainWindow(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.on("close", () => {
    if (mainWindow) {
      const b = mainWindow.getBounds();
      setWindowBounds({ width: b.width, height: b.height, x: b.x, y: b.y });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

// Auto-fetch
function startAutoFetch() {
  stopAutoFetch();
  const settings = getSettings();
  if (!settings.autoFetchEnabled || settings.autoFetchInterval <= 0) return;

  autoFetchTimer = setInterval(async () => {
    if (!gitService.isOpen()) return;
    try {
      const refsBefore = await gitService.getRefsSnapshot();
      if (settings.fetchPruneOnAuto) {
        await gitService.fetchPrune();
      } else {
        await gitService.fetchAll();
      }
      const refsAfter = await gitService.getRefsSnapshot();
      const hasChanges = refsBefore !== refsAfter;
      if (hasChanges && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.EVENTS.REPO_CHANGED);
      }
      if (hasChanges) {
        showNotification("Fetch Complete", "Repository updated from remote", "fetch");
      }
    } catch (err) {
      showNotification("Fetch Failed", String(err), "error");
    }
  }, settings.autoFetchInterval * 1000);
}

function stopAutoFetch() {
  if (autoFetchTimer) {
    clearInterval(autoFetchTimer);
    autoFetchTimer = null;
  }
}

// ── MCP Server mode ──────────────────────────────────────────────
// When launched with --mcp-server, run only the MCP server (no UI).
// Usage: electron . --mcp-server --repo /path/to/repo
if (app.commandLine.hasSwitch("mcp-server")) {
  const repoPath = app.commandLine.getSwitchValue("repo") || process.cwd();
  app.whenReady().then(() => {
    startMcpServer(repoPath).catch((err) => {
      console.error("[git-expansion] MCP server failed:", err.message);
      app.quit();
    });
  });
} else {
  // ── Normal GUI mode ────────────────────────────────────────────

  app.whenReady().then(() => {
    try {
      registerAllHandlers();

      // Settings IPC
      ipcMain.handle(IPC.SETTINGS.GET, () => getSettings());
      ipcMain.handle(IPC.SETTINGS.UPDATE, (_event, partial: Partial<AppSettings>) => {
        const updated = updateSettings(partial);
        // Restart auto-fetch if interval changed
        if ("autoFetchInterval" in partial || "autoFetchEnabled" in partial) {
          startAutoFetch();
        }
        return updated;
      });
      ipcMain.handle(IPC.SETTINGS.GET_AUTO_FETCH, () => getAutoFetchInterval());
      ipcMain.handle(IPC.SETTINGS.SET_AUTO_FETCH, (_event, seconds: number) => {
        setAutoFetchInterval(seconds);
        startAutoFetch();
      });

      // Git config IPC
      ipcMain.handle(IPC.GIT_CONFIG.GET, async (_event, key: string, global?: boolean) => {
        return gitService.isOpen() ? gitService.getConfig(key, global) : "";
      });
      ipcMain.handle(
        IPC.GIT_CONFIG.SET,
        async (_event, key: string, value: string, global?: boolean) => {
          if (gitService.isOpen()) await gitService.setConfig(key, value, global);
        }
      );
      ipcMain.handle(IPC.GIT_CONFIG.LIST, async (_event, global?: boolean) => {
        return gitService.isOpen() ? gitService.listConfig(global) : {};
      });

      createMenu();
      createWindow();
      startAutoFetch();
      if (mainWindow) initAutoUpdater(mainWindow);
    } catch (err) {
      console.error("[git-expansion] Failed to initialize:", err);
    }
  });

  app.on("window-all-closed", () => {
    stopAutoFetch();
    killTerminal();
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
} // end of normal GUI mode else block
