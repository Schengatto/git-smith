import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerDiffBranchesHandlers() {
  ipcMain.handle(IPC.DIFF_BRANCHES.COMPARE, async (_event, from: string, to: string) => {
    return gitService.diffBranches(from, to);
  });
}
