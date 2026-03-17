import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerLogHandlers() {
  ipcMain.handle(
    IPC.LOG.GRAPH,
    async (
      _event,
      maxCount?: number,
      skip?: number,
      branchFilter?: string,
      branchVisibility?: { mode: "include" | "exclude"; branches: string[] }
    ) => {
      return gitService.getLog(
        maxCount ?? 500,
        skip ?? 0,
        branchFilter || undefined,
        branchVisibility
      );
    }
  );

  ipcMain.handle(IPC.LOG.DETAILS, async (_event, hash: string) => {
    return gitService.getCommitDetails(hash);
  });

  ipcMain.handle(IPC.LOG.FULL_INFO, async (_event, hash: string) => {
    return gitService.getCommitFullInfo(hash);
  });

  ipcMain.handle(IPC.LOG.SHOW_FILE, async (_event, hash: string, filePath: string) => {
    return gitService.showFile(hash, filePath);
  });
}
