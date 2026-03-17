import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerOperationHandlers() {
  ipcMain.handle(IPC.OPERATION.CANCEL, () => {
    gitService.killCurrentOperation();
  });
}
