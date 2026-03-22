import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerNotesHandlers() {
  ipcMain.handle(IPC.NOTES.GET, async (_event, hash: string) => {
    return gitService.getNote(hash);
  });

  ipcMain.handle(IPC.NOTES.ADD, async (_event, hash: string, message: string) => {
    await gitService.addNote(hash, message);
  });

  ipcMain.handle(IPC.NOTES.REMOVE, async (_event, hash: string) => {
    await gitService.removeNote(hash);
  });
}
