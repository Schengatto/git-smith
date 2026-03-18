import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { parseChangelog } from "../git/changelog-parser";

export function registerChangelogHandlers(): void {
  ipcMain.handle(
    IPC.CHANGELOG.TAGS_BEFORE,
    async (_event: IpcMainInvokeEvent, hash: string) => {
      return gitService.getTagsBefore(hash);
    },
  );

  ipcMain.handle(
    IPC.CHANGELOG.GENERATE,
    async (_event: IpcMainInvokeEvent, from: string, to: string) => {
      const entries = await gitService.getChangelogCommits(from, to);
      return parseChangelog(entries, from, to);
    },
  );
}
