import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

export function registerBranchHandlers() {
  ipcMain.handle(IPC.BRANCH.LIST, async () => {
    return gitService.getBranches();
  });

  ipcMain.handle(
    IPC.BRANCH.CREATE,
    async (_event, name: string, startPoint?: string) => {
      await gitService.createBranch(name, startPoint);
    }
  );

  ipcMain.handle(
    IPC.BRANCH.DELETE,
    async (_event, name: string, force?: boolean) => {
      await gitService.deleteBranch(name, force);
    }
  );

  ipcMain.handle(
    IPC.BRANCH.RENAME,
    async (_event, oldName: string, newName: string) => {
      await gitService.renameBranch(oldName, newName);
    }
  );

  ipcMain.handle(IPC.BRANCH.CHECKOUT, async (_event, ref: string) => {
    await gitService.checkout(ref);
  });

  ipcMain.handle(IPC.BRANCH.MERGE, async (_event, branch: string) => {
    return gitService.merge(branch);
  });

  ipcMain.handle(IPC.BRANCH.REBASE, async (_event, onto: string) => {
    await gitService.rebase(onto);
  });

  ipcMain.handle(
    IPC.BRANCH.REBASE_COMMITS,
    async (_event, onto: string) => {
      return gitService.getRebaseCommits(onto);
    }
  );

  ipcMain.handle(
    IPC.BRANCH.REBASE_INTERACTIVE,
    async (_event, onto: string, todoEntries: { action: string; hash: string }[]) => {
      await gitService.interactiveRebase(onto, todoEntries);
    }
  );

  ipcMain.handle(IPC.BRANCH.REBASE_CONTINUE, async () => {
    await gitService.rebaseContinue();
  });

  ipcMain.handle(IPC.BRANCH.REBASE_ABORT, async () => {
    await gitService.rebaseAbort();
  });

  ipcMain.handle(IPC.BRANCH.REBASE_IN_PROGRESS, async () => {
    return gitService.isRebaseInProgress();
  });

  ipcMain.handle(IPC.BRANCH.CHERRY_PICK, async (_event, hash: string) => {
    await gitService.cherryPick(hash);
  });

  ipcMain.handle(
    IPC.BRANCH.RESET,
    async (_event, hash: string, mode: "soft" | "mixed" | "hard") => {
      await gitService.resetToCommit(hash, mode);
    }
  );

  // Tag handlers
  ipcMain.handle(IPC.TAG.LIST, async () => {
    return gitService.getTags();
  });

  ipcMain.handle(
    IPC.TAG.CREATE,
    async (_event, name: string, commitHash: string, message?: string) => {
      await gitService.createTag(name, commitHash, message);
    }
  );

  ipcMain.handle(IPC.TAG.DELETE, async (_event, name: string) => {
    await gitService.deleteTag(name);
  });

  ipcMain.handle(
    IPC.TAG.PUSH,
    async (_event, name: string, remote?: string) => {
      await gitService.pushTag(name, remote);
    }
  );
}
