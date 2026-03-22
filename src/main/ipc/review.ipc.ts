import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import fs from "fs";
import path from "path";
import type { ReviewData, ReviewComment } from "../../shared/git-types";

function getReviewDir(): string {
  const repoPath = gitService.getRepoPath();
  if (!repoPath) throw new Error("No repository open");
  const dir = path.join(repoPath, ".git", "review-comments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getReviewPath(commitHash: string): string {
  return path.join(getReviewDir(), `${commitHash}.json`);
}

export function registerReviewHandlers() {
  ipcMain.handle(IPC.REVIEW.SAVE, async (_event, commitHash: string, comments: ReviewComment[]) => {
    const filePath = getReviewPath(commitHash);
    const data: ReviewData = {
      commitHash,
      comments,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  });

  ipcMain.handle(
    IPC.REVIEW.LOAD,
    async (_event, commitHash: string): Promise<ReviewData | null> => {
      const filePath = getReviewPath(commitHash);
      if (!fs.existsSync(filePath)) return null;
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch {
        return null;
      }
    }
  );

  ipcMain.handle(IPC.REVIEW.CLEAR, async (_event, commitHash: string) => {
    const filePath = getReviewPath(commitHash);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  ipcMain.handle(IPC.REVIEW.LIST_REVIEWS, async (): Promise<string[]> => {
    const dir = getReviewDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  });
}
