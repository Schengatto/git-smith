import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { showNotification } from "../notifications/notification-service";

export function registerRemoteHandlers() {
  ipcMain.handle(IPC.REMOTE.LIST, async () => {
    return gitService.getRemotes();
  });

  ipcMain.handle(IPC.REMOTE.ADD, async (_event, name: string, url: string) => {
    await gitService.addRemote(name, url);
  });

  ipcMain.handle(IPC.REMOTE.REMOVE, async (_event, name: string) => {
    await gitService.removeRemote(name);
  });

  ipcMain.handle(IPC.REMOTE.FETCH, async (_event, remote?: string) => {
    await gitService.fetch(remote);
  });

  ipcMain.handle(IPC.REMOTE.FETCH_ALL, async () => {
    await gitService.fetchAll();
  });

  ipcMain.handle(IPC.REMOTE.FETCH_PRUNE, async () => {
    await gitService.fetchPrune();
  });

  ipcMain.handle(IPC.REMOTE.PULL, async (_event, remote?: string, branch?: string) => {
    await gitService.pull(remote, branch);
  });

  ipcMain.handle(IPC.REMOTE.PULL_REBASE, async (_event, remote?: string, branch?: string) => {
    await gitService.pullRebase(remote, branch);
  });

  ipcMain.handle(IPC.REMOTE.PULL_MERGE, async (_event, remote?: string, branch?: string) => {
    await gitService.pullMerge(remote, branch);
  });

  ipcMain.handle(
    IPC.REMOTE.PUSH,
    async (_event, remote?: string, branch?: string, force?: boolean, setUpstream?: boolean) => {
      await gitService.push(remote, branch, force, setUpstream);
      showNotification(
        "Push Successful",
        `Pushed to ${remote || "origin"}/${branch || "current branch"}`,
        "push"
      );
    }
  );

  ipcMain.handle(
    IPC.REMOTE.CLONE,
    async (
      _event,
      url: string,
      directory: string,
      options?: {
        branch?: string;
        bare?: boolean;
        recurseSubmodules?: boolean;
        shallow?: boolean;
      }
    ) => {
      await gitService.clone(url, directory, options);
    }
  );

  ipcMain.handle(IPC.REMOTE.LIST_REMOTE_BRANCHES, async (_event, url: string) => {
    return gitService.listRemoteBranches(url);
  });
}
