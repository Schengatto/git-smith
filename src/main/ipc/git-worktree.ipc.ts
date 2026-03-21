import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerWorktreeHandlers() {
  ipcMain.handle(IPC.WORKTREE.LIST, async () => {
    return gitService.worktreeList();
  });

  ipcMain.handle(
    IPC.WORKTREE.ADD,
    async (_event, path: string, branch?: string, createBranch?: boolean) => {
      await gitService.worktreeAdd(path, branch, createBranch);
    }
  );

  ipcMain.handle(
    IPC.WORKTREE.REMOVE,
    async (_event, path: string, force?: boolean) => {
      await gitService.worktreeRemove(path, force);
    }
  );
}
