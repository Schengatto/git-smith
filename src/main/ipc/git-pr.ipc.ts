import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerPrHandlers() {
  ipcMain.handle(IPC.PR.DETECT_PROVIDER, async () => {
    return gitService.detectProvider();
  });

  ipcMain.handle(IPC.PR.LIST, async () => {
    return gitService.listPrs();
  });

  ipcMain.handle(IPC.PR.VIEW, async (_event, number: number) => {
    return gitService.viewPr(number);
  });

  ipcMain.handle(
    IPC.PR.CREATE,
    async (
      _event,
      options: {
        title: string;
        body: string;
        targetBranch: string;
        sourceBranch: string;
        draft?: boolean;
      }
    ) => {
      return gitService.createPr(options);
    }
  );

  ipcMain.handle(IPC.PR.GET_TEMPLATE, async () => {
    return gitService.getPrTemplate();
  });
}
