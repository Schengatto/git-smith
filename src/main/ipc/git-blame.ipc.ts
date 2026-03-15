import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerBlameHandlers() {
  ipcMain.handle(IPC.BLAME.FILE, async (_event, file: string) => {
    return gitService.blame(file);
  });

  ipcMain.handle(IPC.HISTORY.FILE, async (_event, file: string, maxCount?: number) => {
    return gitService.getFileHistory(file, maxCount);
  });

  ipcMain.handle(IPC.SUBMODULE.LIST, async () => {
    return gitService.getSubmodules();
  });

  ipcMain.handle(IPC.SUBMODULE.UPDATE, async (_event, init?: boolean) => {
    await gitService.submoduleUpdate(init);
  });
}
