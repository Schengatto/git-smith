import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { getPlatformTokenForRepo } from "../store";
import { githubGetCIStatus, gitlabGetCIStatus } from "../git/platform-api";
import type { CIStatus } from "../../shared/git-types";

export function registerCIStatusHandlers() {
  ipcMain.handle(IPC.CI.STATUS, async (_event, sha: string): Promise<CIStatus[]> => {
    const detection = await gitService.detectProvider();
    const repoPath = gitService.getRepoPath();
    const token = repoPath ? getPlatformTokenForRepo(repoPath) : null;
    if (!token) return [];

    if (detection.provider === "github") {
      try {
        return await githubGetCIStatus(detection.owner, detection.repo, token, sha);
      } catch {
        return [];
      }
    }
    if (detection.provider === "gitlab") {
      try {
        return await gitlabGetCIStatus(detection.owner, detection.repo, token, sha);
      } catch {
        return [];
      }
    }
    return [];
  });
}
