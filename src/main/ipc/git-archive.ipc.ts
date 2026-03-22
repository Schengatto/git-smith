import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerArchiveHandlers() {
  ipcMain.handle(
    IPC.ARCHIVE.EXPORT,
    async (_event, ref: string, outputPath: string, format: "zip" | "tar.gz") => {
      await gitService.archive(ref, outputPath, format);
    }
  );
}
