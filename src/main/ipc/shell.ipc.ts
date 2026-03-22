import { app, ipcMain, shell } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import path from "path";

export function registerShellHandlers() {
  ipcMain.handle(IPC.APP.OPEN_USER_MANUAL, async () => {
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, "USER_MANUAL.md")
      : path.join(app.getAppPath(), "USER_MANUAL.md");
    await shell.openPath(basePath);
  });

  ipcMain.handle(IPC.SHELL.OPEN_FILE, async (_event, filePath: string) => {
    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository open");
    const fullPath = path.resolve(repoPath, filePath);
    await shell.openPath(fullPath);
  });

  ipcMain.handle(IPC.SHELL.SHOW_IN_FOLDER, async (_event, filePath: string) => {
    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository open");
    const fullPath = path.resolve(repoPath, filePath);
    shell.showItemInFolder(fullPath);
  });
}
