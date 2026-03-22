import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerBisectHandlers() {
  ipcMain.handle(IPC.BISECT.START, async (_event, bad?: string, good?: string) => {
    return gitService.bisectStart(bad, good);
  });

  ipcMain.handle(IPC.BISECT.GOOD, async (_event, ref?: string) => {
    return gitService.bisectGood(ref);
  });

  ipcMain.handle(IPC.BISECT.BAD, async (_event, ref?: string) => {
    return gitService.bisectBad(ref);
  });

  ipcMain.handle(IPC.BISECT.SKIP, async (_event, ref?: string) => {
    return gitService.bisectSkip(ref);
  });

  ipcMain.handle(IPC.BISECT.RESET, async () => {
    return gitService.bisectReset();
  });

  ipcMain.handle(IPC.BISECT.LOG, async () => {
    return gitService.bisectLog();
  });

  ipcMain.handle(IPC.BISECT.STATUS, async () => {
    return gitService.bisectStatus();
  });
}
