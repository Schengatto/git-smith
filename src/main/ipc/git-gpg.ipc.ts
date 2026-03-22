import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerGpgHandlers() {
  ipcMain.handle(IPC.GPG.VERIFY, async (_event, hash: string) => {
    return gitService.verifyCommitSignature(hash);
  });
}
