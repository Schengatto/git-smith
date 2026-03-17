// Types shared between main and renderer processes

export interface RepoInfo {
  path: string;
  name: string;
  currentBranch: string;
  isDirty: boolean;
  headCommit: string;
}

export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
  /** True when a merge is in progress (MERGE_HEAD exists) */
  mergeInProgress: boolean;
  /** Files with unresolved merge conflicts */
  conflicted: ConflictFile[];
}

export interface FileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  oldPath?: string;
}

export interface CommitInfo {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerDate: string;
  parentHashes: string[];
  refs: RefInfo[];
  gravatarHash?: string;
}

export interface RefInfo {
  name: string;
  type: "head" | "remote" | "tag";
  current?: boolean;
}

export interface GraphRow {
  commit: CommitInfo;
  laneIndex: number;
  edges: GraphEdge[];
  activeLaneCount: number;
}

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  type: "straight" | "merge-left" | "merge-right" | "fork-left" | "fork-right" | "converge-left" | "converge-right" | "start" | "end";
  color: number; // index into palette
}

export interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  tracking?: string;
  ahead?: number;
  behind?: number;
  lastCommitHash?: string;
}

export interface TagInfo {
  name: string;
  hash: string;
  annotation?: string;
}

export interface StashEntry {
  index: number;
  message: string;
  date: string;
  hash: string;
}

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface CommandLogEntry {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  timestamp: number;
  duration?: number;
  exitCode?: number;
  error?: string;
}

export interface CommandOutputLine {
  /** Matches the CommandLogEntry.id this output belongs to */
  id: string;
  stream: "stdout" | "stderr";
  text: string;
}

export interface CommitFileInfo {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  additions: number;
  deletions: number;
}

export interface DiffResult {
  filePath: string;
  oldPath?: string;
  hunks: DiffHunk[];
  isBinary: boolean;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface CommitFullInfo {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  parentHashes: string[];
  childHashes: string[];
  refs: RefInfo[];
  gravatarHash?: string;
  containedInBranches: string[];
  containedInTags: string[];
  derivesFromTag: string;
}

export interface StaleRemoteBranch {
  name: string; // e.g. "origin/feature-old"
  remote: string; // e.g. "origin"
  branchName: string; // e.g. "feature-old"
  lastCommitHash: string;
  lastCommitDate: string;
  lastCommitSubject: string;
  lastCommitAuthor: string;
}

export interface MergeOptions {
  /** Branch/ref to merge into the current branch */
  branch: string;
  /** "ff" = fast-forward if possible (default), "no-ff" = always create merge commit */
  mergeStrategy: "ff" | "no-ff";
  /** Do not commit the merge result (leave it staged) */
  noCommit?: boolean;
  /** Squash commits into a single change set */
  squash?: boolean;
  /** Allow merging branches with unrelated histories */
  allowUnrelatedHistories?: boolean;
  /** Include log messages from merged commits (number = how many) */
  log?: number;
  /** Custom merge commit message */
  message?: string;
}

export interface RebaseOptions {
  /** Commit or branch to rebase onto */
  onto: string;
  /** Run an interactive rebase (with pre-built todo list) */
  interactive?: boolean;
  /** Preserve merge commits during rebase */
  preserveMerges?: boolean;
  /** Automatically apply fixup!/squash! commits */
  autosquash?: boolean;
  /** Automatically stash/unstash before/after rebase */
  autoStash?: boolean;
  /** Ignore date (reset author date to committer date) */
  ignoreDate?: boolean;
  /** Set committer date equal to author date */
  committerDateIsAuthorDate?: boolean;
  /** Update branches that point to rebased commits */
  updateRefs?: boolean;
  /** Specific range: rebase only commits after this (exclusive) */
  rangeFrom?: string;
  /** Specific range: rebase onto this branch/ref */
  rangeTo?: string;
  /** Pre-built todo entries for interactive mode */
  todoEntries?: { action: string; hash: string }[];
}

export interface ConflictFile {
  path: string;
  /** "both-modified" | "added-by-us" | "added-by-them" | "deleted-by-us" | "deleted-by-them" | "both-added" | "both-deleted" */
  reason: string;
}

export interface ConflictFileContent {
  /** Current (ours) version — null if deleted */
  ours: string | null;
  /** Incoming (theirs) version — null if deleted */
  theirs: string | null;
  /** Common ancestor (base) version — null if not available */
  base: string | null;
  /** Current working tree content with conflict markers */
  merged: string;
}

export interface CloneOptions {
  url: string;
  destination: string;
  subdirectory: string;
  branch?: string;
  bare?: boolean;
  recurseSubmodules?: boolean;
  shallow?: boolean; // when true, --depth 1
}
