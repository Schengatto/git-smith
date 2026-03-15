import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { getRecentCommitMessages, addRecentCommitMessage } from "../store";

export function registerCommitHandlers() {
  ipcMain.handle(IPC.COMMIT.CREATE, async (_event, message: string) => {
    const result = await gitService.commit(message);
    addRecentCommitMessage(message);
    return result;
  });

  ipcMain.handle(IPC.COMMIT.AMEND, async (_event, message?: string) => {
    const result = await gitService.amend(message);
    if (message) addRecentCommitMessage(message);
    return result;
  });

  ipcMain.handle(IPC.COMMIT.GET_RECENT_MESSAGES, async () => {
    return getRecentCommitMessages();
  });
}
