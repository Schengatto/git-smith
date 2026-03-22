import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc-channels";
import type { AppSettings } from "../shared/settings-types";
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
  MergeOptions,
  RebaseOptions,
  CherryPickOptions,
  RevertOptions,
  SquashOptions,
  SearchCommitsOptions,
  ConflictFile,
  ConflictFileContent,
  ChangelogData,
  SubmoduleDetailInfo,
  GitAccount,
  SshHostEntry,
  ReflogEntry,
  BisectStatus,
  WorktreeInfo,
  LfsStatus,
  LfsFileInfo,
  PrInfo,
  PrCreateOptions,
  GrepResult,
  BranchDiffResult,
  TimelineEntry,
  ChurnEntry,
  ContributorTimelineEntry,
  ReviewComment,
  ReviewData,
  SshKeyInfo,
  CIStatus,
  IssueInfo,
  GistCreateOptions,
  GistResult,
  UndoEntry,
  GitHookInfo,
} from "../shared/git-types";
import type { DialogOpenRequest, DialogResult } from "../shared/dialog-types";
import type { Timeframe, LeaderboardEntry, AuthorDetail } from "../shared/stats-types";
import type { CodebaseStats } from "../shared/codebase-stats-types";
import type { GitignoreTemplate } from "../shared/gitignore-templates";

