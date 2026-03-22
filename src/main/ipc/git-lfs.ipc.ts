import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerLfsHandlers() {
  ipcMain.handle(IPC.LFS.STATUS, async () => {
    return gitService.lfsStatus();
  });

  ipcMain.handle(IPC.LFS.LIST_TRACKED, async () => {
    return gitService.lfsListTracked();
  });

  ipcMain.handle(IPC.LFS.TRACK, async (_event, pattern: string) => {
    await gitService.lfsTrack(pattern);
  });

  ipcMain.handle(IPC.LFS.UNTRACK, async (_event, pattern: string) => {
    await gitService.lfsUntrack(pattern);
  });

  ipcMain.handle(IPC.LFS.INFO, async () => {
    return gitService.lfsInfo();
  });

  ipcMain.handle(IPC.LFS.INSTALL, async () => {
    return gitService.lfsInstall();
  });
}
