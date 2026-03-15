import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import fs from "fs";
import path from "path";

export function registerGitignoreHandlers() {
  ipcMain.handle(IPC.GITIGNORE.ADD, async (_event, pattern: string) => {
    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository open");

    const gitignorePath = path.join(repoPath, ".gitignore");
    let content = "";

    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf-8");
    }

    // Check if pattern already exists
    const lines = content.split(/\r?\n/);
    if (lines.some((line) => line.trim() === pattern.trim())) {
      return; // Already in .gitignore
    }

    // Append with newline
    const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(gitignorePath, content + separator + pattern + "\n", "utf-8");
  });
}
