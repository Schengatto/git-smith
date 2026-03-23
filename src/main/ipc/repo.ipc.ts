import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import {
  addRecentRepo,
  addMultipleRecentRepos,
  getRecentRepos,
  removeRecentRepo,
  clearRecentRepos,
  setRepoCategory,
  getRepoCategories,
  removeMissingRepos,
  renameCategory,
  deleteCategory,
  scanForRepos,
  cancelScan,
  getLastOpenedRepo,
  setLastOpenedRepo,
  getRepoViewSettings,
  setRepoViewSettings,
  getRepoAccount,
  getGitAccounts,
} from "../store";
import type { RepoViewSettings } from "../store";

async function applyRepoAccount(repoPath: string): Promise<void> {
  const accountId = getRepoAccount(repoPath);
  if (!accountId) return;
  const account = getGitAccounts().find((a) => a.id === accountId);
  if (!account) return;
  await gitService.applyAccount(account.name, account.email, {
    signingKey: account.signingKey,
    sshKeyPath: account.sshKeyPath,
  });
}

export function registerRepoHandlers() {
  ipcMain.handle(IPC.REPO.OPEN, async (_event, path: string) => {
    const info = await gitService.openRepo(path);
    addRecentRepo(path);
    setLastOpenedRepo(path);
    await applyRepoAccount(path);
    return info;
  });

  ipcMain.handle(IPC.REPO.OPEN_DIALOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Open Git Repository",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0]!;
    const info = await gitService.openRepo(path);
    addRecentRepo(path);
    setLastOpenedRepo(path);
    await applyRepoAccount(path);
    return info;
  });

  ipcMain.handle(IPC.REPO.INIT, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select folder for new repository",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0]!;
    const info = await gitService.initRepo(path);
    addRecentRepo(path);
    setLastOpenedRepo(path);
    return info;
  });

  ipcMain.handle(IPC.REPO.CLOSE, () => {
    gitService.closeRepo();
    setLastOpenedRepo(null);
  });

  ipcMain.handle(IPC.REPO.GET_LAST_OPENED, () => {
    return getLastOpenedRepo();
  });

  ipcMain.handle(IPC.REPO.GET_RECENT, () => {
    return getRecentRepos();
  });

  ipcMain.handle(IPC.REPO.REMOVE_RECENT, (_event, path: string) => {
    removeRecentRepo(path);
  });

  ipcMain.handle(IPC.REPO.CLEAR_RECENT, () => {
    clearRecentRepos();
  });

  ipcMain.handle(IPC.REPO.REMOVE_MISSING, () => {
    return removeMissingRepos();
  });

  ipcMain.handle(IPC.REPO.GET_INFO, async () => {
    if (!gitService.isOpen()) return null;
    return gitService.getRepoInfo();
  });

  ipcMain.handle(IPC.REPO.SET_CATEGORY, (_event, repoPath: string, category: string | null) => {
    setRepoCategory(repoPath, category);
  });

  ipcMain.handle(IPC.REPO.GET_CATEGORIES, () => {
    return getRepoCategories();
  });

  ipcMain.handle(IPC.REPO.RENAME_CATEGORY, (_event, oldName: string, newName: string) => {
    renameCategory(oldName, newName);
  });

  ipcMain.handle(IPC.REPO.DELETE_CATEGORY, (_event, category: string) => {
    deleteCategory(category);
  });

  ipcMain.handle(IPC.REPO.SCAN_FOR_REPOS, async (event, rootPath: string, maxDepth: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const found = await scanForRepos(rootPath, maxDepth, (progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.EVENTS.SCAN_PROGRESS, progress);
      }
    });
    if (found.length > 0) {
      addMultipleRecentRepos(found);
    }
    return found;
  });

  ipcMain.handle(IPC.REPO.SCAN_CANCEL, () => {
    cancelScan();
  });

  ipcMain.handle(IPC.REPO.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.REPO.BROWSE_DIRECTORY, async (event, title?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: title || "Select Directory",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC.REPO.BROWSE_FILE,
    async (event, title?: string, filters?: Electron.FileFilter[]) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        title: title || "Select File",
        filters: filters || [{ name: "All Files", extensions: ["*"] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    }
  );

  ipcMain.handle(IPC.REPO.GET_VIEW_SETTINGS, (_event, repoPath: string) => {
    return getRepoViewSettings(repoPath);
  });

  ipcMain.handle(
    IPC.REPO.SET_VIEW_SETTINGS,
    (_event, repoPath: string, partial: Partial<RepoViewSettings>) => {
      setRepoViewSettings(repoPath, partial);
    }
  );
}
