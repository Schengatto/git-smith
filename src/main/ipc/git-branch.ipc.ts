import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import type {
  MergeOptions,
  RebaseOptions,
  CherryPickOptions,
  RevertOptions,
  SquashOptions,
} from "../../shared/git-types";

export function registerBranchHandlers() {
  ipcMain.handle(IPC.BRANCH.LIST, async () => {
    return gitService.getBranches();
  });

  ipcMain.handle(IPC.BRANCH.CREATE, async (_event, name: string, startPoint?: string) => {
    await gitService.createBranch(name, startPoint);
  });

  ipcMain.handle(IPC.BRANCH.DELETE, async (_event, name: string, force?: boolean) => {
    await gitService.deleteBranch(name, force);
  });

  ipcMain.handle(IPC.BRANCH.DELETE_REMOTE, async (_event, remote: string, branch: string) => {
    await gitService.deleteRemoteBranch(remote, branch);
  });

  ipcMain.handle(IPC.BRANCH.RENAME, async (_event, oldName: string, newName: string) => {
    await gitService.renameBranch(oldName, newName);
  });

  ipcMain.handle(IPC.BRANCH.CHECKOUT, async (_event, ref: string) => {
    await gitService.checkout(ref);
  });

  ipcMain.handle(
    IPC.BRANCH.CHECKOUT_OPTIONS,
    async (_event, ref: string, options: { merge?: boolean }) => {
      await gitService.checkoutWithOptions(ref, options);
    }
  );

  ipcMain.handle(IPC.BRANCH.MERGE, async (_event, branch: string) => {
    return gitService.merge(branch);
  });

  ipcMain.handle(IPC.BRANCH.MERGE_OPTIONS, async (_event, options: MergeOptions) => {
    return gitService.mergeWithOptions(options);
  });

  ipcMain.handle(IPC.BRANCH.REBASE, async (_event, onto: string) => {
    await gitService.rebase(onto);
  });

  ipcMain.handle(IPC.BRANCH.REBASE_OPTIONS, async (_event, options: RebaseOptions) => {
    await gitService.rebaseWithOptions(options);
  });

  ipcMain.handle(IPC.BRANCH.REBASE_COMMITS, async (_event, onto: string) => {
    return gitService.getRebaseCommits(onto);
  });

  ipcMain.handle(
    IPC.BRANCH.REBASE_INTERACTIVE,
    async (_event, onto: string, todoEntries: { action: string; hash: string }[]) => {
      await gitService.interactiveRebase(onto, todoEntries);
    }
  );

  ipcMain.handle(IPC.BRANCH.REBASE_CONTINUE, async () => {
    await gitService.rebaseContinue();
  });

  ipcMain.handle(IPC.BRANCH.REBASE_SKIP, async () => {
    await gitService.rebaseSkip();
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

  ipcMain.handle(IPC.BRANCH.CHERRY_PICK_OPTIONS, async (_event, options: CherryPickOptions) => {
    await gitService.cherryPickWithOptions(options);
  });

  ipcMain.handle(IPC.BRANCH.REVERT, async (_event, options: RevertOptions) => {
    await gitService.revertCommit(options);
  });

  ipcMain.handle(IPC.BRANCH.MERGE_ABORT, async () => {
    await gitService.mergeAbort();
  });

  ipcMain.handle(IPC.BRANCH.MERGE_CONTINUE, async () => {
    await gitService.mergeContinue();
  });

  ipcMain.handle(IPC.BRANCH.CHERRY_PICK_ABORT, async () => {
    await gitService.cherryPickAbort();
  });

  ipcMain.handle(IPC.BRANCH.CHERRY_PICK_CONTINUE, async () => {
    await gitService.cherryPickContinue();
  });

  ipcMain.handle(
    IPC.BRANCH.RESET,
    async (_event, hash: string, mode: "soft" | "mixed" | "hard") => {
      await gitService.resetToCommit(hash, mode);
    }
  );

  ipcMain.handle(IPC.BRANCH.SQUASH_PREVIEW, async (_event, targetHash: string) => {
    return gitService.getSquashPreview(targetHash);
  });

  ipcMain.handle(IPC.BRANCH.SQUASH_EXECUTE, async (_event, options: SquashOptions) => {
    await gitService.squashCommits(options);
  });

  ipcMain.handle(IPC.BRANCH.STALE_REMOTE, async (_event, olderThanDays: number) => {
    return gitService.getStaleRemoteBranches(olderThanDays);
  });

  ipcMain.handle(
    IPC.BRANCH.REMOTE_COMMITS,
    async (_event, remoteBranch: string, maxCount?: number) => {
      return gitService.getRemoteBranchCommits(remoteBranch, maxCount);
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

  ipcMain.handle(IPC.TAG.DELETE_REMOTE, async (_event, name: string, remote?: string) => {
    await gitService.deleteRemoteTag(name, remote);
  });

  ipcMain.handle(IPC.TAG.PUSH, async (_event, name: string, remote?: string) => {
    await gitService.pushTag(name, remote);
  });
}
