import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerUndoHandlers() {
  ipcMain.handle(IPC.UNDO.HISTORY, async (_event, maxCount?: number) => {
    return gitService.getUndoHistory(maxCount);
  });

  ipcMain.handle(IPC.UNDO.REVERT, async (_event, reflogIndex: number) => {
    await gitService.undoToReflog(reflogIndex);
  });
}
