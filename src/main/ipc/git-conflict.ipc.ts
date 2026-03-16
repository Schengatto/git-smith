import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerConflictHandlers() {
  ipcMain.handle(IPC.CONFLICT.LIST, async () => {
    return gitService.getConflictedFiles();
  });

  ipcMain.handle(
    IPC.CONFLICT.FILE_CONTENT,
    async (_event, filePath: string) => {
      return gitService.getConflictFileContent(filePath);
    }
  );

  ipcMain.handle(
    IPC.CONFLICT.RESOLVE,
    async (_event, filePath: string) => {
      await gitService.resolveConflict(filePath);
    }
  );

  ipcMain.handle(
    IPC.CONFLICT.SAVE_MERGED,
    async (_event, filePath: string, content: string) => {
      await gitService.saveMergedFile(filePath, content);
    }
  );
}
