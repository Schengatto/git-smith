import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerStashHandlers() {
  ipcMain.handle(IPC.STASH.LIST, async () => {
    return gitService.getStashList();
  });

  ipcMain.handle(IPC.STASH.CREATE, async (_event, message?: string) => {
    await gitService.stashCreate(message);
  });

  ipcMain.handle(IPC.STASH.POP, async (_event, index?: number) => {
    await gitService.stashPop(index);
  });

  ipcMain.handle(IPC.STASH.APPLY, async (_event, index?: number) => {
    await gitService.stashApply(index);
  });

  ipcMain.handle(IPC.STASH.DROP, async (_event, index?: number) => {
    await gitService.stashDrop(index);
  });
}