const electronAPI = {
  repo: {
    open: (path: string): Promise<RepoInfo> => ipcRenderer.invoke(IPC.REPO.OPEN, path),
    openDialog: (): Promise<RepoInfo | null> => ipcRenderer.invoke(IPC.REPO.OPEN_DIALOG),
    init: (): Promise<RepoInfo | null> => ipcRenderer.invoke(IPC.REPO.INIT),
    close: (): Promise<void> => ipcRenderer.invoke(IPC.REPO.CLOSE),
    getRecent: (): Promise<string[]> => ipcRenderer.invoke(IPC.REPO.GET_RECENT),
    removeRecent: (path: string): Promise<void> => ipcRenderer.invoke(IPC.REPO.REMOVE_RECENT, path),
    clearRecent: (): Promise<void> => ipcRenderer.invoke(IPC.REPO.CLEAR_RECENT),
    removeMissing: (): Promise<string[]> => ipcRenderer.invoke(IPC.REPO.REMOVE_MISSING),
    getInfo: (): Promise<RepoInfo | null> => ipcRenderer.invoke(IPC.REPO.GET_INFO),
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
    browseFile: (title?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.REPO.BROWSE_FILE, title),
    scanForRepos: (rootPath: string, maxDepth?: number): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REPO.SCAN_FOR_REPOS, rootPath, maxDepth ?? 4),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.REPO.OPEN_EXTERNAL, url),
    getLastOpened: (): Promise<string | null> => ipcRenderer.invoke(IPC.REPO.GET_LAST_OPENED),
    getViewSettings: (
      repoPath: string
    ): Promise<{
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
    stage: (paths: string[]): Promise<GitStatus> => ipcRenderer.invoke(IPC.STATUS.STAGE, paths),
    stageLines: (patch: string): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.STAGE_LINES, patch),
    unstage: (paths: string[]): Promise<GitStatus> => ipcRenderer.invoke(IPC.STATUS.UNSTAGE, paths),
    unstageLines: (patch: string): Promise<GitStatus> =>
      ipcRenderer.invoke(IPC.STATUS.UNSTAGE_LINES, patch),
    discard: (paths: string[]): Promise<GitStatus> => ipcRenderer.invoke(IPC.STATUS.DISCARD, paths),
    discardAll: (): Promise<GitStatus> => ipcRenderer.invoke(IPC.STATUS.DISCARD_ALL),
  },
  commit: {
    create: (message: string): Promise<string> => ipcRenderer.invoke(IPC.COMMIT.CREATE, message),
    amend: (message?: string): Promise<string> => ipcRenderer.invoke(IPC.COMMIT.AMEND, message),
    getRecentMessages: (): Promise<string[]> => ipcRenderer.invoke(IPC.COMMIT.GET_RECENT_MESSAGES),
  },
  log: {
    getCommits: (
      maxCount?: number,
      skip?: number,
      branchFilter?: string,
      branchVisibility?: { mode: "include" | "exclude"; branches: string[] }
    ): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.LOG.GRAPH, maxCount, skip, branchFilter, branchVisibility),
    details: (hash: string): Promise<CommitInfo> => ipcRenderer.invoke(IPC.LOG.DETAILS, hash),
    fullInfo: (hash: string): Promise<CommitFullInfo> =>
      ipcRenderer.invoke(IPC.LOG.FULL_INFO, hash),
    showFile: (hash: string, filePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.LOG.SHOW_FILE, hash, filePath),
    search: (options: SearchCommitsOptions): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.LOG.SEARCH, options),
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
    checkout: (ref: string): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.CHECKOUT, ref),
    checkoutWithOptions: (ref: string, options: { merge?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.CHECKOUT_OPTIONS, ref, options),
    merge: (branch: string): Promise<string> => ipcRenderer.invoke(IPC.BRANCH.MERGE, branch),
    mergeWithOptions: (options: MergeOptions): Promise<string> =>
      ipcRenderer.invoke(IPC.BRANCH.MERGE_OPTIONS, options),
    rebase: (onto: string): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.REBASE, onto),
    rebaseWithOptions: (options: RebaseOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_OPTIONS, options),
    rebaseInteractive: (
      onto: string,
      todoEntries: { action: string; hash: string }[]
    ): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.REBASE_INTERACTIVE, onto, todoEntries),
    rebaseCommits: (onto: string): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.BRANCH.REBASE_COMMITS, onto),
    rebaseContinue: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.REBASE_CONTINUE),
    rebaseSkip: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.REBASE_SKIP),
    rebaseAbort: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.REBASE_ABORT),
    isRebaseInProgress: (): Promise<boolean> => ipcRenderer.invoke(IPC.BRANCH.REBASE_IN_PROGRESS),
    cherryPick: (hash: string): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK, hash),
    cherryPickWithOptions: (options: CherryPickOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK_OPTIONS, options),
    revert: (options: RevertOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.REVERT, options),
    mergeAbort: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.MERGE_ABORT),
    mergeContinue: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.MERGE_CONTINUE),
    cherryPickAbort: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK_ABORT),
    cherryPickContinue: (): Promise<void> => ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK_CONTINUE),
    reset: (hash: string, mode: "soft" | "mixed" | "hard"): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.RESET, hash, mode),
    squashPreview: (targetHash: string): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.BRANCH.SQUASH_PREVIEW, targetHash),
    squashExecute: (options: SquashOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.BRANCH.SQUASH_EXECUTE, options),
    staleRemote: (olderThanDays: number): Promise<StaleRemoteBranch[]> =>
      ipcRenderer.invoke(IPC.BRANCH.STALE_REMOTE, olderThanDays),
    remoteCommits: (remoteBranch: string, maxCount?: number): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.BRANCH.REMOTE_COMMITS, remoteBranch, maxCount),
  },
  tag: {
    list: (): Promise<{ name: string; hash: string }[]> => ipcRenderer.invoke(IPC.TAG.LIST),
    create: (name: string, commitHash: string, message?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.CREATE, name, commitHash, message),
    delete: (name: string): Promise<void> => ipcRenderer.invoke(IPC.TAG.DELETE, name),
    deleteRemote: (name: string, remote?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.DELETE_REMOTE, name, remote),
    push: (name: string, remote?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TAG.PUSH, name, remote),
  },
  remote: {
    list: (): Promise<RemoteInfo[]> => ipcRenderer.invoke(IPC.REMOTE.LIST),
    add: (name: string, url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.REMOTE.ADD, name, url),
    remove: (name: string): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.REMOVE, name),
    clone: (
      url: string,
      directory: string,
      options?: {
        branch?: string;
        bare?: boolean;
        recurseSubmodules?: boolean;
        shallow?: boolean;
      }
    ): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.CLONE, url, directory, options),
    listRemoteBranches: (url: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.REMOTE.LIST_REMOTE_BRANCHES, url),
    fetch: (remote?: string): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.FETCH, remote),
    fetchAll: (): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.FETCH_ALL),
    fetchPrune: (): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.FETCH_PRUNE),
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
    ): Promise<void> => ipcRenderer.invoke(IPC.REMOTE.PUSH, remote, branch, force, setUpstream),
  },
  diff: {
    file: (file: string, staged?: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.FILE, file, staged),
    commit: (hash: string): Promise<string> => ipcRenderer.invoke(IPC.DIFF.COMMIT, hash),
    commitFile: (hash: string, file: string): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.COMMIT_FILE, hash, file),
    commitFiles: (hash: string): Promise<CommitFileInfo[]> =>
      ipcRenderer.invoke(IPC.DIFF.COMMIT_FILES, hash),
    staged: (): Promise<string> => ipcRenderer.invoke(IPC.DIFF.STAGED),
    treeFiles: (hash: string): Promise<string[]> => ipcRenderer.invoke(IPC.DIFF.TREE_FILES, hash),
    rangeFiles: (hash1: string, hash2: string): Promise<CommitFileInfo[]> =>
      ipcRenderer.invoke(IPC.DIFF.RANGE_FILES, hash1, hash2),
    rangeFile: (hash1: string, hash2: string, file: string): Promise<string> =>
      ipcRenderer.invoke(IPC.DIFF.RANGE_FILE, hash1, hash2, file),
  },
  conflict: {
    list: (): Promise<ConflictFile[]> => ipcRenderer.invoke(IPC.CONFLICT.LIST),
    fileContent: (filePath: string): Promise<ConflictFileContent> =>
      ipcRenderer.invoke(IPC.CONFLICT.FILE_CONTENT, filePath),
    resolve: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.CONFLICT.RESOLVE, filePath),
    saveMerged: (filePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC.CONFLICT.SAVE_MERGED, filePath, content),
    launchMergeTool: (
      filePath: string,
      toolPath: string,
      toolArgs: string
    ): Promise<{ exitCode: number; mergedContent: string }> =>
      ipcRenderer.invoke(IPC.CONFLICT.LAUNCH_MERGE_TOOL, filePath, toolPath, toolArgs),
  },
  stash: {
    list: (): Promise<StashEntry[]> => ipcRenderer.invoke(IPC.STASH.LIST),
    create: (
      message?: string,
      options?: { keepIndex?: boolean; includeUntracked?: boolean; staged?: boolean }
    ): Promise<void> => ipcRenderer.invoke(IPC.STASH.CREATE, message, options),
    pop: (index?: number): Promise<void> => ipcRenderer.invoke(IPC.STASH.POP, index),
    apply: (index?: number): Promise<void> => ipcRenderer.invoke(IPC.STASH.APPLY, index),
    drop: (index?: number): Promise<void> => ipcRenderer.invoke(IPC.STASH.DROP, index),
  },
  blame: {
    file: (file: string): Promise<string> => ipcRenderer.invoke(IPC.BLAME.FILE, file),
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
    update: (init?: boolean): Promise<void> => ipcRenderer.invoke(IPC.SUBMODULE.UPDATE, init),
    sync: (): Promise<void> => ipcRenderer.invoke(IPC.SUBMODULE.SYNC),
    deinit: (submodulePath: string, force?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.SUBMODULE.DEINIT, submodulePath, force),
    status: (): Promise<SubmoduleDetailInfo[]> => ipcRenderer.invoke(IPC.SUBMODULE.STATUS),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS.GET),
    update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SETTINGS.UPDATE, partial),
    getAutoFetch: (): Promise<number> => ipcRenderer.invoke(IPC.SETTINGS.GET_AUTO_FETCH),
    setAutoFetch: (seconds: number): Promise<void> =>
      ipcRenderer.invoke(IPC.SETTINGS.SET_AUTO_FETCH, seconds),
    onThemeChanged: (cb: (theme: string) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, theme: string) => cb(theme);
      ipcRenderer.on(IPC.SETTINGS.THEME_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.SETTINGS.THEME_CHANGED, handler);
    },
  },
  gitConfig: {
    get: (key: string, global?: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.GET, key, global),
    set: (key: string, value: string, global?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.SET, key, value, global),
    list: (global?: boolean): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.GIT_CONFIG.LIST, global),
  },
  operation: {
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC.OPERATION.CANCEL),
  },
  terminal: {
    spawn: (cols: number, rows: number): Promise<number> =>
      ipcRenderer.invoke(IPC.TERMINAL.SPAWN, cols, rows),
    input: (data: string): Promise<void> => ipcRenderer.invoke(IPC.TERMINAL.INPUT, data),
    resize: (cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL.RESIZE, cols, rows),
    kill: (): Promise<void> => ipcRenderer.invoke(IPC.TERMINAL.KILL),
  },
  gitignore: {
    add: (pattern: string): Promise<void> => ipcRenderer.invoke(IPC.GITIGNORE.ADD, pattern),
    read: (): Promise<string> => ipcRenderer.invoke(IPC.GITIGNORE.READ),
    write: (content: string): Promise<void> => ipcRenderer.invoke(IPC.GITIGNORE.WRITE, content),
    preview: (): Promise<string[]> => ipcRenderer.invoke(IPC.GITIGNORE.PREVIEW),
    templates: (): Promise<GitignoreTemplate[]> => ipcRenderer.invoke(IPC.GITIGNORE.TEMPLATES),
  },
  account: {
    list: (): Promise<GitAccount[]> => ipcRenderer.invoke(IPC.ACCOUNT.LIST),
    add: (account: GitAccount): Promise<void> => ipcRenderer.invoke(IPC.ACCOUNT.ADD, account),
    update: (id: string, partial: Partial<GitAccount>): Promise<void> =>
      ipcRenderer.invoke(IPC.ACCOUNT.UPDATE, id, partial),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.ACCOUNT.DELETE, id),
    getForRepo: (repoPath: string): Promise<GitAccount | null> =>
      ipcRenderer.invoke(IPC.ACCOUNT.GET_FOR_REPO, repoPath),
    setForRepo: (repoPath: string, accountId: string | null): Promise<void> =>
      ipcRenderer.invoke(IPC.ACCOUNT.SET_FOR_REPO, repoPath, accountId),
    getDefault: (): Promise<GitAccount | null> => ipcRenderer.invoke(IPC.ACCOUNT.GET_DEFAULT),
    setDefault: (accountId: string | null): Promise<void> =>
      ipcRenderer.invoke(IPC.ACCOUNT.SET_DEFAULT, accountId),
    parseSshConfig: (): Promise<SshHostEntry[]> => ipcRenderer.invoke(IPC.ACCOUNT.PARSE_SSH_CONFIG),
  },
  dialog: {
    open: (request: DialogOpenRequest): Promise<{ windowId: number }> =>
      ipcRenderer.invoke(IPC.DIALOG.OPEN, request),
    close: (dialogKey: string): Promise<void> => ipcRenderer.invoke(IPC.DIALOG.CLOSE, dialogKey),
    getInitData: (): Promise<Record<string, unknown> | undefined> =>
      ipcRenderer.invoke(IPC.DIALOG.GET_INIT_DATA),
    sendResult: (result: DialogResult): void => {
      ipcRenderer.send(IPC.DIALOG.RESULT, result);
    },
    onResult: (callback: (result: DialogResult) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, result: DialogResult) => callback(result);
      ipcRenderer.on(IPC.DIALOG.ON_RESULT, handler);
      return () => ipcRenderer.removeListener(IPC.DIALOG.ON_RESULT, handler);
    },
  },
  shell: {
    openFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SHELL.OPEN_FILE, filePath),
    showInFolder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SHELL.SHOW_IN_FOLDER, filePath),
  },
  app: {
    checkForUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.APP.CHECK_FOR_UPDATES),
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP.GET_VERSION),
    openUserManual: (): Promise<void> => ipcRenderer.invoke(IPC.APP.OPEN_USER_MANUAL),
  },
  stats: {
    getLeaderboard: (timeframe: Timeframe): Promise<LeaderboardEntry[]> =>
      ipcRenderer.invoke(IPC.STATS.LEADERBOARD, timeframe),
    getAuthorDetail: (email: string, timeframe: Timeframe): Promise<AuthorDetail> =>
      ipcRenderer.invoke(IPC.STATS.AUTHOR_DETAIL, email, timeframe),
    getCodebaseStats: (): Promise<CodebaseStats> => ipcRenderer.invoke(IPC.STATS.CODEBASE),
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
      ipcRenderer.on(IPC.MENU.OPEN_REPO, handler);
      return () => ipcRenderer.removeListener(IPC.MENU.OPEN_REPO, handler);
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
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { status: string; detail?: string }
      ) => callback(data);
      ipcRenderer.on(IPC.APP.UPDATE_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC.APP.UPDATE_STATUS, handler);
    },
    terminalData: (callback: (data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
      ipcRenderer.on(IPC.EVENTS.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.TERMINAL_DATA, handler);
    },
    terminalExit: (callback: (exitCode: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, exitCode: number) => callback(exitCode);
      ipcRenderer.on(IPC.EVENTS.TERMINAL_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC.EVENTS.TERMINAL_EXIT, handler);
    },
  },

  mcp: {
    serverStart: (): Promise<void> => ipcRenderer.invoke(IPC.MCP.SERVER_START),
    serverStop: (): Promise<void> => ipcRenderer.invoke(IPC.MCP.SERVER_STOP),
    serverStatus: (): Promise<{ running: boolean; repoPath: string | null }> =>
      ipcRenderer.invoke(IPC.MCP.SERVER_STATUS),
    generateCommitMessage: (): Promise<string> =>
      ipcRenderer.invoke(IPC.MCP.GENERATE_COMMIT_MESSAGE),
    suggestConflictResolution: (filePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.MCP.SUGGEST_CONFLICT_RESOLUTION, filePath),
    generatePrTitle: (sourceBranch: string, targetBranch: string): Promise<string> =>
      ipcRenderer.invoke(IPC.MCP.GENERATE_PR_TITLE, sourceBranch, targetBranch),
    generatePrDescription: (sourceBranch: string, targetBranch: string): Promise<string> =>
      ipcRenderer.invoke(IPC.MCP.GENERATE_PR_DESCRIPTION, sourceBranch, targetBranch),
    reviewCommit: (hash: string): Promise<string> =>
      ipcRenderer.invoke(IPC.MCP.REVIEW_COMMIT, hash),
  },

  reflog: {
    list: (maxCount?: number): Promise<ReflogEntry[]> =>
      ipcRenderer.invoke(IPC.REFLOG.LIST, maxCount),
  },

  archive: {
    export: (ref: string, outputPath: string, format: "zip" | "tar.gz"): Promise<void> =>
      ipcRenderer.invoke(IPC.ARCHIVE.EXPORT, ref, outputPath, format),
  },

  bisect: {
    start: (bad?: string, good?: string): Promise<string> =>
      ipcRenderer.invoke(IPC.BISECT.START, bad, good),
    good: (ref?: string): Promise<string> => ipcRenderer.invoke(IPC.BISECT.GOOD, ref),
    bad: (ref?: string): Promise<string> => ipcRenderer.invoke(IPC.BISECT.BAD, ref),
    skip: (ref?: string): Promise<string> => ipcRenderer.invoke(IPC.BISECT.SKIP, ref),
    reset: (): Promise<string> => ipcRenderer.invoke(IPC.BISECT.RESET),
    log: (): Promise<string> => ipcRenderer.invoke(IPC.BISECT.LOG),
    status: (): Promise<BisectStatus> => ipcRenderer.invoke(IPC.BISECT.STATUS),
  },

  worktree: {
    list: (): Promise<WorktreeInfo[]> => ipcRenderer.invoke(IPC.WORKTREE.LIST),
    add: (path: string, branch?: string, createBranch?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.WORKTREE.ADD, path, branch, createBranch),
    remove: (path: string, force?: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.WORKTREE.REMOVE, path, force),
  },

  patch: {
    create: (hashes: string[], outputDir: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.PATCH.CREATE, hashes, outputDir),
    apply: (patchPath: string, check?: boolean): Promise<string> =>
      ipcRenderer.invoke(IPC.PATCH.APPLY, patchPath, check),
    preview: (patchPath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.PATCH.PREVIEW, patchPath),
  },

  notes: {
    get: (hash: string): Promise<string> => ipcRenderer.invoke(IPC.NOTES.GET, hash),
    add: (hash: string, message: string): Promise<void> =>
      ipcRenderer.invoke(IPC.NOTES.ADD, hash, message),
    remove: (hash: string): Promise<void> => ipcRenderer.invoke(IPC.NOTES.REMOVE, hash),
  },

  gpg: {
    verify: (
      hash: string
    ): Promise<{ signed: boolean; key?: string; status?: string; signer?: string }> =>
      ipcRenderer.invoke(IPC.GPG.VERIFY, hash),
  },

  lfs: {
    status: (): Promise<LfsStatus> => ipcRenderer.invoke(IPC.LFS.STATUS),
    listTracked: (): Promise<LfsFileInfo[]> => ipcRenderer.invoke(IPC.LFS.LIST_TRACKED),
    track: (pattern: string): Promise<void> => ipcRenderer.invoke(IPC.LFS.TRACK, pattern),
    untrack: (pattern: string): Promise<void> => ipcRenderer.invoke(IPC.LFS.UNTRACK, pattern),
    info: (): Promise<{ storagePath: string; endpoint: string }> =>
      ipcRenderer.invoke(IPC.LFS.INFO),
    install: (): Promise<string> => ipcRenderer.invoke(IPC.LFS.INSTALL),
  },

  pr: {
    detectProvider: (): Promise<{
      provider: string;
      owner: string;
      repo: string;
      baseUrl: string;
    }> => ipcRenderer.invoke(IPC.PR.DETECT_PROVIDER),
    list: (): Promise<PrInfo[]> => ipcRenderer.invoke(IPC.PR.LIST),
    view: (number: number): Promise<string> => ipcRenderer.invoke(IPC.PR.VIEW, number),
    create: (options: PrCreateOptions): Promise<string> =>
      ipcRenderer.invoke(IPC.PR.CREATE, options),
    getTemplate: (): Promise<string | null> => ipcRenderer.invoke(IPC.PR.GET_TEMPLATE),
  },

  changelog: {
    getTagsBefore: (hash: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.CHANGELOG.TAGS_BEFORE, hash),
    generate: (from: string, to: string): Promise<ChangelogData> =>
      ipcRenderer.invoke(IPC.CHANGELOG.GENERATE, from, to),
  },

  grep: {
    search: (
      pattern: string,
      options?: {
        ignoreCase?: boolean;
        regex?: boolean;
        wholeWord?: boolean;
        maxCount?: number;
      }
    ): Promise<GrepResult> => ipcRenderer.invoke(IPC.GREP.SEARCH, pattern, options),
  },

  diffBranches: {
    compare: (from: string, to: string): Promise<BranchDiffResult> =>
      ipcRenderer.invoke(IPC.DIFF_BRANCHES.COMPARE, from, to),
  },

  logRange: {
    compare: (from: string, to: string): Promise<CommitInfo[]> =>
      ipcRenderer.invoke(IPC.LOG_RANGE.COMPARE, from, to),
  },

  statsAdvanced: {
    timeline: (period?: "day" | "week" | "month"): Promise<TimelineEntry[]> =>
      ipcRenderer.invoke(IPC.STATS_ADVANCED.TIMELINE, period),
    churn: (period?: "day" | "week" | "month"): Promise<ChurnEntry[]> =>
      ipcRenderer.invoke(IPC.STATS_ADVANCED.CHURN, period),
    contributorsTimeline: (
      period?: "day" | "week" | "month"
    ): Promise<ContributorTimelineEntry[]> =>
      ipcRenderer.invoke(IPC.STATS_ADVANCED.CONTRIBUTORS_TIMELINE, period),
  },

  review: {
    save: (commitHash: string, comments: ReviewComment[]): Promise<void> =>
      ipcRenderer.invoke(IPC.REVIEW.SAVE, commitHash, comments),
    load: (commitHash: string): Promise<ReviewData | null> =>
      ipcRenderer.invoke(IPC.REVIEW.LOAD, commitHash),
    clear: (commitHash: string): Promise<void> => ipcRenderer.invoke(IPC.REVIEW.CLEAR, commitHash),
    listReviews: (): Promise<string[]> => ipcRenderer.invoke(IPC.REVIEW.LIST_REVIEWS),
  },

  ssh: {
    list: (): Promise<SshKeyInfo[]> => ipcRenderer.invoke(IPC.SSH.LIST),
    generate: (
      type: "ed25519" | "rsa",
      comment: string,
      passphrase: string,
      filename: string
    ): Promise<string> => ipcRenderer.invoke(IPC.SSH.GENERATE, type, comment, passphrase, filename),
    getPublic: (name: string): Promise<string> => ipcRenderer.invoke(IPC.SSH.GET_PUBLIC, name),
    test: (host: string): Promise<string> => ipcRenderer.invoke(IPC.SSH.TEST, host),
  },

  ci: {
    status: (sha: string): Promise<CIStatus[]> => ipcRenderer.invoke(IPC.CI.STATUS, sha),
  },

  issues: {
    resolve: (issueRef: string): Promise<IssueInfo | null> =>
      ipcRenderer.invoke(IPC.ISSUES.RESOLVE, issueRef),
  },

  gist: {
    create: (options: GistCreateOptions): Promise<GistResult> =>
      ipcRenderer.invoke(IPC.GIST.CREATE, options),
  },

  undo: {
    history: (maxCount?: number): Promise<UndoEntry[]> =>
      ipcRenderer.invoke(IPC.UNDO.HISTORY, maxCount),
    revert: (reflogIndex: number): Promise<void> =>
      ipcRenderer.invoke(IPC.UNDO.REVERT, reflogIndex),
  },

  hooks: {
    list: (): Promise<GitHookInfo[]> => ipcRenderer.invoke(IPC.HOOKS.LIST),
    read: (name: string): Promise<string> => ipcRenderer.invoke(IPC.HOOKS.READ, name),
    write: (name: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC.HOOKS.WRITE, name, content),
    toggle: (name: string): Promise<boolean> => ipcRenderer.invoke(IPC.HOOKS.TOGGLE, name),
    delete: (name: string): Promise<void> => ipcRenderer.invoke(IPC.HOOKS.DELETE, name),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
