import { BrowserWindow } from "electron";
import path from "path";
import type { DialogName, DialogResult } from "../shared/dialog-types";
import { DIALOG_CONFIGS } from "../shared/dialog-types";
import { IPC } from "../shared/ipc-channels";
import { getMainWindow } from "./index";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private initDataMap = new Map<number, Record<string, unknown>>();
  /** Tracks windows that already sent an explicit result (to avoid double delivery) */
  private resultSent = new Set<number>();

  setInitData(windowId: number, data: Record<string, unknown>): void {
    this.initDataMap.set(windowId, data);
  }

  getInitData(windowId: number): Record<string, unknown> | undefined {
    const data = this.initDataMap.get(windowId);
    if (data !== undefined) this.initDataMap.delete(windowId);
    return data;
  }

  track(key: string, win: BrowserWindow): void {
    this.windows.set(key, win);
    win.on("closed", () => {
      this.windows.delete(key);
    });
  }

  getWindow(key: string): BrowserWindow | undefined {
    const win = this.windows.get(key);
    if (win && !win.isDestroyed()) return win;
    this.windows.delete(key);
    return undefined;
  }

  markResultSent(windowId: number): void {
    this.resultSent.add(windowId);
  }

  openDialog(dialogName: DialogName, data?: Record<string, unknown>): BrowserWindow {
    const config = DIALOG_CONFIGS[dialogName];

    const trackKey =
      dialogName === "CommitInfoWindow" && data?.commitHash
        ? `CommitInfoWindow:${data.commitHash}`
        : dialogName;

    const existing = this.getWindow(trackKey);
    if (existing) {
      existing.focus();
      return existing;
    }

    const mainWindow = getMainWindow();

    const child = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      parent: mainWindow || undefined,
      modal: config.modal,
      show: false,
      title: dialogName.replace(/([A-Z])/g, " $1").trim(),
      backgroundColor: "#1e1e2e",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    if (data) {
      this.setInitData(child.id, data);
    }

    child.once("ready-to-show", () => child.show());

    // When child closes, send "closed" result ONLY if no explicit result was already sent
    child.on("closed", () => {
      if (this.resultSent.has(child.id)) {
        this.resultSent.delete(child.id);
        return;
      }
      const main = getMainWindow();
      if (main && !main.isDestroyed()) {
        main.webContents.send(IPC.DIALOG.ON_RESULT, {
          dialogName,
          action: "closed",
        } satisfies DialogResult);
      }
    });

    this.track(trackKey, child);

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      child.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?dialog=${dialogName}`);
    } else {
      child.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
        search: `dialog=${dialogName}`,
      });
    }

    return child;
  }

  closeDialog(key: string): void {
    const win = this.getWindow(key);
    if (win) win.close();
  }

  closeAll(): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) win.close();
    }
    this.windows.clear();
  }
}

export const windowManager = new WindowManager();
