import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc-channels";
import type {
  RepoInfo,
  GitStatus,
  CommitInfo,
  CommitFullInfo,
  BranchInfo,
  StashEntry,
  RemoteInfo,
  CommitFileInfo,
  CommandLogEntry,
  CommandOutputLine,
  StaleRemoteBranch,
} from "../shared/git-types";

const electronAPI = {
  repo: {
    open: (path: string): Promise<RepoInfo> =>
      ipcRenderer.invoke(IPC.REPO.OPEN, path),
    openDialog: (): Promise<RepoInfo | null> =>
      ipcRenderer.invoke(IPC.REPO.OPEN_DIALOG),
    init: (): Promise<RepoInfo | null> =>
      ipcRenderer.invoke(IPC.REPO.INIT),
    close: (): Promise<void> => ipcRenderer.invoke(IPC.REPO.CLOSE),
    getRecent: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REPO.GET_RECENT),
    removeRecent: (path: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.REMOVE_RECENT, path),
    clearRecent: (): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.CLEAR_RECENT),
    removeMissing: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REPO.REMOVE_MISSING),
    getInfo: (): Promise<RepoInfo | null> =>
      ipcRenderer.invoke(IPC.REPO.GET_INFO),
    setCategory: (repoPath: string, category: string | null): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.SET_CATEGORY, repoPath, category),
    getCategories: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.REPO.GET_CATEGORIES),
    renameCategory: (oldName: string, newName: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.RENAME_CATEGORY, oldName, newName),
    deleteCategory: (category: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.DELETE_CATEGORY, category),
    browseDirectory: (title?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.REPO.BROWSE_DIRECTORY, title),
    scanForRepos: (rootPath: string, maxDepth?: number): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REPO.SCAN_FOR_REPOS, rootPath, maxDepth ?? 4),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REPO.OPEN_EXTERNAL, url),
    getLastOpened: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.REPO.GET_LAST_OPENED),
    getViewSettings: (repoPath: string): Promise<{
      branchFilter: string;
      branchVisibility: { mode: "include" | "exclude"; branches: string[] } | null;
      dockviewLayout: unknown | null;
    }> => ipcRenderer.invoke(IPC.REPO.GET_VIEW_SETTINGS, repoPath),
    setViewSettings: (
      repoPath: string,
      partial: Partial<{
        branchFilter: string;
        branchVisibility: { mode: "include" | "exclude"; branches: string[] } | null;
        dockviewLayout: unknown | null;
      }>
    ): Promise<void> => ipcRenderer.invoke(IPC.REPO.SET_VIEW_SETTINGS, repoPath, partial),
  },
  status: {
    get: (): Promise<GitStatus> => ipcRenderer.invoke(IPC.STATUS.GET),
    stage: (paths: string[]): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.STAGE, paths),
    stageLines: (patch: string): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.STAGE_LINES, patch),
    unstage: (paths: string[]): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.UNSTAGE, paths),
    unstageLines: (patch: string): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.UNSTAGE_LINES, patch),
    discard: (paths: string[]): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.DISCARD, paths),
    discardAll: (): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.DISCARD_ALL),
  },
  commit: {
    create: (message: string): Promise<string> =>
      ipcRenderer.invoke(IPC.COMMIT.CREATE, message),
    amend: (message?: string): Promise<string> =>
      ipcRenderer.invoke(IPC.COMMIT.AMEND, message),
    getRecentMessages: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.COMMIT.GET_RECENT_MESSAGES),
  },
  log: {
    getCommits: (
      maxCount?: number,
      skip?: number,
      branchFilter?: string,
      branchVisibility?: { mode: "include" | "exclude"; branches: string[] }
    ): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.LOG.GRAPH, maxCount, skip, branchFilter, branchVisibility),
    details: (hash: string): Promise<CommitInfo> =>
      ipcRenderer.invoke(IPC.LOG.DETAILS, hash),
    fullInfo: (hash: string): Promise<CommitFullInfo> =>
      ipcRenderer.invoke(IPC.LOG.FULL_INFO, hash),
  },
  branch: {
    list: (): Promise<BranchInfo[]> => ipcRenderer.invoke(IPC.BRANCH.LIST),
    create: (name: string, startPoint?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.CREATE, name, startPoint),
    delete: (name: string, force?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.DELETE, name, force),
    deleteRemote: (remote: string, branch: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.DELETE_REMOTE, remote, branch),
    rename: (oldName: string, newName: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.RENAME, oldName, newName),
    checkout: (ref: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.CHECKOUT, ref),
    merge: (branch: string): Promise<string> =>
      ipcRenderer.invoke(IPC.BRANCH.MERGE, branch),
    rebase: (onto: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE, onto),
    rebaseInteractive: (
      onto: string,
      todoEntries: { action: string; hash: string }[]
    ): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_INTERACTIVE, onto, todoEntries),
    rebaseCommits: (onto: string): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_COMMITS, onto),
    rebaseContinue: (): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_CONTINUE),
    rebaseAbort: (): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_ABORT),
    isRebaseInProgress: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_IN_PROGRESS),
    cherryPick: (hash: string): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK, hash),
    reset: (hash: string, mode: "soft" | "mixed" | "hard"): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.RESET, hash, mode),
    staleRemote: (olderThanDays: number): Promise<StaleRemoteBranch[]> =>
      ipcRenderer.invoke(IPC.BRANCH.STALE_REMOTE, olderThanDays),
    remoteCommits: (remoteBranch: string, maxCount?: number): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.BRANCH.REMOTE_COMMITS, remoteBranch, maxCount),
  },
  tag: {
    list: (): Promise<{ name: string; hash: string }[]> =>
      ipcRenderer.invoke(IPC.TAG.LIST),
    create: (name: string, commitHash: string, message?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.CREATE, name, commitHash, message),
    delete: (name: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.DELETE, name),
    push: (name: string, remote?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.PUSH, name, remote),
  },
  remote: {
    list: (): Promise<RemoteInfo[]> => ipcRenderer.invoke(IPC.REMOTE.LIST),
    add: (name: string, url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.ADD, name, url),
    remove: (name: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.REMOVE, name),
    clone: (
      url: string,
      directory: string,
      options?: {
        branch?: string;
        bare?: boolean;
        recurseSubmodules?: boolean;
        shallow?: boolean;
      }
    ): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.CLONE, url, directory, options),
    listRemoteBranches: (url: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REMOTE.LIST_REMOTE_BRANCHES, url),
    fetch: (remote?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.FETCH, remote),
    fetchAll: (): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.FETCH_ALL),
    fetchPrune: (): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.FETCH_PRUNE),
    pull: (remote?: string, branch?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.PULL, remote, branch),
    pullRebase: (remote?: string, branch?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.PULL_REBASE, remote, branch),
    pullMerge: (remote?: string, branch?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.PULL_MERGE, remote, branch),
    push: (
      remote?: string,
      branch?: string,
      force?: boolean,
      setUpstream?: boolean
    ): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.PUSH, remote, branch, force, setUpstream),
  },
  diff: {
    file: (file: string, staged?: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.FILE, file, staged),
    commit: (hash: string): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.COMMIT, hash),
    commitFile: (hash: string, file: string): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.COMMIT_FILE, hash, file),
    commitFiles: (hash: string): Promise<CommitFileInfo[]> =>
      ipcRenderer.invoke(IPC.DIFF.COMMIT_FILES, hash),
    staged: (): Promise<string> => ipcRenderer.invoke(IPC.DIFF.STAGED),
  },
  stash: {
    list: (): Promise<StashEntry[]> => ipcRenderer.invoke(IPC.STASH.LIST),
    create: (message?: string, options?: { keepIndex?: boolean; includeUntracked?: boolean; staged?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IPC.STASH.CREATE, message, options),
    pop: (index?: number): Promise<void> =>
      ipcRenderer.invoke(IPC.STASH.POP, index),
    apply: (index?: number): Promise<void> =>
      ipcRenderer.invoke(IPC.STASH.APPLY, index),
    drop: (index?: number): Promise<void> =>
      ipcRenderer.invoke(IPC.STASH.DROP, index),
  },
  blame: {
    file: (file: string): Promise<string> =>
      ipcRenderer.invoke(IPC.BLAME.FILE, file),
  },
  history: {
    file: (file: string, maxCount?: number): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.HISTORY.FILE, file, maxCount),
  },
  submodule: {
    list: (): Promise<{ name: string; path: string; url: string; hash: string }[]> =>
      ipcRenderer.invoke(IPC.SUBMODULE.LIST),
    add: (url: string, path?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SUBMODULE.ADD, url, path),
    update: (init?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.SUBMODULE.UPDATE, init),
  },
  settings: {
    get: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.SETTINGS.GET),
    update: (partial: Record<string, unknown>): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC.SETTINGS.UPDATE, partial),
    getAutoFetch: (): Promise<number> =>
      ipcRenderer.invoke(IPC.SETTINGS.GET_AUTO_FETCH),
    setAutoFetch: (seconds: number): Promise<void> =>
      ipcRenderer.invoke(IPC.SETTINGS.SET_AUTO_FETCH, seconds),
  },
  gitConfig: {
    get: (key: string, global?: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.GET, key, global),
    set: (key: string, value: string, global?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.SET, key, value, global),
    list: (global?: boolean): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.LIST, global),
  },
  gitignore: {
    add: (pattern: string): Promise<void> =>
      ipcRenderer.invoke(IPC.GITIGNORE.ADD, pattern),
  },
  shell: {
    openFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SHELL.OPEN_FILE, filePath),
    showInFolder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SHELL.SHOW_IN_FOLDER, filePath),
  },
  app: {
    checkForUpdates: (): Promise<void> =>
      ipcRenderer.invoke("app:check-for-updates"),
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke("app:get-version"),
  },
  on: {
    commandLog: (callback: (entry: CommandLogEntry) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: CommandLogEntry) =>
        callback(entry);
      ipcRenderer.on(IPC.EVENTS.COMMAND_LOG, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.COMMAND_LOG, handler);
    },
    commandOutput: (callback: (line: CommandOutputLine) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: CommandOutputLine) =>
        callback(line);
      ipcRenderer.on(IPC.EVENTS.COMMAND_OUTPUT, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.COMMAND_OUTPUT, handler);
    },
    repoChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC.EVENTS.REPO_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.REPO_CHANGED, handler);
    },
    menuOpenRepo: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("menu:open-repo", handler);
      return () => ipcRenderer.removeListener("menu:open-repo", handler);
    },
    scanProgress: (
      callback: (progress: {
        phase: "scanning" | "done";
        currentDir: string;
        found: string[];
      }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: { phase: "scanning" | "done"; currentDir: string; found: string[] }
      ) => callback(progress);
      ipcRenderer.on(IPC.EVENTS.SCAN_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.SCAN_PROGRESS, handler);
    },
    updateStatus: (callback: (status: { status: string; detail?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { status: string; detail?: string }) =>
        callback(data);
      ipcRenderer.on("app:update-status", handler);
      return () => ipcRenderer.removeListener("app:update-status", handler);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
