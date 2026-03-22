import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerStatusHandlers() {
  ipcMain.handle(IPC.STATUS.GET, async () => {
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.STAGE, async (_event, paths: string[]) => {
    await gitService.stage(paths);
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.STAGE_LINES, async (_event, patch: string) => {
    await gitService.stageLines(patch);
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.UNSTAGE, async (_event, paths: string[]) => {
    await gitService.unstage(paths);
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.UNSTAGE_LINES, async (_event, patch: string) => {
    await gitService.unstageLines(patch);
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.DISCARD, async (_event, paths: string[]) => {
    await gitService.discard(paths);
    return gitService.getStatus();
  });

  ipcMain.handle(IPC.STATUS.DISCARD_ALL, async () => {
    await gitService.discardAll();
    return gitService.getStatus();
  });
}
