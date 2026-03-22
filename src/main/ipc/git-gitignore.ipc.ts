import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { gitignoreTemplates } from "../../shared/gitignore-templates";
import fs from "fs";
import path from "path";

function getGitignorePath(): string {
  const repoPath = gitService.getRepoPath();
  if (!repoPath) throw new Error("No repository open");
  return path.join(repoPath, ".gitignore");
}

export function registerGitignoreHandlers() {
  ipcMain.handle(IPC.GITIGNORE.ADD, async (_event, pattern: string) => {
    const gitignorePath = getGitignorePath();
    let content = "";

    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf-8");
    }

    const lines = content.split(/\r?\n/);
    if (lines.some((line) => line.trim() === pattern.trim())) {
      return;
    }

    const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(gitignorePath, content + separator + pattern + "\n", "utf-8");
  });

  ipcMain.handle(IPC.GITIGNORE.READ, async () => {
    const gitignorePath = getGitignorePath();
    if (!fs.existsSync(gitignorePath)) return "";
    return fs.readFileSync(gitignorePath, "utf-8");
  });

  ipcMain.handle(IPC.GITIGNORE.WRITE, async (_event, content: string) => {
    const gitignorePath = getGitignorePath();
    fs.writeFileSync(gitignorePath, content, "utf-8");
  });

  ipcMain.handle(IPC.GITIGNORE.PREVIEW, async () => {
    return gitService.getIgnoredFiles();
  });

  ipcMain.handle(IPC.GITIGNORE.TEMPLATES, async () => {
    return gitignoreTemplates;
  });
}
