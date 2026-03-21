import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerPatchHandlers() {
  ipcMain.handle(
    IPC.PATCH.CREATE,
    async (_event, hashes: string[], outputDir: string) => {
      return gitService.formatPatch(hashes, outputDir);
    }
  );

  ipcMain.handle(
    IPC.PATCH.APPLY,
    async (_event, patchPath: string, check?: boolean) => {
      return gitService.applyPatch(patchPath, check);
    }
  );

  ipcMain.handle(IPC.PATCH.PREVIEW, async (_event, patchPath: string) => {
    return gitService.previewPatch(patchPath);
  });
}
