import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerDiffHandlers() {
  ipcMain.handle(
    IPC.DIFF.FILE,
    async (_event, file: string, staged?: boolean) => {
      return gitService.getDiff(file, staged);
    }
  );

  ipcMain.handle(IPC.DIFF.COMMIT, async (_event, hash: string) => {
    return gitService.getCommitDiff(hash);
  });

  ipcMain.handle(
    IPC.DIFF.COMMIT_FILE,
    async (_event, hash: string, file: string) => {
      return gitService.getCommitFileDiff(hash, file);
    }
  );

  ipcMain.handle(IPC.DIFF.COMMIT_FILES, async (_event, hash: string) => {
    return gitService.getCommitFiles(hash);
  });

  ipcMain.handle(IPC.DIFF.STAGED, async () => {
    return gitService.getDiff(undefined, true);
  });

  ipcMain.handle(IPC.DIFF.TREE_FILES, async (_event, hash: string) => {
    return gitService.getTreeFiles(hash);
  });

  ipcMain.handle(
    IPC.DIFF.RANGE_FILES,
    async (_event, hash1: string, hash2: string) => {
      return gitService.getRangeFiles(hash1, hash2);
    }
  );

  ipcMain.handle(
    IPC.DIFF.RANGE_FILE,
    async (_event, hash1: string, hash2: string, file: string) => {
      return gitService.getRangeFileDiff(hash1, hash2, file);
    }
  );
}
