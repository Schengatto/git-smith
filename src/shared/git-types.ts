// Types shared between main and renderer processes

export interface RepoInfo {
  path: string;
  name: string;
  currentBranch: string;
  isDirty: boolean;
  headCommit: string;
}

export type GitOperation = "merge" | "rebase" | "cherry-pick" | null;

export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
  /** @deprecated Use operationInProgress === 'merge' instead */
  mergeInProgress: boolean;
  /** Files with unresolved merge conflicts */
  conflicted: ConflictFile[];
  /** Which git operation is currently in progress */
  operationInProgress: GitOperation;
  /** Rebase step progress (only set when operationInProgress === 'rebase') */
  rebaseStep?: { current: number; total: number };
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
  type:
    | "straight"
    | "merge-left"
    | "merge-right"
    | "fork-left"
    | "fork-right"
    | "converge-left"
    | "converge-right"
    | "start"
    | "end";
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

export interface CherryPickOptions {
  /** Commit hash to cherry-pick */
  hash: string;
  /** Do not commit the result (leave it staged) */
  noCommit?: boolean;
  /** Parent number for merge commits (1 = first parent) */
  mainline?: number;
}

export interface RevertOptions {
  /** Commit hash to revert */
  hash: string;
  /** Do not commit the result (leave it staged) */
  noCommit?: boolean;
  /** Parent number for merge commits (1 = first parent) */
  mainline?: number;
}

export interface SquashOptions {
  /** Hash of the oldest commit in the squash range */
  targetHash: string;
  /** New commit message for the squashed commit */
  message: string;
}

export interface SearchCommitsOptions {
  /** Search in commit messages */
  grep?: string;
  /** Search by author name/email */
  author?: string;
  /** Search for code changes containing this string (pickaxe -S) */
  code?: string;
  /** Max number of results */
  maxCount?: number;
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

export interface GitAccount {
  id: string;
  label: string;
  name: string;
  email: string;
  signingKey?: string;
  sshKeyPath?: string;
}

export interface SshHostEntry {
  host: string;
  hostName?: string;
  user?: string;
  identityFile?: string;
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

// Changelog
export interface ChangelogEntry {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  description: string;
  type: string;
  scope?: string;
  breaking: boolean;
  authorName: string;
  authorDate: string;
}

export interface ChangelogGroup {
  label: string;
  color: string;
  entries: ChangelogEntry[];
}

export interface ReflogEntry {
  hash: string;
  abbreviatedHash: string;
  selector: string;
  action: string;
  subject: string;
  date: string;
}

export interface ChangelogData {
  from: string;
  to: string;
  groups: ChangelogGroup[];
  totalCommits: number;
  authors: string[];
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isBare: boolean;
  isMain: boolean;
}

export interface BisectStatus {
  active: boolean;
  good: string[];
  bad: string[];
  current?: string;
  remaining?: number;
  steps?: number;
}

export interface PatchCreateOptions {
  hashes: string[];
  outputDir: string;
}

export interface PatchApplyOptions {
  patchPath: string;
  check?: boolean;
}

export interface SubmoduleDetailInfo {
  name: string;
  path: string;
  url: string;
  hash: string;
  branch: string;
  status: "up-to-date" | "modified" | "uninitialized" | "conflict";
}

export interface LfsFileInfo {
  pattern: string;
  filter: string;
}

export interface LfsStatus {
  installed: boolean;
  version: string;
  tracked: LfsFileInfo[];
  files: { path: string; lfsOid: string; size: string }[];
}

export interface PrInfo {
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  sourceBranch: string;
  targetBranch: string;
  labels: string[];
}

export interface PrCreateOptions {
  title: string;
  body: string;
  targetBranch: string;
  sourceBranch: string;
  draft?: boolean;
}

export type GitProvider = "github" | "gitlab" | "unknown";

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface GrepResult {
  matches: GrepMatch[];
  totalCount: number;
}

export interface BranchDiffResult {
  files: CommitFileInfo[];
  stats: { additions: number; deletions: number; filesChanged: number };
}

export interface UndoEntry {
  index: number;
  hash: string;
  action: string;
  description: string;
  date: string;
}

export interface CIStatus {
  sha: string;
  status: "success" | "failure" | "pending" | "running" | "unknown";
  name: string;
  url: string;
  conclusion: string;
  startedAt: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
}

export interface GistCreateOptions {
  filename: string;
  content: string;
  description: string;
  public: boolean;
}

export interface GistResult {
  url: string;
  id: string;
}

export interface TimelineEntry {
  date: string;
  count: number;
}

export interface ChurnEntry {
  date: string;
  additions: number;
  deletions: number;
}

export interface ContributorTimelineEntry {
  date: string;
  author: string;
  count: number;
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  body: string;
  severity: "comment" | "suggestion" | "issue";
  createdAt: string;
}

export interface ReviewData {
  commitHash: string;
  comments: ReviewComment[];
  createdAt: string;
}

export interface SshKeyInfo {
  name: string;
  type: string;
  fingerprint: string;
  path: string;
  hasPublicKey: boolean;
}

export interface GitHookInfo {
  name: string;
  active: boolean;
  content: string;
}
