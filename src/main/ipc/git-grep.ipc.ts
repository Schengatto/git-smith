import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerGrepHandlers() {
  ipcMain.handle(
    IPC.GREP.SEARCH,
    async (
      _event,
      pattern: string,
      options?: {
        ignoreCase?: boolean;
        regex?: boolean;
        wholeWord?: boolean;
        maxCount?: number;
      }
    ) => {
      return gitService.grep(pattern, options || {});
    }
  );
}
