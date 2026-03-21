import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerReflogHandlers() {
  ipcMain.handle(IPC.REFLOG.LIST, async (_event, maxCount?: number) => {
    return gitService.getReflog(maxCount);
  });
}
