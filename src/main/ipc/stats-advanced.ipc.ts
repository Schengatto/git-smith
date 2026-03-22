import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerStatsAdvancedHandlers() {
  ipcMain.handle(
    IPC.STATS_ADVANCED.TIMELINE,
    async (_event, period?: "day" | "week" | "month") => {
      return gitService.getTimeline(period);
    }
  );

  ipcMain.handle(
    IPC.STATS_ADVANCED.CHURN,
    async (_event, period?: "day" | "week" | "month") => {
      return gitService.getChurn(period);
    }
  );

  ipcMain.handle(
    IPC.STATS_ADVANCED.CONTRIBUTORS_TIMELINE,
    async (_event, period?: "day" | "week" | "month") => {
      return gitService.getContributorsTimeline(period);
    }
  );
}
