import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { windowManager } from "../window-manager";
import { getMainWindow } from "../index";
import type { DialogOpenRequest, DialogResult } from "../../shared/dialog-types";

export function registerDialogHandlers(): void {
  ipcMain.handle(
    IPC.DIALOG.OPEN,
    (_event: IpcMainInvokeEvent, request: DialogOpenRequest) => {
      const win = windowManager.openDialog(request.dialog, request.data);
      return { windowId: win.id };
    },
  );

  ipcMain.handle(
    IPC.DIALOG.CLOSE,
    (_event: IpcMainInvokeEvent, dialogKey: string) => {
      windowManager.closeDialog(dialogKey);
    },
  );

  ipcMain.handle(IPC.DIALOG.GET_INIT_DATA, (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return undefined;
    return windowManager.getInitData(win.id);
  });

  // Child sends result — forward to main window and mark as sent (prevents double delivery)
  ipcMain.on(IPC.DIALOG.RESULT, (event, result: DialogResult) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowManager.markResultSent(win.id);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.DIALOG.ON_RESULT, result);
    }
  });
}
