import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import type { Timeframe } from "../../shared/stats-types";

export function registerStatsHandlers() {
  ipcMain.handle(IPC.STATS.LEADERBOARD, async (_event, timeframe: Timeframe) => {
    return gitService.getLeaderboard(timeframe);
  });

  ipcMain.handle(IPC.STATS.AUTHOR_DETAIL, async (_event, email: string, timeframe: Timeframe) => {
    return gitService.getAuthorDetail(email, timeframe);
  });

  ipcMain.handle(IPC.STATS.CODEBASE, async () => {
    return gitService.getCodebaseStats();
  });
}
