import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerLogRangeHandlers() {
  ipcMain.handle(IPC.LOG_RANGE.COMPARE, async (_event, from: string, to: string) => {
    return gitService.logRange(from, to);
  });
}
