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

export interface CloneOptions {
  url: string;
  destination: string;
  subdirectory: string;
  branch?: string;
  bare?: boolean;
  recurseSubmodules?: boolean;
  shallow?: boolean; // when true, --depth 1
}
