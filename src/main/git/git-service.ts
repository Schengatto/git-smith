import type { SimpleGit, SimpleGitOptions } from "simple-git";
import simpleGit from "simple-git";
import { getCodebaseStats as computeCodebaseStats } from "./codebase-stats";
import type { BrowserWindow } from "electron";
import type { ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { IPC } from "../../shared/ipc-channels";
import { getSettings, getPlatformTokenForRepo } from "../store";
import {
  githubListPrs,
  githubCreatePr,
  githubViewPr,
  gitlabListMrs,
  gitlabCreateMr,
  gitlabViewMr,
} from "./platform-api";
import type {
  CommandLogEntry,
  CommandOutputLine,
  RepoInfo,
  GitStatus,
  GitOperation,
  FileStatus,
  CommitInfo,
  CommitFullInfo,
  CommitFileInfo,
  BranchInfo,
  TagInfo,
  StashEntry,
  RemoteInfo,
  StaleRemoteBranch,
  RebaseOptions,
  ConflictFile,
  ConflictFileContent,
  ChangelogEntry,
  SearchCommitsOptions,
  MergeOptions,
  CherryPickOptions,
  RevertOptions,
  SquashOptions,
  GrepResult,
  GrepMatch,
  BranchDiffResult,
  UndoEntry,
  TimelineEntry,
  ChurnEntry,
  ContributorTimelineEntry,
  ReflogEntry,
} from "../../shared/git-types";
import type { CodebaseStats } from "../../shared/codebase-stats-types";
import type { Timeframe, LeaderboardEntry, AuthorDetail } from "../../shared/stats-types";

let idCounter = 0;
function nextId(): string {
  return `cmd-${Date.now()}-${++idCounter}`;
}

export class GitService {
  /** Env vars that prevent git/ssh from prompting for credentials (avoids hanging on fresh installs). */
  private static readonly NO_PROMPT_ENV: Record<string, string> = {
    ...(process.env as Record<string, string>),
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
  };

  private git: SimpleGit | null = null;
  private repoPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;
  private _activeChildProcess: ChildProcess | null = null;
  private _spawnPatched = false;

  getRepoPath(): string | null {
    return this.repoPath;
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  private logCommand(command: string, args: string[]): CommandLogEntry {
    const entry: CommandLogEntry = {
      id: nextId(),
      command,
      args,
      cwd: this.repoPath || "",
      timestamp: Date.now(),
    };
    return entry;
  }

  private emitCommandLog(entry: CommandLogEntry) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.EVENTS.COMMAND_LOG, entry);
    }
  }

  private emitCommandOutput(line: CommandOutputLine) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.EVENTS.COMMAND_OUTPUT, line);
    }
  }

  /** ID of the currently running tracked command (for associating output handler lines).
   *  Only set for mutation commands (push, pull, commit, etc.) to avoid flooding the
   *  renderer with output from read-only commands like git log, git status, git diff. */
  private _currentRunId: string | null = null;

  /** Command prefixes whose stdout/stderr should be captured and sent to the operation log dialog.
   *  Read-only commands (git log, git diff, git status, etc.) are excluded to avoid
   *  flooding the renderer with output during background refreshes. */
  private static readonly TRACKED_PREFIXES = [
    "git push",
    "git pull",
    "git fetch",
    "git commit",
    "git rebase",
    "git merge",
    "git stash",
    "git reset",
    "git checkout",
    "git clone",
    "git cherry-pick",
    "git revert",
    "git apply",
    "git clean",
  ];

  /**
   * Intercept child_process.spawn to capture git child processes.
   * Called once; patches spawn globally to track the active git process.
   */
  private patchSpawn() {
    if (this._spawnPatched) return;
    this._spawnPatched = true;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require("child_process");
    const originalSpawn = cp.spawn;
    cp.spawn = function (...args: unknown[]) {
      const child: ChildProcess = originalSpawn.apply(this, args);
      const cmd = String(args[0] || "");
      if (
        cmd === "git" ||
        cmd.endsWith("/git") ||
        cmd.endsWith("\\git") ||
        cmd.endsWith("git.exe")
      ) {
        self._activeChildProcess = child;
        child.on("exit", () => {
          if (self._activeChildProcess === child) self._activeChildProcess = null;
        });
      }
      return child;
    };
  }

  killCurrentOperation() {
    if (this._activeChildProcess && !this._activeChildProcess.killed) {
      this._activeChildProcess.kill();
      this._activeChildProcess = null;
    }
  }

  private setupOutputHandler() {
    if (!this.git) return;
    this.git.outputHandler((_command, stdout, stderr) => {
      // Capture runId at command-start time to avoid attributing output to the wrong command
      // when concurrent run() calls overwrite _currentRunId
      const runId = this._currentRunId;
      if (!runId) return; // Skip output for non-tracked (read-only) commands

      const bindStream = (stream: NodeJS.ReadableStream, name: "stdout" | "stderr") => {
        stream.on("data", (data: Buffer) => {
          // Verify this command is still the active tracked one
          if (this._currentRunId !== runId) return;
          const text = data.toString("utf-8");
          // Split into lines and emit each non-empty line
          for (const line of text.split(/\r?\n/)) {
            if (line.length > 0) {
              this.emitCommandOutput({ id: runId, stream: name, text: line });
            }
          }
        });
      };
      bindStream(stdout, "stdout");
      bindStream(stderr, "stderr");
    });
  }

  private async run<T>(description: string, args: string[], fn: () => Promise<T>): Promise<T> {
    const entry = this.logCommand(description, args);
    // Only capture stdout/stderr for mutation commands to avoid flooding the
    // renderer with output from read-only commands (git log, git status, etc.)
    const tracked = GitService.TRACKED_PREFIXES.some((p) => description.startsWith(p));
    entry.tracked = tracked;
    if (tracked) this._currentRunId = entry.id;
    this.emitCommandLog(entry);
    const start = Date.now();
    try {
      const result = await fn();
      entry.duration = Date.now() - start;
      entry.exitCode = 0;
      this.emitCommandLog(entry);
      return result;
    } catch (err: unknown) {
      entry.duration = Date.now() - start;
      entry.exitCode = 1;
      entry.error = err instanceof Error ? err.message : String(err);
      this.emitCommandLog(entry);
      throw err;
    } finally {
      if (tracked) this._currentRunId = null;
    }
  }

  async openRepo(path: string): Promise<RepoInfo> {
    this.patchSpawn();
    const gitBinary = getSettings().gitBinaryPath || "git";
    const options: Partial<SimpleGitOptions> = {
      baseDir: path,
      binary: gitBinary,
      maxConcurrentProcesses: 6,
    };
    this.git = simpleGit(options).env(GitService.NO_PROMPT_ENV);
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      this.git = null;
      throw new Error(`Not a git repository: ${path}`);
    }
    this.setupOutputHandler();
    this.repoPath = path;
    return this.getRepoInfo();
  }

  async initRepo(dirPath: string): Promise<RepoInfo> {
    fs.mkdirSync(dirPath, { recursive: true });
    const gitBinary = getSettings().gitBinaryPath || "git";
    const options: Partial<SimpleGitOptions> = {
      baseDir: dirPath,
      binary: gitBinary,
      maxConcurrentProcesses: 6,
    };
    const git = simpleGit(options).env(GitService.NO_PROMPT_ENV);
    await git.init();
    this.git = git;
    this.setupOutputHandler();
    this.repoPath = dirPath;
    return this.getRepoInfo();
  }

  closeRepo() {
    this.git = null;
    this.repoPath = null;
  }

  isOpen(): boolean {
    return this.git !== null;
  }

  private ensureRepo(): SimpleGit {
    if (!this.git) throw new Error("No repository is open");
    return this.git;
  }

  async getRepoInfo(): Promise<RepoInfo> {
    const git = this.ensureRepo();
    return this.run("git status / rev-parse", [], async () => {
      const status = await git.status();
      const name = this.repoPath!.split("/").pop() || this.repoPath!;
      let headCommit = "";
      try {
        headCommit = (await git.revparse(["HEAD"])).trim();
      } catch {
        // empty repo
      }
      return {
        path: this.repoPath!,
        name,
        currentBranch: status.current || "(detached)",
        isDirty: !status.isClean(),
        headCommit,
      };
    });
  }

  async getStatus(): Promise<GitStatus> {
    const git = this.ensureRepo();
    return this.run("git status", ["--porcelain"], async () => {
      const status = await git.status();
      const staged: FileStatus[] = [];
      const unstaged: FileStatus[] = [];

      for (const f of status.files) {
        const idx = f.index;
        const wt = f.working_dir;

        // Untracked files are handled separately via status.not_added
        if (idx === "?" || idx === "!") continue;

        // Index (staged) changes
        if (idx === "A") staged.push({ path: f.path, status: "added" });
        else if (idx === "M") staged.push({ path: f.path, status: "modified" });
        else if (idx === "D") staged.push({ path: f.path, status: "deleted" });
        else if (idx === "R") staged.push({ path: f.path, status: "renamed" });
        else if (idx === "C") staged.push({ path: f.path, status: "copied" });

        // Working tree (unstaged) changes
        if (wt === "M") unstaged.push({ path: f.path, status: "modified" });
        else if (wt === "D") unstaged.push({ path: f.path, status: "deleted" });
        else if (wt === "A") unstaged.push({ path: f.path, status: "added" });
      }

      // Renamed files: use status.renamed for oldPath info
      for (const r of status.renamed) {
        const existing = staged.find((s) => s.path === r.to);
        if (existing) existing.oldPath = r.from;
        else staged.push({ path: r.to, status: "renamed", oldPath: r.from });
      }

      // Detect operations in progress
      const mergeInProgress = this.repoPath
        ? fs.existsSync(path.join(this.repoPath, ".git", "MERGE_HEAD"))
        : false;
      const rebaseMerge =
        this.repoPath && fs.existsSync(path.join(this.repoPath, ".git", "rebase-merge"));
      const rebaseApply =
        this.repoPath && fs.existsSync(path.join(this.repoPath, ".git", "rebase-apply"));
      const cherryPickInProgress = this.repoPath
        ? fs.existsSync(path.join(this.repoPath, ".git", "CHERRY_PICK_HEAD"))
        : false;

      let operationInProgress: GitOperation = null;
      let rebaseStep: { current: number; total: number } | undefined;

      if (mergeInProgress) {
        operationInProgress = "merge";
      } else if (rebaseMerge || rebaseApply) {
        operationInProgress = "rebase";
        try {
          if (rebaseMerge) {
            const current = parseInt(
              fs
                .readFileSync(path.join(this.repoPath!, ".git", "rebase-merge", "msgnum"), "utf-8")
                .trim(),
              10
            );
            const total = parseInt(
              fs
                .readFileSync(path.join(this.repoPath!, ".git", "rebase-merge", "end"), "utf-8")
                .trim(),
              10
            );
            rebaseStep = { current, total };
          } else {
            const current = parseInt(
              fs
                .readFileSync(path.join(this.repoPath!, ".git", "rebase-apply", "next"), "utf-8")
                .trim(),
              10
            );
            const total = parseInt(
              fs
                .readFileSync(path.join(this.repoPath!, ".git", "rebase-apply", "last"), "utf-8")
                .trim(),
              10
            );
            rebaseStep = { current, total };
          }
        } catch {
          // Step info files may not exist; that's fine
        }
      } else if (cherryPickInProgress) {
        operationInProgress = "cherry-pick";
      }

      // Detect conflicted files (unmerged entries have U in index or working_dir)
      const conflicted: ConflictFile[] = [];
      for (const f of status.conflicted) {
        const xy = status.files.find((sf) => sf.path === f)
          ? `${status.files.find((sf) => sf.path === f)!.index}${status.files.find((sf) => sf.path === f)!.working_dir}`
          : "UU";
        let reason = "both-modified";
        if (xy === "AA") reason = "both-added";
        else if (xy === "DD") reason = "both-deleted";
        else if (xy === "DU") reason = "deleted-by-us";
        else if (xy === "UD") reason = "deleted-by-them";
        else if (xy === "AU") reason = "added-by-us";
        else if (xy === "UA") reason = "added-by-them";
        conflicted.push({ path: f, reason });
      }

      return {
        staged,
        unstaged,
        untracked: status.not_added,
        mergeInProgress,
        conflicted,
        operationInProgress,
        rebaseStep,
      };
    });
  }

  async getIgnoredFiles(): Promise<string[]> {
    const git = this.ensureRepo();
    const result = await git.raw(["status", "--ignored", "--short"]);
    return result
      .split("\n")
      .filter((l) => l.startsWith("!! "))
      .map((l) => l.slice(3).trim());
  }

  async stage(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git add", paths, () => git.raw(["add", "-A", "--", ...paths]));
  }

  async unstage(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git reset HEAD", paths, () => git.reset(["HEAD", "--", ...paths]));
  }

  async stageLines(patch: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git apply", ["--cached"], async () => {
      const tmpFile = path.join(this.repoPath!, ".git", "tmp-patch.diff");
      fs.writeFileSync(tmpFile, patch);
      try {
        await git.applyPatch(tmpFile, ["--cached"]);
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
      }
    });
  }

  async unstageLines(patch: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git apply", ["--cached", "--reverse"], async () => {
      const tmpFile = path.join(this.repoPath!, ".git", "tmp-patch.diff");
      fs.writeFileSync(tmpFile, patch);
      try {
        await git.applyPatch(tmpFile, ["--cached", "--reverse"]);
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
      }
    });
  }

  async discard(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    // Separate tracked (checkout) from untracked (clean)
    const status = await git.status();
    const untracked = new Set(status.not_added);
    const trackedPaths = paths.filter((p) => !untracked.has(p));
    const untrackedPaths = paths.filter((p) => untracked.has(p));

    if (trackedPaths.length > 0) {
      await this.run("git checkout", ["--", ...trackedPaths], () =>
        git.checkout(["--", ...trackedPaths])
      );
    }
    if (untrackedPaths.length > 0) {
      await this.run("git clean", ["-f", "--", ...untrackedPaths], () =>
        git.clean("f", ["--", ...untrackedPaths])
      );
    }
  }

  async discardAll(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git checkout", ["."], () => git.checkout(["."]));
    await this.run("git clean", ["-fd"], () => git.clean("fd"));
  }

  async commit(message: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git commit", ["-m", message], async () => {
      const result = await git.commit(message);
      return result.commit;
    });
  }

  async amend(message?: string): Promise<string> {
    const git = this.ensureRepo();
    const args = message ? [message, "--amend"] : ["--amend", "--no-edit"];
    return this.run("git commit --amend", args, async () => {
      if (message) {
        const result = await git.commit(message, { "--amend": null });
        return result.commit;
      } else {
        const result = await git.commit(undefined as unknown as string, {
          "--amend": null,
          "--no-edit": null,
        });
        return result.commit;
      }
    });
  }

  async getLog(
    maxCount = 500,
    skip = 0,
    branchFilter?: string,
    branchVisibility?: { mode: "include" | "exclude"; branches: string[] }
  ): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    let refArgs: string[];
    if (branchVisibility && branchVisibility.branches.length > 0) {
      if (branchVisibility.mode === "include") {
        // Show only commits reachable from selected branches
        refArgs = branchVisibility.branches.map((b) =>
          b.startsWith("remotes/") ? b : `refs/heads/${b}`
        );
      } else {
        // Exclude: show all except selected branches
        refArgs = [
          ...branchVisibility.branches.map((b) =>
            b.startsWith("remotes/") ? `--exclude=refs/${b}` : `--exclude=refs/heads/${b}`
          ),
          "--all",
        ];
      }
    } else if (branchFilter) {
      refArgs = [`--branches=*${branchFilter}*`, `--remotes=*${branchFilter}*`];
    } else {
      refArgs = ["--all"];
    }
    return this.run(
      "git log",
      [`--max-count=${maxCount}`, `--skip=${skip}`, ...refArgs, "--topo-order"],
      async () => {
        // Use %x1e (record separator) between commits and %x00 between fields.
        // Use %B (raw body) at the END so embedded newlines don't break parsing.
        const RECORD_SEP = "%x1e";
        const FIELD_SEP = "%x00";
        const format = [
          "%H", // 0  hash
          "%h", // 1  abbreviated hash
          "%s", // 2  subject
          "%an", // 3  author name
          "%ae", // 4  author email
          "%aI", // 5  author date ISO
          "%cI", // 6  committer date ISO
          "%P", // 7  parent hashes
          "%D", // 8  ref names
          "%B", // 9  full message (subject+body) — MUST be last
        ].join(FIELD_SEP);

        const result = await git.raw([
          "log",
          ...refArgs,
          "--date-order",
          `--format=${RECORD_SEP}${format}`,
          `--max-count=${maxCount}`,
          `--skip=${skip}`,
        ]);

        if (!result.trim()) return [];

        return result
          .split("\x1e")
          .filter((chunk) => chunk.trim())
          .map((chunk) => {
            const parts = chunk.trim().split("\0");
            // Body (%B) is field 9 — may contain \0 if somehow present, so rejoin remainder
            const body = (parts.slice(9).join("\0") || "").trim();
            const subject = parts[2] || "";
            const email = (parts[4] || "").trim().toLowerCase();
            return {
              hash: parts[0] || "",
              abbreviatedHash: parts[1] || "",
              subject,
              body: body.startsWith(subject) ? body.slice(subject.length).trim() : body,
              authorName: parts[3] || "",
              authorEmail: parts[4] || "",
              authorDate: parts[5] || "",
              committerDate: parts[6] || "",
              parentHashes: parts[7] ? parts[7].split(" ") : [],
              refs: parseRefs(parts[8] || ""),
              gravatarHash: email
                ? crypto.createHash("md5").update(email).digest("hex")
                : undefined,
            };
          });
      }
    );
  }

  async searchCommits(options: SearchCommitsOptions): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    const maxCount = options.maxCount || 200;
    const args = ["log", "--all", "--date-order", `--max-count=${maxCount}`];
    if (options.grep) args.push(`--grep=${options.grep}`, "--regexp-ignore-case");
    if (options.author) args.push(`--author=${options.author}`);
    if (options.code) args.push(`-S${options.code}`);

    const RECORD_SEP = "%x1e";
    const FIELD_SEP = "%x00";
    const format = ["%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D", "%B"].join(FIELD_SEP);
    args.push(`--format=${RECORD_SEP}${format}`);

    return this.run("git log", args.slice(1), async () => {
      const result = await git.raw(args);
      if (!result.trim()) return [];
      return result
        .split("\x1e")
        .filter((chunk) => chunk.trim())
        .map((chunk) => {
          const parts = chunk.trim().split("\0");
          const body = (parts.slice(9).join("\0") || "").trim();
          const subject = parts[2] || "";
          const email = (parts[4] || "").trim().toLowerCase();
          return {
            hash: parts[0] || "",
            abbreviatedHash: parts[1] || "",
            subject,
            body: body.startsWith(subject) ? body.slice(subject.length).trim() : body,
            authorName: parts[3] || "",
            authorEmail: parts[4] || "",
            authorDate: parts[5] || "",
            committerDate: parts[6] || "",
            parentHashes: parts[7] ? parts[7].split(" ") : [],
            refs: parseRefs(parts[8] || ""),
            gravatarHash: email ? crypto.createHash("md5").update(email).digest("hex") : undefined,
          };
        });
    });
  }

  async getCommitDetails(hash: string): Promise<CommitInfo> {
    const git = this.ensureRepo();
    return this.run("git show", [hash, "--format=..."], async () => {
      const format = ["%H", "%h", "%s", "%b", "%an", "%ae", "%aI", "%cI", "%P", "%D"].join("%x00");

      const result = await git.raw(["show", hash, `--format=${format}`, "--no-patch"]);

      const parts = result.trim().split("\0");
      const detailEmail = (parts[5] || "").trim().toLowerCase();
      return {
        hash: parts[0]!,
        abbreviatedHash: parts[1]!,
        subject: parts[2]!,
        body: parts[3]!,
        authorName: parts[4]!,
        authorEmail: parts[5]!,
        authorDate: parts[6]!,
        committerDate: parts[7]!,
        parentHashes: parts[8] ? parts[8].split(" ") : [],
        refs: parseRefs(parts[9] || ""),
        gravatarHash: detailEmail
          ? crypto.createHash("md5").update(detailEmail).digest("hex")
          : undefined,
      };
    });
  }

  async showFile(hash: string, filePath: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git show", [`${hash}:${filePath}`], async () => {
      return git.raw(["show", `${hash}:${filePath}`]);
    });
  }

  async getCommitFullInfo(hash: string): Promise<CommitFullInfo> {
    const git = this.ensureRepo();
    return this.run("git show / branch --contains / tag --contains", [hash], async () => {
      // Get commit details including committer info
      const FIELD_SEP = "%x00";
      const format = [
        "%H",
        "%h",
        "%s",
        "%b",
        "%an",
        "%ae",
        "%aI",
        "%cn",
        "%ce",
        "%cI",
        "%P",
        "%D",
      ].join(FIELD_SEP);

      const result = await git.raw(["show", hash, `--format=${format}`, "--no-patch"]);
      const parts = result.trim().split("\0");
      const email = (parts[5] || "").trim().toLowerCase();

      // Get child commits (commits whose parent is this hash)
      let childHashes: string[] = [];
      try {
        const childResult = await git.raw(["rev-list", "--children", "--all"]);
        for (const line of childResult.trim().split("\n")) {
          const tokens = line.trim().split(" ");
          if (tokens[0] === hash && tokens.length > 1) {
            childHashes = tokens.slice(1);
            break;
          }
        }
      } catch {
        /* no children */
      }

      // Get branches containing this commit
      let containedInBranches: string[] = [];
      try {
        const branchResult = await git.raw(["branch", "-a", "--contains", hash]);
        containedInBranches = branchResult
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((b) => b.replace(/^\*?\s+/, "").trim())
          .filter(Boolean);
      } catch {
        /* empty */
      }

      // Get tags containing this commit
      let containedInTags: string[] = [];
      try {
        const tagResult = await git.raw(["tag", "--contains", hash]);
        containedInTags = tagResult
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((t) => t.trim());
      } catch {
        /* empty */
      }

      // Get nearest ancestor tag
      let derivesFromTag = "";
      try {
        derivesFromTag = (await git.raw(["describe", "--tags", "--abbrev=0", hash])).trim();
      } catch {
        /* no tag */
      }

      return {
        hash: parts[0] || "",
        abbreviatedHash: parts[1] || "",
        subject: parts[2] || "",
        body: (parts[3] || "").trim(),
        authorName: parts[4] || "",
        authorEmail: parts[5] || "",
        authorDate: parts[6] || "",
        committerName: parts[7] || "",
        committerEmail: parts[8] || "",
        committerDate: parts[9] || "",
        parentHashes: parts[10] ? parts[10].split(" ") : [],
        childHashes,
        refs: parseRefs(parts[11] || ""),
        gravatarHash: email ? crypto.createHash("md5").update(email).digest("hex") : undefined,
        containedInBranches,
        containedInTags,
        derivesFromTag,
      };
    });
  }

  async getBranches(): Promise<BranchInfo[]> {
    const git = this.ensureRepo();
    return this.run("git branch", ["-a", "-vv"], async () => {
      const summary = await git.branch(["-a", "-vv"]);
      const branches = Object.entries(summary.branches).map(([name, info]) => {
        const tracking = info.label?.match(/\[(.+?)[\]:]/)?.[1];
        let ahead: number | undefined;
        let behind: number | undefined;

        // Parse ahead/behind from label like "[origin/main: ahead 2, behind 1]"
        const aheadMatch = info.label?.match(/ahead (\d+)/);
        const behindMatch = info.label?.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1]!);
        if (behindMatch) behind = parseInt(behindMatch[1]!);

        return {
          name,
          current: info.current,
          remote: name.startsWith("remotes/"),
          tracking,
          ahead,
          behind,
          lastCommitHash: info.commit,
        };
      });
      return branches;
    });
  }

  async createBranch(name: string, startPoint?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = startPoint ? [name, startPoint] : [name];
    await this.run("git branch", args, () => git.branch(args));
  }

  async deleteBranch(name: string, force = false): Promise<void> {
    const git = this.ensureRepo();
    const flag = force ? "-D" : "-d";
    await this.run("git branch", [flag, name], () => git.branch([flag, name]));
  }

  async deleteRemoteBranch(remote: string, branch: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git push", [remote, "--delete", branch], () =>
      git.raw(["push", remote, "--delete", branch])
    );
  }

  /**
   * Strip remote prefix from a ref so git DWIM creates a local tracking branch.
   * Handles both "remotes/origin/feature" and "origin/feature" formats.
   */
  private async stripRemotePrefix(ref: string): Promise<string> {
    if (ref.startsWith("remotes/")) {
      return ref.replace(/^remotes\/[^/]+\//, "");
    }
    if (ref.includes("/")) {
      const git = this.ensureRepo();
      const remotes = await git.getRemotes();
      for (const remote of remotes) {
        if (ref.startsWith(remote.name + "/")) {
          return ref.slice(remote.name.length + 1);
        }
      }
    }
    return ref;
  }

  async checkout(ref: string): Promise<void> {
    const git = this.ensureRepo();
    const checkoutRef = await this.stripRemotePrefix(ref);
    await this.run("git checkout", [checkoutRef], () => git.checkout(checkoutRef));
    // If we checked out from a remote ref and a local branch already existed,
    // fast-forward it to match the remote so the user sees the latest commits.
    if (ref !== checkoutRef) {
      try {
        await git.merge([ref, "--ff-only"]);
      } catch {
        // Can't fast-forward (diverged history) — stay on local branch as-is
      }
    }
  }

  async checkoutWithOptions(ref: string, options: { merge?: boolean }): Promise<void> {
    const git = this.ensureRepo();
    const checkoutRef = await this.stripRemotePrefix(ref);
    const args = [checkoutRef];
    if (options.merge) args.push("--merge");
    await this.run("git checkout", args, () => git.raw(["checkout", ...args]));
    // Fast-forward local branch to remote if checking out from a remote ref
    if (ref !== checkoutRef) {
      try {
        await git.merge([ref, "--ff-only"]);
      } catch {
        // Can't fast-forward — stay on local branch as-is
      }
    }
  }

  async renameBranch(oldName: string, newName: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git branch", ["-m", oldName, newName], () =>
      git.branch(["-m", oldName, newName])
    );
  }

  async merge(branch: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git merge", [branch], async () => {
      const result = await git.merge([branch]);
      return result.result;
    });
  }

  async mergeWithOptions(options: MergeOptions): Promise<string> {
    const git = this.ensureRepo();
    const args: string[] = [];

    if (options.mergeStrategy === "no-ff") args.push("--no-ff");
    if (options.noCommit) args.push("--no-commit");
    if (options.squash) args.push("--squash");
    if (options.allowUnrelatedHistories) args.push("--allow-unrelated-histories");
    if (options.log !== null && options.log !== undefined && options.log > 0)
      args.push(`--log=${options.log}`);
    if (options.message) args.push("-m", options.message);

    args.push(options.branch);

    return this.run("git merge", args, async () => {
      const result = await git.raw(["merge", ...args]);
      return result;
    });
  }

  async rebase(onto: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", [onto], () => git.rebase([onto]));
  }

  async rebaseWithOptions(options: RebaseOptions): Promise<void> {
    const git = this.ensureRepo();
    const args: string[] = [];

    if (options.interactive) args.push("-i");
    if (options.preserveMerges) args.push("--rebase-merges");
    if (options.autosquash) args.push("--autosquash");
    if (options.autoStash) args.push("--autostash");
    if (options.ignoreDate) args.push("--ignore-date");
    if (options.committerDateIsAuthorDate) args.push("--committer-date-is-author-date");
    if (options.updateRefs) args.push("--update-refs");

    if (options.rangeFrom) {
      // Specific range: rebase --onto <onto> <from> <to>
      args.push("--onto", options.onto, options.rangeFrom);
      if (options.rangeTo) args.push(options.rangeTo);
    } else {
      args.push(options.onto);
    }

    if (options.interactive && options.todoEntries && options.todoEntries.length > 0) {
      // Build the todo file for interactive rebase
      const todoContent = options.todoEntries.map((e) => `${e.action} ${e.hash}`).join("\n") + "\n";

      const todoPath = path.join(this.repoPath!, ".git", "rebase-todo-custom.txt");
      fs.writeFileSync(todoPath, todoContent);

      const editorScript = path.join(this.repoPath!, ".git", "rebase-editor.sh");
      fs.writeFileSync(editorScript, `#!/bin/sh\ncp "${todoPath}" "$1"\n`, {
        mode: 0o755,
      });

      await this.run("git rebase", args, async () => {
        try {
          await git.env("GIT_SEQUENCE_EDITOR", editorScript).rebase(args);
        } finally {
          try {
            fs.unlinkSync(todoPath);
          } catch {}
          try {
            fs.unlinkSync(editorScript);
          } catch {}
        }
      });
    } else {
      await this.run("git rebase", args, () => git.rebase(args));
    }
  }

  async rebaseAbort(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", ["--abort"], () => git.rebase(["--abort"]));
  }

  async mergeAbort(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git merge", ["--abort"], () => git.raw(["merge", "--abort"]));
  }

  async mergeContinue(): Promise<void> {
    const git = this.ensureRepo();
    const mergeMsgPath = path.join(this.repoPath!, ".git", "MERGE_MSG");
    let message = "Merge commit";
    try {
      message = fs.readFileSync(mergeMsgPath, "utf-8").trim();
    } catch {
      // Fallback to default message
    }
    await this.run("git commit", [message], () => git.commit(message));
  }

  async cherryPickAbort(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git cherry-pick", ["--abort"], () => git.raw(["cherry-pick", "--abort"]));
  }

  async cherryPickContinue(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git cherry-pick", ["--continue"], () => git.raw(["cherry-pick", "--continue"]));
  }

  async resetToCommit(hash: string, mode: "soft" | "mixed" | "hard"): Promise<void> {
    const git = this.ensureRepo();
    const flag = `--${mode}`;
    await this.run("git reset", [flag, hash], () => git.reset([flag, hash]));
  }

  async cherryPick(hash: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git cherry-pick", [hash], () => git.raw(["cherry-pick", hash]));
  }

  async cherryPickWithOptions(options: CherryPickOptions): Promise<void> {
    const git = this.ensureRepo();
    const args = ["cherry-pick"];
    if (options.noCommit) args.push("--no-commit");
    if (options.mainline) args.push("-m", String(options.mainline));
    args.push(options.hash);
    await this.run("git cherry-pick", args.slice(1), () => git.raw(args));
  }

  async revertCommit(options: RevertOptions): Promise<void> {
    const git = this.ensureRepo();
    const args = ["revert"];
    if (options.noCommit) args.push("--no-commit");
    if (options.mainline) args.push("-m", String(options.mainline));
    args.push(options.hash);
    await this.run("git revert", args.slice(1), () => git.raw(args));
  }

  async getSquashPreview(targetHash: string): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log", [`${targetHash}..HEAD`], async () => {
      const RECORD_SEP = "%x1e";
      const FIELD_SEP = "%x00";
      const format = ["%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D"].join(FIELD_SEP);

      const result = await git.raw([
        "log",
        `--format=${RECORD_SEP}${format}`,
        `${targetHash}..HEAD`,
      ]);

      if (!result.trim()) return [];

      return result
        .split("\x1e")
        .filter((chunk) => chunk.trim())
        .map((chunk) => {
          const parts = chunk.trim().split("\0");
          return {
            hash: parts[0] || "",
            abbreviatedHash: parts[1] || "",
            subject: parts[2] || "",
            body: "",
            authorName: parts[3] || "",
            authorEmail: parts[4] || "",
            authorDate: parts[5] || "",
            committerDate: parts[6] || "",
            parentHashes: parts[7] ? parts[7].split(" ") : [],
            refs: [],
          };
        });
    });
  }

  async squashCommits(options: SquashOptions): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git squash", [options.targetHash], async () => {
      // Soft reset to the parent of the target commit, keeping all changes staged
      await git.reset(["--soft", `${options.targetHash}~1`]);
      // Create a new commit with the combined message
      await git.commit(options.message);
    });
  }

  async getTags(): Promise<TagInfo[]> {
    const git = this.ensureRepo();
    return this.run("git tag", ["-l"], async () => {
      const result = await git.tags();
      return result.all.map((name) => ({ name, hash: "" }));
    });
  }

  async createTag(name: string, commitHash: string, message?: string): Promise<void> {
    const git = this.ensureRepo();
    if (message) {
      await this.run("git tag", ["-a", name, commitHash, "-m", message], () =>
        git.tag(["-a", name, commitHash, "-m", message])
      );
    } else {
      await this.run("git tag", [name, commitHash], () => git.tag([name, commitHash]));
    }
  }

  async deleteTag(name: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git tag", ["-d", name], () => git.tag(["-d", name]));
  }

  async deleteRemoteTag(name: string, remote = "origin"): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git push --delete tag", [remote, "--delete", `refs/tags/${name}`], () =>
      git.raw(["push", remote, "--delete", `refs/tags/${name}`])
    );
  }

  async pushTag(name: string, remote = "origin"): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git push", [remote, name], () => git.push(remote, name));
  }

  async getStashList(): Promise<StashEntry[]> {
    const git = this.ensureRepo();
    return this.run("git stash list", [], async () => {
      const result = await git.stashList();
      return result.all.map((entry, index) => ({
        index,
        message: entry.message,
        date: entry.date,
        hash: entry.hash,
      }));
    });
  }

  async stashCreate(
    message?: string,
    options?: { keepIndex?: boolean; includeUntracked?: boolean; staged?: boolean }
  ): Promise<void> {
    const git = this.ensureRepo();
    const args = ["push"];
    if (options?.staged) args.push("--staged");
    if (options?.keepIndex) args.push("--keep-index");
    if (options?.includeUntracked) args.push("--include-untracked");
    if (message) args.push("-m", message);
    await this.run("git stash", args, () => git.stash(args));
  }

  async stashPop(index = 0): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git stash", ["pop", `stash@{${index}}`], () =>
      git.stash(["pop", `stash@{${index}}`])
    );
  }

  async stashApply(index = 0): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git stash", ["apply", `stash@{${index}}`], () =>
      git.stash(["apply", `stash@{${index}}`])
    );
  }

  async stashDrop(index = 0): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git stash", ["drop", `stash@{${index}}`], () =>
      git.stash(["drop", `stash@{${index}}`])
    );
  }

  async blame(file: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git blame", [file], () => git.raw(["blame", "--porcelain", file]));
  }

  async getSubmodules(): Promise<{ name: string; path: string; url: string; hash: string }[]> {
    const git = this.ensureRepo();
    return this.run("git submodule", ["status"], async () => {
      const result = await git.raw(["submodule", "status"]).catch(() => "");
      if (!result.trim()) return [];
      return result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const match = line.trim().match(/^[+ -]?([0-9a-f]+)\s+(\S+)(?:\s+\((.+)\))?/);
          if (!match) return null;
          return {
            name: match[2],
            path: match[2],
            url: "",
            hash: match[1],
          };
        })
        .filter(Boolean) as { name: string; path: string; url: string; hash: string }[];
    });
  }

  /**
   * Get the list of commits that would be rebased onto `onto`.
   * Returns commits from HEAD down to (but not including) the merge-base with `onto`.
   */
  async getRebaseCommits(onto: string): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log", [`${onto}..HEAD`], async () => {
      const RECORD_SEP = "%x1e";
      const FIELD_SEP = "%x00";
      const format = ["%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D"].join(FIELD_SEP);

      const result = await git.raw([
        "log",
        "--reverse",
        `--format=${RECORD_SEP}${format}`,
        `${onto}..HEAD`,
      ]);

      if (!result.trim()) return [];

      return result
        .split("\x1e")
        .filter((chunk) => chunk.trim())
        .map((chunk) => {
          const parts = chunk.trim().split("\0");
          return {
            hash: parts[0] || "",
            abbreviatedHash: parts[1] || "",
            subject: parts[2] || "",
            body: "",
            authorName: parts[3] || "",
            authorEmail: parts[4] || "",
            authorDate: parts[5] || "",
            committerDate: parts[6] || "",
            parentHashes: parts[7] ? parts[7].split(" ") : [],
            refs: [],
          };
        });
    });
  }

  /**
   * Execute an interactive rebase using a pre-built todo list.
   * Each entry: { action: "pick"|"reword"|"squash"|"fixup"|"edit"|"drop", hash, subject }
   */
  async interactiveRebase(
    onto: string,
    todoEntries: { action: string; hash: string }[]
  ): Promise<void> {
    const git = this.ensureRepo();

    // Build the todo file content
    const todoContent = todoEntries.map((e) => `${e.action} ${e.hash}`).join("\n") + "\n";

    // Write todo to a temp file
    const todoPath = path.join(this.repoPath!, ".git", "rebase-todo-custom.txt");
    fs.writeFileSync(todoPath, todoContent);

    // Create a script that copies our todo over the default one
    const editorScript = path.join(this.repoPath!, ".git", "rebase-editor.sh");
    // The editor receives the todo file path as $1
    fs.writeFileSync(editorScript, `#!/bin/sh\ncp "${todoPath}" "$1"\n`, { mode: 0o755 });

    await this.run("git rebase", ["-i", onto], async () => {
      try {
        await git.env("GIT_SEQUENCE_EDITOR", editorScript).rebase(["-i", onto]);
      } finally {
        // Cleanup temp files
        try {
          fs.unlinkSync(todoPath);
        } catch {}
        try {
          fs.unlinkSync(editorScript);
        } catch {}
      }
    });
  }

  async rebaseContinue(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", ["--continue"], () => git.rebase(["--continue"]));
  }

  async rebaseSkip(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", ["--skip"], () => git.rebase(["--skip"]));
  }

  async isRebaseInProgress(): Promise<boolean> {
    if (!this.repoPath) return false;
    return (
      fs.existsSync(path.join(this.repoPath, ".git", "rebase-merge")) ||
      fs.existsSync(path.join(this.repoPath, ".git", "rebase-apply"))
    );
  }

  // ─── Conflict resolution ───────────────────────────

  async getConflictedFiles(): Promise<ConflictFile[]> {
    const git = this.ensureRepo();
    // git diff --name-only --diff-filter=U lists unmerged files
    const raw = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
    if (!raw.trim()) return [];

    const files: ConflictFile[] = [];
    // Also get detailed status to determine conflict reason
    const statusRaw = await git.raw(["status", "--porcelain"]);
    const statusMap = new Map<string, string>();
    for (const line of statusRaw.split("\n")) {
      if (!line.trim()) continue;
      const xy = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      statusMap.set(filePath, xy);
    }

    for (const filePath of raw.split("\n").filter((l) => l.trim())) {
      const xy = statusMap.get(filePath) || "UU";
      let reason = "both-modified";
      if (xy === "AA") reason = "both-added";
      else if (xy === "DD") reason = "both-deleted";
      else if (xy === "DU") reason = "deleted-by-us";
      else if (xy === "UD") reason = "deleted-by-them";
      else if (xy === "AU") reason = "added-by-us";
      else if (xy === "UA") reason = "added-by-them";
      files.push({ path: filePath, reason });
    }
    return files;
  }

  async getConflictFileContent(filePath: string): Promise<ConflictFileContent> {
    const git = this.ensureRepo();

    // Read the three versions using git show :<stage>:<path>
    // Stage 1 = base, Stage 2 = ours, Stage 3 = theirs
    let base: string | null = null;
    let ours: string | null = null;
    let theirs: string | null = null;

    try {
      base = await git.raw(["show", `:1:${filePath}`]);
    } catch {
      base = null;
    }
    try {
      ours = await git.raw(["show", `:2:${filePath}`]);
    } catch {
      ours = null;
    }
    try {
      theirs = await git.raw(["show", `:3:${filePath}`]);
    } catch {
      theirs = null;
    }

    // Read the current working tree file with conflict markers
    let merged = "";
    try {
      const fullPath = path.join(this.repoPath!, filePath);
      merged = fs.readFileSync(fullPath, "utf-8");
    } catch {
      merged = "";
    }

    return { ours, theirs, base, merged };
  }

  async resolveConflict(filePath: string): Promise<void> {
    const git = this.ensureRepo();
    await git.add(filePath);
  }

  async saveMergedFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.repoPath!, filePath);
    fs.writeFileSync(fullPath, content, "utf-8");
  }

  /**
   * Launch an external merge tool for a conflicted file.
   * Writes base/ours/theirs to temp files, passes the real merged file path,
   * waits for the process to exit, then returns the updated merged content.
   */
  async launchExternalMergeTool(
    filePath: string,
    toolPath: string,
    toolArgs: string
  ): Promise<{ exitCode: number; mergedContent: string }> {
    const { spawn } = await import("child_process");
    const os = await import("os");

    if (!toolPath || !path.isAbsolute(toolPath)) {
      throw new Error("Merge tool path must be an absolute path to an executable");
    }
    try {
      fs.accessSync(toolPath, fs.constants.X_OK);
    } catch {
      throw new Error(`Merge tool not found or not executable: ${toolPath}`);
    }

    const allowedPlaceholders = /^[\w\s"'\-/\\.=:$]*$/;
    const strippedArgs = toolArgs
      .replace(/\$BASE/g, "")
      .replace(/\$LOCAL/g, "")
      .replace(/\$REMOTE/g, "")
      .replace(/\$MERGED/g, "");
    if (!allowedPlaceholders.test(strippedArgs)) {
      throw new Error("Merge tool arguments contain invalid characters");
    }

    const repoPath = this.repoPath!;
    const content = await this.getConflictFileContent(filePath);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitsmith-merge-"));

    const basePath = path.join(tmpDir, "BASE_" + path.basename(filePath));
    const localPath = path.join(tmpDir, "LOCAL_" + path.basename(filePath));
    const remotePath = path.join(tmpDir, "REMOTE_" + path.basename(filePath));
    const mergedPath = path.join(repoPath, filePath);

    fs.writeFileSync(basePath, content.base || "", "utf-8");
    fs.writeFileSync(localPath, content.ours || "", "utf-8");
    fs.writeFileSync(remotePath, content.theirs || "", "utf-8");

    // Replace placeholders in the argument pattern
    const resolvedArgs = toolArgs
      .replace(/\$BASE/g, basePath)
      .replace(/\$LOCAL/g, localPath)
      .replace(/\$REMOTE/g, remotePath)
      .replace(/\$MERGED/g, mergedPath);

    // Parse args respecting quotes
    const args =
      resolvedArgs.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, "")) || [];

    return new Promise((resolve) => {
      const proc = spawn(toolPath, args, { stdio: "ignore" });
      proc.on("error", () => {
        cleanup();
        resolve({ exitCode: -1, mergedContent: "" });
      });
      proc.on("close", (code) => {
        let mergedContent = "";
        try {
          mergedContent = fs.readFileSync(mergedPath, "utf-8");
        } catch {
          /* file may not exist */
        }
        cleanup();
        resolve({ exitCode: code ?? -1, mergedContent });
      });

      function cleanup() {
        try {
          fs.unlinkSync(basePath);
        } catch {
          /* ignore */
        }
        try {
          fs.unlinkSync(localPath);
        } catch {
          /* ignore */
        }
        try {
          fs.unlinkSync(remotePath);
        } catch {
          /* ignore */
        }
        try {
          fs.rmdirSync(tmpDir);
        } catch {
          /* ignore */
        }
      }
    });
  }

  async getConfig(key: string, global = false): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git config", [key], async () => {
      try {
        const args = global ? ["--global", key] : [key];
        return (await git.raw(["config", ...args])).trim();
      } catch {
        return "";
      }
    });
  }

  async setConfig(key: string, value: string, global = false): Promise<void> {
    const git = this.ensureRepo();
    const args = global ? ["--global", key, value] : [key, value];
    await this.run("git config", args, () => git.raw(["config", ...args]));
  }

  async listConfig(global = false): Promise<Record<string, string>> {
    const git = this.ensureRepo();
    return this.run("git config", ["--list"], async () => {
      const args = global ? ["--global", "--list"] : ["--list"];
      const result = await git.raw(["config", ...args]).catch(() => "");
      const config: Record<string, string> = {};
      for (const line of result.split("\n").filter(Boolean)) {
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          config[line.slice(0, eqIdx)] = line.slice(eqIdx + 1);
        }
      }
      return config;
    });
  }

  async applyAccount(
    name: string,
    email: string,
    options?: { signingKey?: string; sshKeyPath?: string; global?: boolean }
  ): Promise<void> {
    const global = options?.global ?? false;
    await this.setConfig("user.name", name, global);
    await this.setConfig("user.email", email, global);
    if (options?.signingKey) {
      await this.setConfig("user.signingKey", options.signingKey, global);
    }
    if (options?.sshKeyPath) {
      await this.setConfig(
        "core.sshCommand",
        `ssh -i "${options.sshKeyPath}" -o IdentitiesOnly=yes`,
        global
      );
    } else {
      // Remove core.sshCommand to fall back to default SSH behavior
      const git = this.ensureRepo();
      const scope = global ? "--global" : "--local";
      await git.raw(["config", "--unset", scope, "core.sshCommand"]).catch(() => {
        /* ignore if key doesn't exist */
      });
    }
  }

  async addSubmodule(url: string, path?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = ["add", url];
    if (path) args.push(path);
    await this.run("git submodule", args, () => git.raw(["submodule", ...args]));
  }

  async submoduleUpdate(init = false): Promise<void> {
    const git = this.ensureRepo();
    const args = init ? ["update", "--init", "--recursive"] : ["update", "--recursive"];
    await this.run("git submodule", args, () => git.raw(["submodule", ...args]));
  }

  async getFileHistory(file: string, maxCount = 100): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log", ["--follow", file], async () => {
      const RECORD_SEP = "%x1e";
      const FIELD_SEP = "%x00";
      const format = ["%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D"].join(FIELD_SEP);

      const result = await git.raw([
        "log",
        "--follow",
        `--format=${RECORD_SEP}${format}`,
        `--max-count=${maxCount}`,
        "--",
        file,
      ]);

      if (!result.trim()) return [];

      return result
        .split("\x1e")
        .filter((chunk) => chunk.trim())
        .map((chunk) => {
          const parts = chunk.trim().split("\0");
          return {
            hash: parts[0] || "",
            abbreviatedHash: parts[1] || "",
            subject: parts[2] || "",
            body: "",
            authorName: parts[3] || "",
            authorEmail: parts[4] || "",
            authorDate: parts[5] || "",
            committerDate: parts[6] || "",
            parentHashes: parts[7] ? parts[7].split(" ") : [],
            refs: [],
          };
        });
    });
  }

  async getRemotes(): Promise<RemoteInfo[]> {
    const git = this.ensureRepo();
    return this.run("git remote", ["-v"], async () => {
      const result = await git.getRemotes(true);
      return result.map((r) => ({
        name: r.name,
        fetchUrl: r.refs.fetch || "",
        pushUrl: r.refs.push || "",
      }));
    });
  }

  async addRemote(name: string, url: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git remote add", [name, url], () => git.addRemote(name, url));
  }

  async removeRemote(name: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git remote remove", [name], () => git.removeRemote(name));
  }

  async clone(
    url: string,
    directory: string,
    options?: {
      branch?: string;
      bare?: boolean;
      recurseSubmodules?: boolean;
      shallow?: boolean;
      sshKeyPath?: string;
    }
  ): Promise<void> {
    let git = simpleGit().env(GitService.NO_PROMPT_ENV);
    if (options?.sshKeyPath) {
      git = git.env(
        "GIT_SSH_COMMAND",
        `ssh -i "${options.sshKeyPath}" -o IdentitiesOnly=yes -o BatchMode=yes`
      );
    }
    const args: string[] = [];
    if (options?.branch) {
      args.push("--branch", options.branch);
    }
    if (options?.bare) {
      args.push("--bare");
    }
    if (options?.recurseSubmodules) {
      args.push("--recurse-submodules");
    }
    if (options?.shallow) {
      args.push("--depth", "1");
    }
    await this.run("git clone", [url, directory, ...args], () => git.clone(url, directory, args));
  }

  async listRemoteBranches(url: string, sshKeyPath?: string): Promise<string[]> {
    let git = simpleGit().env(GitService.NO_PROMPT_ENV);
    if (sshKeyPath) {
      git = git.env(
        "GIT_SSH_COMMAND",
        `ssh -i "${sshKeyPath}" -o IdentitiesOnly=yes -o BatchMode=yes`
      );
    }
    const result = await this.run("git ls-remote --heads", [url], () =>
      git.listRemote(["--heads", url])
    );
    if (!result) return [];
    return result
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const ref = line.split("\t")[1] || "";
        return ref.replace("refs/heads/", "");
      })
      .filter(Boolean);
  }

  async fetch(remote?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = remote ? [remote] : [];
    await this.run("git fetch", args, () => (remote ? git.fetch(remote) : git.fetch()));
  }

  async fetchAll(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git fetch", ["--all"], () => git.fetch(["--all"]));
  }

  async fetchPrune(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git fetch", ["--all", "--prune"], () => git.fetch(["--all", "--prune"]));
  }

  /** Return a compact string snapshot of all refs (branches, tags, remotes) for change detection. */
  async getRefsSnapshot(): Promise<string> {
    const git = this.ensureRepo();
    return git.raw(["for-each-ref", "--format=%(refname) %(objectname)"]);
  }

  async pull(remote?: string, branch?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = [remote || "", branch || ""].filter(Boolean);
    await this.run("git pull", args, () => git.pull(remote, branch));
  }

  async pullRebase(remote?: string, branch?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = ["--rebase", remote || "", branch || ""].filter(Boolean);
    await this.run("git pull", ["--rebase", ...args.slice(1)], () =>
      git.pull(remote, branch, { "--rebase": null })
    );
  }

  async pullMerge(remote?: string, branch?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = ["--no-rebase", remote || "", branch || ""].filter(Boolean);
    await this.run("git pull", ["--no-rebase", ...args.slice(1)], () =>
      git.pull(remote, branch, { "--no-rebase": null })
    );
  }

  async push(remote?: string, branch?: string, force = false, setUpstream = false): Promise<void> {
    const git = this.ensureRepo();
    const r = remote || "origin";
    const flags: string[] = [];
    if (force) flags.push("--force");
    if (setUpstream) flags.push("--set-upstream");
    // logArgs: what the command-log panel shows (no "push" prefix)
    const logArgs = [...flags, r, ...(branch ? [branch] : [])];
    // rawArgs: full args for git.raw() which needs the subcommand included
    const rawArgs = ["push", ...logArgs];
    await this.run("git push", logArgs, () => git.raw(rawArgs));
  }

  async getDiff(file?: string, staged = false): Promise<string> {
    const git = this.ensureRepo();
    const args = staged ? ["--cached"] : [];
    if (file) args.push("--", file);
    return this.run("git diff", args, () => git.diff(args));
  }

  async getCommitDiff(hash: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git diff", [hash], async () => {
      return git.raw(["diff", `${hash}~1`, hash]);
    });
  }

  async getCommitFiles(hash: string): Promise<CommitFileInfo[]> {
    const git = this.ensureRepo();
    return this.run("git diff-tree", [hash, "--numstat"], async () => {
      const result = await git.raw([
        "diff-tree",
        "--no-commit-id",
        "-r",
        "--numstat",
        "--diff-filter=ACDMR",
        "-M",
        hash,
      ]);

      const statusResult = await git.raw([
        "diff-tree",
        "--no-commit-id",
        "-r",
        "--name-status",
        "--diff-filter=ACDMR",
        "-M",
        hash,
      ]);

      const statusMap = new Map<string, string>();
      for (const line of statusResult.trim().split("\n").filter(Boolean)) {
        const parts = line.split("\t");
        const statusChar = parts[0]![0]!;
        const filePath = parts[parts.length - 1]!;
        statusMap.set(filePath, statusChar);
      }

      return result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("\t");
          const additions = parseInt(parts[0]!) || 0;
          const deletions = parseInt(parts[1]!) || 0;
          const filePath = parts[2] || "";
          const s = statusMap.get(filePath) || "M";
          const statusLookup: Record<string, CommitFileInfo["status"]> = {
            A: "added",
            M: "modified",
            D: "deleted",
            R: "renamed",
            C: "copied",
          };
          return {
            path: filePath,
            status: statusLookup[s] || "modified",
            additions,
            deletions,
          };
        });
    });
  }

  async getStaleRemoteBranches(olderThanDays: number): Promise<StaleRemoteBranch[]> {
    const git = this.ensureRepo();
    return this.run("git branch", ["-r", "--sort=committerdate"], async () => {
      // Get remote branches with last commit info
      const raw = await git.raw([
        "for-each-ref",
        "--sort=committerdate",
        "--format=%(refname:short)%09%(committerdate:iso8601)%09%(objectname:short)%09%(subject)%09%(authorname)",
        "refs/remotes/",
      ]);
      if (!raw.trim()) return [];

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      const results: StaleRemoteBranch[] = [];
      for (const line of raw.trim().split("\n")) {
        const [fullName, dateStr, hash, subject, author] = line.split("\t");
        if (!fullName || fullName.endsWith("/HEAD")) continue;

        const commitDate = new Date(dateStr!);
        if (commitDate >= cutoff) continue;

        // Split "origin/branch-name" into remote and branch
        const slashIdx = fullName.indexOf("/");
        const remote = fullName.substring(0, slashIdx);
        const branchName = fullName.substring(slashIdx + 1);

        results.push({
          name: fullName,
          remote,
          branchName,
          lastCommitHash: hash!,
          lastCommitDate: dateStr!,
          lastCommitSubject: subject || "",
          lastCommitAuthor: author || "",
        });
      }
      return results;
    });
  }

  async getRemoteBranchCommits(remoteBranch: string, maxCount = 20): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log", [remoteBranch, `-${maxCount}`], async () => {
      const format = ["%H", "%h", "%s", "%b", "%an", "%ae", "%aI", "%cI", "%P", "%D"].join("%x00");
      const raw = await git.raw([
        "log",
        remoteBranch,
        `--max-count=${maxCount}`,
        `--format=${format}`,
      ]);
      if (!raw.trim()) return [];
      return raw
        .trim()
        .split("\n")
        .map((line) => {
          const parts = line.split("\x00");
          return {
            hash: parts[0]!,
            abbreviatedHash: parts[1]!,
            subject: parts[2]!,
            body: parts[3]!,
            authorName: parts[4]!,
            authorEmail: parts[5]!,
            authorDate: parts[6]!,
            committerDate: parts[7]!,
            parentHashes: parts[8] ? parts[8].split(" ") : [],
            refs: parseRefs(parts[9] || ""),
          };
        });
    });
  }

  async getTreeFiles(hash: string): Promise<string[]> {
    const git = this.ensureRepo();
    return this.run("git ls-tree", ["-r", "--name-only", hash], async () => {
      const result = await git.raw(["ls-tree", "-r", "--name-only", hash]);
      if (!result.trim()) return [];
      return result.trim().split("\n").filter(Boolean);
    });
  }

  async getCommitFileDiff(hash: string, file: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git diff", [`${hash}~1..${hash}`, "--", file], async () => {
      try {
        return await git.raw(["diff", `${hash}~1`, hash, "--", file]);
      } catch {
        // First commit has no parent
        return await git.raw(["diff", "--no-index", "/dev/null", file]).catch(() =>
          git.raw(["show", `${hash}:${file}`]).then(
            (content) =>
              `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split("\n").length} @@\n` +
              content
                .split("\n")
                .map((l) => `+${l}`)
                .join("\n")
          )
        );
      }
    });
  }

  async getRangeFiles(hash1: string, hash2: string): Promise<CommitFileInfo[]> {
    const git = this.ensureRepo();
    return this.run("git diff", [hash1, hash2, "--numstat"], async () => {
      const numstatResult = await git.raw([
        "diff",
        "--numstat",
        "--diff-filter=ACDMR",
        "-M",
        hash1,
        hash2,
      ]);
      const nameStatusResult = await git.raw([
        "diff",
        "--name-status",
        "--diff-filter=ACDMR",
        "-M",
        hash1,
        hash2,
      ]);

      const statusMap = new Map<string, string>();
      for (const line of nameStatusResult.trim().split("\n").filter(Boolean)) {
        const parts = line.split("\t");
        const statusChar = parts[0]![0]!;
        const filePath = parts[parts.length - 1]!;
        statusMap.set(filePath, statusChar);
      }

      return numstatResult
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("\t");
          const additions = parseInt(parts[0]!) || 0;
          const deletions = parseInt(parts[1]!) || 0;
          const filePath = parts[2] || "";
          const s = statusMap.get(filePath) || "M";
          const statusLookup: Record<string, CommitFileInfo["status"]> = {
            A: "added",
            M: "modified",
            D: "deleted",
            R: "renamed",
            C: "copied",
          };
          return {
            path: filePath,
            status: statusLookup[s] || "modified",
            additions,
            deletions,
          };
        });
    });
  }

  async getRangeFileDiff(hash1: string, hash2: string, file: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git diff", [hash1, hash2, "--", file], async () => {
      return git.raw(["diff", hash1, hash2, "--", file]);
    });
  }

  // ---------------------------------------------------------------------------
  // Grep
  // ---------------------------------------------------------------------------

  async grep(
    pattern: string,
    options: {
      ignoreCase?: boolean;
      regex?: boolean;
      wholeWord?: boolean;
      maxCount?: number;
    } = {}
  ): Promise<GrepResult> {
    const git = this.ensureRepo();
    const args = ["grep", "-n", "--heading"];
    if (options.ignoreCase) args.push("-i");
    if (!options.regex) args.push("-F");
    if (options.wholeWord) args.push("-w");
    if (options.maxCount) args.push(`--max-count=${options.maxCount}`);
    args.push("--", pattern);
    return this.run("git grep", [pattern], async () => {
      let result: string;
      try {
        result = await git.raw(args);
      } catch (e: unknown) {
        if (
          e &&
          typeof e === "object" &&
          "message" in e &&
          typeof (e as { message: string }).message === "string" &&
          (e as { message: string }).message.includes("exit code 1")
        ) {
          return { matches: [], totalCount: 0 };
        }
        throw e;
      }
      if (!result.trim()) return { matches: [], totalCount: 0 };
      const matches: GrepMatch[] = [];
      let currentFile = "";
      for (const line of result.split("\n")) {
        if (!line) {
          currentFile = "";
          continue;
        }
        if (!line.includes(":") && !currentFile) {
          currentFile = line;
          continue;
        }
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const lineNumStr = line.slice(0, colonIdx);
        const lineNum = parseInt(lineNumStr, 10);
        if (isNaN(lineNum)) {
          currentFile = line;
          continue;
        }
        const text = line.slice(colonIdx + 1);
        matches.push({ file: currentFile, line: lineNum, text });
      }
      return { matches, totalCount: matches.length };
    });
  }

  // ---------------------------------------------------------------------------
  // Branch Diff Comparison
  // ---------------------------------------------------------------------------

  async diffBranches(from: string, to: string): Promise<BranchDiffResult> {
    const git = this.ensureRepo();
    return this.run("git diff branches", [from, to], async () => {
      const numstatResult = await git.raw([
        "diff",
        "--numstat",
        "--diff-filter=ACDMR",
        "-M",
        `${from}...${to}`,
      ]);
      const nameStatusResult = await git.raw([
        "diff",
        "--name-status",
        "--diff-filter=ACDMR",
        "-M",
        `${from}...${to}`,
      ]);
      const statusMap = new Map<string, string>();
      for (const line of nameStatusResult.trim().split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split("\t");
        const statusChar = (parts[0] || "").charAt(0);
        const filePath = parts.length >= 3 ? parts[2]! : parts[1]!;
        const statusNames: Record<string, string> = {
          A: "added",
          M: "modified",
          D: "deleted",
          R: "renamed",
          C: "copied",
        };
        statusMap.set(filePath, statusNames[statusChar] || "modified");
      }
      let totalAdditions = 0;
      let totalDeletions = 0;
      const files: CommitFileInfo[] = [];
      for (const line of numstatResult.trim().split("\n")) {
        if (!line.trim()) continue;
        const [addStr, delStr, ...pathParts] = line.split("\t");
        const filePath = pathParts.join("\t");
        const additions = addStr === "-" ? 0 : parseInt(addStr!, 10) || 0;
        const deletions = delStr === "-" ? 0 : parseInt(delStr!, 10) || 0;
        totalAdditions += additions;
        totalDeletions += deletions;
        files.push({
          path: filePath,
          status: (statusMap.get(filePath) || "modified") as CommitFileInfo["status"],
          additions,
          deletions,
        });
      }
      return {
        files,
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
          filesChanged: files.length,
        },
      };
    });
  }

  async diffBranchFile(from: string, to: string, file: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git diff branch file", [from, to, file], async () => {
      return git.raw(["diff", `${from}...${to}`, "--", file]);
    });
  }

  // ---------------------------------------------------------------------------
  // Branch Commit Range Comparison
  // ---------------------------------------------------------------------------

  async logRange(from: string, to: string): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log range", [from, to], async () => {
      const SEP = "\x1e";
      const format = ["%H", "%h", "%s", "%an", "%ae", "%ai", "%ci", "%P"].join(SEP);
      const result = await git.raw(["log", `--format=${format}`, `${from}..${to}`]);
      if (!result.trim()) return [];
      return result
        .trim()
        .split("\n")
        .map((line) => {
          const parts = line.split(SEP);
          return {
            hash: parts[0]!,
            abbreviatedHash: parts[1]!,
            subject: parts[2]!,
            body: "",
            authorName: parts[3]!,
            authorEmail: parts[4]!,
            authorDate: parts[5]!,
            committerDate: parts[6]!,
            parentHashes: (parts[7] || "").split(" ").filter(Boolean),
            refs: [],
          };
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------

  async getUndoHistory(maxCount = 20): Promise<UndoEntry[]> {
    const git = this.ensureRepo();
    const SEP = "\x1e";
    const format = ["%H", "%gd", "%gs", "%s", "%ci"].join(SEP);
    const result = await git.raw(["reflog", `--format=${format}`, "-n", String(maxCount)]);
    if (!result.trim()) return [];
    return result
      .trim()
      .split("\n")
      .map((line, idx) => {
        const parts = line.split(SEP);
        return {
          index: idx,
          hash: parts[0]!,
          action: parts[2] || "",
          description: parts[3] || "",
          date: parts[4] || "",
        };
      });
  }

  async undoToReflog(reflogIndex: number): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git reset", [`HEAD@{${reflogIndex}}`], async () => {
      await git.raw(["reset", "--hard", `HEAD@{${reflogIndex}}`]);
    });
  }

  // ---------------------------------------------------------------------------
  // Advanced Stats
  // ---------------------------------------------------------------------------

  async getTimeline(period: "day" | "week" | "month" = "week"): Promise<TimelineEntry[]> {
    const git = this.ensureRepo();
    const format = period === "day" ? "%Y-%m-%d" : period === "week" ? "%Y-%W" : "%Y-%m";
    const result = await git.raw(["log", "--all", `--format=%ad`, `--date=format:${format}`]);
    if (!result.trim()) return [];
    const counts = new Map<string, number>();
    for (const line of result.trim().split("\n")) {
      counts.set(line, (counts.get(line) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getChurn(period: "day" | "week" | "month" = "week"): Promise<ChurnEntry[]> {
    const git = this.ensureRepo();
    const format = period === "day" ? "%Y-%m-%d" : period === "week" ? "%Y-%W" : "%Y-%m";
    const result = await git.raw([
      "log",
      "--all",
      "--numstat",
      `--format=DATE:%ad`,
      `--date=format:${format}`,
    ]);
    if (!result.trim()) return [];
    const data = new Map<string, { additions: number; deletions: number }>();
    let currentDate = "";
    for (const line of result.split("\n")) {
      if (line.startsWith("DATE:")) {
        currentDate = line.slice(5);
        continue;
      }
      if (!currentDate || !line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const add = parts[0] === "-" ? 0 : parseInt(parts[0]!, 10) || 0;
      const del = parts[1] === "-" ? 0 : parseInt(parts[1]!, 10) || 0;
      const entry = data.get(currentDate) || { additions: 0, deletions: 0 };
      entry.additions += add;
      entry.deletions += del;
      data.set(currentDate, entry);
    }
    return Array.from(data.entries())
      .map(([date, v]) => ({ date, additions: v.additions, deletions: v.deletions }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getContributorsTimeline(
    period: "day" | "week" | "month" = "month"
  ): Promise<ContributorTimelineEntry[]> {
    const git = this.ensureRepo();
    const format = period === "day" ? "%Y-%m-%d" : period === "week" ? "%Y-%W" : "%Y-%m";
    const SEP = "\x1e";
    const result = await git.raw([
      "log",
      "--all",
      `--format=%an${SEP}%ad`,
      `--date=format:${format}`,
    ]);
    if (!result.trim()) return [];
    const entries: ContributorTimelineEntry[] = [];
    const counts = new Map<string, number>();
    for (const line of result.trim().split("\n")) {
      const [author, date] = line.split(SEP);
      if (!author || !date) continue;
      const key = `${date}|${author}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const [key, count] of counts) {
      const [date, author] = key.split("|");
      entries.push({ date: date!, author: author!, count });
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date) || a.author.localeCompare(b.author));
  }

  // ---------------------------------------------------------------------------
  // Stats methods
  // ---------------------------------------------------------------------------

  async getReflog(maxCount = 100): Promise<ReflogEntry[]> {
    const git = this.ensureRepo();
    return this.run("git reflog", [`-n ${maxCount}`], async () => {
      const SEP = "‖";
      const format = [`%H`, `%h`, `%gd`, `%gs`, `%s`, `%ci`].join(SEP);
      const result = await git.raw(["reflog", `--format=${format}`, `-n`, String(maxCount)]);
      if (!result.trim()) return [];
      return result
        .trim()
        .split("\n")
        .map((line) => {
          const [hash, abbreviatedHash, selector, action, subject, date] = line.split(SEP);
          return {
            hash: hash!,
            abbreviatedHash: abbreviatedHash!,
            selector: selector!,
            action: action!,
            subject: subject!,
            date: date!,
          };
        });
    });
  }

  async getCodebaseStats(): Promise<CodebaseStats> {
    const git = this.ensureRepo();
    return this.run("git ls-files (codebase stats)", [], async () => {
      return computeCodebaseStats(git);
    });
  }

  async getLeaderboard(timeframe: Timeframe): Promise<LeaderboardEntry[]> {
    const git = this.ensureRepo();
    return this.run("git log --shortstat", ["--format=COMMIT_START"], async () => {
      const sinceArg: string[] = [];
      if (timeframe === "week") {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 7);
        sinceArg.push(`--since=${since.toISOString()}`);
      } else if (timeframe === "month") {
        const since = new Date();
        since.setUTCMonth(since.getUTCMonth() - 1);
        sinceArg.push(`--since=${since.toISOString()}`);
      }

      const output = await git.raw([
        "log",
        "--all",
        "--format=COMMIT_START%n%H%n%an%n%ae%n%aI",
        "--shortstat",
        ...sinceArg,
      ]);

      interface AuthorAccum {
        authorName: string;
        authorEmail: string;
        commits: number;
        linesAdded: number;
        linesRemoved: number;
        dates: string[];
      }

      const authorMap = new Map<string, AuthorAccum>();

      const blocks = output.split("COMMIT_START\n").filter((b) => b.trim().length > 0);
      for (const block of blocks) {
        const lines = block.split("\n");
        // lines[0] = hash, lines[1] = authorName, lines[2] = authorEmail, lines[3] = date
        const _hash = (lines[0] || "").trim();
        const authorName = (lines[1] || "").trim();
        const authorEmail = (lines[2] || "").trim();
        const date = (lines[3] || "").trim();
        if (!authorEmail) continue;

        // Find stat line: " N files changed, M insertions(+), K deletions(-)"
        let added = 0;
        let removed = 0;
        for (let i = 4; i < lines.length; i++) {
          const line = lines[i]!.trim();
          const insMatch = line.match(/(\d+)\s+insertion/);
          const delMatch = line.match(/(\d+)\s+deletion/);
          if (insMatch) added += parseInt(insMatch[1]!);
          if (delMatch) removed += parseInt(delMatch[1]!);
        }

        const entry = authorMap.get(authorEmail);
        if (entry) {
          entry.commits++;
          entry.linesAdded += added;
          entry.linesRemoved += removed;
          entry.dates.push(date);
        } else {
          authorMap.set(authorEmail, {
            authorName,
            authorEmail,
            commits: 1,
            linesAdded: added,
            linesRemoved: removed,
            dates: [date],
          });
        }
      }

      const result: LeaderboardEntry[] = [];
      for (const accum of authorMap.values()) {
        const gravatarHash = crypto
          .createHash("md5")
          .update(accum.authorEmail.toLowerCase().trim())
          .digest("hex");

        // Sort dates ascending
        const sortedDates = accum.dates
          .map((d) => d.substring(0, 10))
          .filter((d) => d.length === 10)
          .sort();
        const uniqueDates = [...new Set(sortedDates)];

        const longestStreak = computeLongestStreak(uniqueDates);
        const firstCommitDate = accum.dates.slice().sort()[0] || "";
        const lastCommitDate = accum.dates.slice().sort().reverse()[0] || "";

        result.push({
          authorName: accum.authorName,
          authorEmail: accum.authorEmail,
          gravatarHash,
          commits: accum.commits,
          linesAdded: accum.linesAdded,
          linesRemoved: accum.linesRemoved,
          firstCommitDate,
          lastCommitDate,
          longestStreak,
          rank: 0,
        });
      }

      result.sort((a, b) => b.commits - a.commits);
      result.forEach((e, i) => {
        e.rank = i + 1;
      });
      return result;
    });
  }

  async getAuthorDetail(email: string, timeframe: Timeframe): Promise<AuthorDetail> {
    const git = this.ensureRepo();
    return this.run(
      "git log --numstat",
      ["--format=COMMIT_START", `--author=^${email}$`],
      async () => {
        const sinceArg: string[] = [];
        if (timeframe === "week") {
          const since = new Date();
          since.setUTCDate(since.getUTCDate() - 7);
          sinceArg.push(`--since=${since.toISOString()}`);
        } else if (timeframe === "month") {
          const since = new Date();
          since.setUTCMonth(since.getUTCMonth() - 1);
          sinceArg.push(`--since=${since.toISOString()}`);
        }

        const output = await git.raw([
          "log",
          "--all",
          `--author=${email}`,
          "--format=COMMIT_START%n%an%n%aI%n%ae",
          "--numstat",
          ...sinceArg,
        ]);

        if (!output.trim()) {
          return {
            authorName: "",
            authorEmail: email,
            commitTimeline: [],
            topFiles: [],
            hourlyDistribution: new Array(24).fill(0),
            dailyDistribution: new Array(7).fill(0),
            avgCommitSize: 0,
            linesAdded: 0,
            linesRemoved: 0,
            longestStreak: 0,
            currentStreak: 0,
            firstCommitDate: "",
            lastCommitDate: "",
          };
        }

        let authorName = "";
        let totalAdded = 0;
        let totalRemoved = 0;
        const dates: string[] = [];
        const fileMap = new Map<string, number>();
        const hourlyDist = new Array(24).fill(0);
        const dailyDist = new Array(7).fill(0);
        const commitSizes: number[] = [];
        let firstCommitDate = "";
        let lastCommitDate = "";

        const blocks = output.split("COMMIT_START\n").filter((b) => b.trim().length > 0);
        for (const block of blocks) {
          const lines = block.split("\n");
          const name = (lines[0] || "").trim();
          const dateStr = (lines[1] || "").trim();
          const commitEmail = (lines[2] || "").trim().toLowerCase();

          // Safety net: verify exact email match (--author does substring matching)
          if (commitEmail !== email.toLowerCase()) continue;

          if (name && !authorName) authorName = name;
          if (dateStr) {
            dates.push(dateStr);
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              hourlyDist[d.getUTCHours()]++;
              dailyDist[d.getUTCDay()]++;
            }
          }

          let commitAdded = 0;
          let commitRemoved = 0;
          for (let i = 3; i < lines.length; i++) {
            const line = lines[i]!.trim();
            if (!line) continue;
            const parts = line.split("\t");
            if (parts.length < 3) continue;
            const added = parseInt(parts[0]!) || 0;
            const removed = parseInt(parts[1]!) || 0;
            const filePath = parts[2]!.trim();
            if (!filePath) continue;
            commitAdded += added;
            commitRemoved += removed;
            fileMap.set(filePath, (fileMap.get(filePath) || 0) + added + removed);
          }
          totalAdded += commitAdded;
          totalRemoved += commitRemoved;
          commitSizes.push(commitAdded + commitRemoved);
        }

        const sortedDates = dates
          .map((d) => d.substring(0, 10))
          .filter((d) => d.length === 10)
          .sort();

        const allSortedFull = dates.slice().sort();
        firstCommitDate = allSortedFull[0] || "";
        lastCommitDate = allSortedFull[allSortedFull.length - 1] || "";

        const uniqueDates = [...new Set(sortedDates)];
        const longestStreak = computeLongestStreak(uniqueDates);
        const currentStreak = computeCurrentStreak(uniqueDates);

        // Commit timeline: group by day (week/month), week (all)
        const timelineMap = new Map<string, number>();
        for (const d of dates) {
          let key: string;
          if (timeframe === "all") {
            // group by week: ISO week start (Monday)
            const dt = new Date(d);
            const dayOfWeek = dt.getUTCDay(); // 0=Sun
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(dt);
            monday.setUTCDate(dt.getUTCDate() - diff);
            key = monday.toISOString().substring(0, 10);
          } else {
            // group by day
            key = d.substring(0, 10);
          }
          timelineMap.set(key, (timelineMap.get(key) || 0) + 1);
        }
        const commitTimeline = [...timelineMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date, count }));

        // Top files
        const topFiles = [...fileMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([path, changes]) => ({ path, changes }));

        const avgCommitSize =
          commitSizes.length > 0 ? commitSizes.reduce((a, b) => a + b, 0) / commitSizes.length : 0;

        return {
          authorName,
          authorEmail: email,
          commitTimeline,
          topFiles,
          hourlyDistribution: hourlyDist,
          dailyDistribution: dailyDist,
          avgCommitSize,
          linesAdded: totalAdded,
          linesRemoved: totalRemoved,
          longestStreak,
          currentStreak,
          firstCommitDate,
          lastCommitDate,
        };
      }
    );
  }

  private validateRef(ref: string): void {
    if (!ref || ref.startsWith("-")) {
      throw new Error(`Invalid git ref: ${ref}`);
    }
    for (let i = 0; i < ref.length; i++) {
      const code = ref.charCodeAt(i);
      if (code <= 0x1f || code === 0x7f) {
        throw new Error(`Invalid git ref: ${ref}`);
      }
    }
  }

  async getTagsBefore(hash: string): Promise<string[]> {
    if (!this.git) throw new Error("No repo open");
    this.validateRef(hash);
    const result = await this.git.raw(["tag", "--merged", hash, "--sort=-creatordate"]);
    return result
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async getChangelogCommits(from: string, to: string): Promise<ChangelogEntry[]> {
    if (!this.git) throw new Error("No repo open");
    this.validateRef(from);
    this.validateRef(to);
    const FIELD_SEP = "\x00";
    const RECORD_SEP = "\x1e";
    // Use git's %x00/%x1e format escapes so the argument string has no literal null bytes
    const format = "%H%x00%h%x00%s%x00%b%x00%an%x00%aI%x1e";

    const raw = await this.git.raw(["log", `${from}..${to}`, "--no-merges", `--format=${format}`]);

    if (!raw.trim()) return [];

    return raw
      .split(RECORD_SEP)
      .filter((r) => r.trim())
      .map((record) => {
        const fields = record.split(FIELD_SEP);
        return {
          hash: fields[0]!.trim(),
          abbreviatedHash: fields[1]?.trim() || "",
          subject: fields[2]?.trim() || "",
          description: fields[3]?.trim() || "",
          type: "other",
          breaking: false,
          authorName: fields[4]?.trim() || "",
          authorDate: fields[5]?.trim() || "",
        };
      });
  }

  // ─── GPG Signature Verification ─────────────────────────
  async verifyCommitSignature(
    hash: string
  ): Promise<{ signed: boolean; key?: string; status?: string; signer?: string }> {
    const git = this.ensureRepo();
    try {
      const raw = await git.raw(["log", "-1", "--format=%G?%x00%GK%x00%GS%x00%GG", hash]);
      const [status, key, signer] = raw.split("\0");
      const signed = status === "G" || status === "U" || status === "E";
      return {
        signed,
        key: key?.trim() || undefined,
        status: status?.trim() || undefined,
        signer: signer?.trim() || undefined,
      };
    } catch {
      return { signed: false };
    }
  }

  // ─── Archive/Export ──────────────────────────────────────
  async archive(ref: string, outputPath: string, format: "zip" | "tar.gz"): Promise<void> {
    const git = this.ensureRepo();
    const args = [
      "archive",
      "--format",
      format === "tar.gz" ? "tar.gz" : "zip",
      "-o",
      outputPath,
      ref,
    ];
    await this.run("git archive", args, () => git.raw(args));
  }

  // ─── Bisect ────────────────────────────────────────────
  async bisectStart(bad?: string, good?: string): Promise<string> {
    const git = this.ensureRepo();
    const args = ["bisect", "start"];
    if (bad) args.push(bad);
    if (good) args.push(good);
    return this.run("git bisect", ["start"], () => git.raw(args));
  }

  async bisectGood(ref?: string): Promise<string> {
    const git = this.ensureRepo();
    const args = ["bisect", "good"];
    if (ref) args.push(ref);
    return this.run("git bisect", ["good"], () => git.raw(args));
  }

  async bisectBad(ref?: string): Promise<string> {
    const git = this.ensureRepo();
    const args = ["bisect", "bad"];
    if (ref) args.push(ref);
    return this.run("git bisect", ["bad"], () => git.raw(args));
  }

  async bisectSkip(ref?: string): Promise<string> {
    const git = this.ensureRepo();
    const args = ["bisect", "skip"];
    if (ref) args.push(ref);
    return this.run("git bisect", ["skip"], () => git.raw(args));
  }

  async bisectReset(): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git bisect", ["reset"], () => git.raw(["bisect", "reset"]));
  }

  async bisectLog(): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git bisect", ["log"], () => git.raw(["bisect", "log"])).catch(() => "");
  }

  async bisectStatus(): Promise<{
    active: boolean;
    good: string[];
    bad: string[];
    current?: string;
  }> {
    const git = this.ensureRepo();
    try {
      const log = await git.raw(["bisect", "log"]).catch(() => "");
      if (!log.trim()) return { active: false, good: [], bad: [] };
      const good: string[] = [];
      const bad: string[] = [];
      for (const line of log.split("\n")) {
        const goodMatch = line.match(/# good: \[([0-9a-f]+)\]/);
        const badMatch = line.match(/# bad: \[([0-9a-f]+)\]/);
        if (goodMatch) good.push(goodMatch[1]!);
        if (badMatch) bad.push(badMatch[1]!);
      }
      const headRaw = await git.raw(["rev-parse", "HEAD"]).catch(() => "");
      return { active: true, good, bad, current: headRaw.trim() || undefined };
    } catch {
      return { active: false, good: [], bad: [] };
    }
  }

  // ─── Worktrees ─────────────────────────────────────────
  async worktreeList(): Promise<
    { path: string; branch: string; head: string; isBare: boolean; isMain: boolean }[]
  > {
    const git = this.ensureRepo();
    return this.run("git worktree", ["list"], async () => {
      const raw = await git.raw(["worktree", "list", "--porcelain"]);
      const worktrees: {
        path: string;
        branch: string;
        head: string;
        isBare: boolean;
        isMain: boolean;
      }[] = [];
      let current: {
        path: string;
        branch: string;
        head: string;
        isBare: boolean;
        isMain: boolean;
      } | null = null;
      for (const line of raw.split("\n")) {
        if (line.startsWith("worktree ")) {
          if (current) worktrees.push(current);
          current = {
            path: line.slice(9),
            branch: "",
            head: "",
            isBare: false,
            isMain: false,
          };
        } else if (current) {
          if (line.startsWith("HEAD ")) current.head = line.slice(5);
          else if (line.startsWith("branch "))
            current.branch = line.slice(7).replace("refs/heads/", "");
          else if (line === "bare") current.isBare = true;
        }
      }
      if (current) worktrees.push(current);
      if (worktrees.length > 0) worktrees[0]!.isMain = true;
      return worktrees;
    });
  }

  async worktreeAdd(path: string, branch?: string, createBranch?: boolean): Promise<void> {
    const git = this.ensureRepo();
    const args = ["worktree", "add"];
    if (createBranch && branch) {
      args.push("-b", branch, path);
    } else {
      args.push(path);
      if (branch) args.push(branch);
    }
    await this.run("git worktree", ["add", path], () => git.raw(args));
  }

  async worktreeRemove(path: string, force?: boolean): Promise<void> {
    const git = this.ensureRepo();
    const args = ["worktree", "remove"];
    if (force) args.push("--force");
    args.push(path);
    await this.run("git worktree", ["remove", path], () => git.raw(args));
  }

  // ─── Patches ───────────────────────────────────────────
  async formatPatch(hashes: string[], outputDir: string): Promise<string[]> {
    const git = this.ensureRepo();
    return this.run("git format-patch", hashes, async () => {
      const files: string[] = [];
      for (const hash of hashes) {
        const result = await git.raw(["format-patch", "-1", hash, "-o", outputDir]);
        files.push(...result.trim().split("\n").filter(Boolean));
      }
      return files;
    });
  }

  async applyPatch(patchPath: string, check?: boolean): Promise<string> {
    const git = this.ensureRepo();
    const args = ["apply"];
    if (check) args.push("--check");
    args.push(patchPath);
    return this.run("git apply", [patchPath], () => git.raw(args));
  }

  async previewPatch(patchPath: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git apply", ["--stat", patchPath], () =>
      git.raw(["apply", "--stat", patchPath])
    );
  }

  // ─── Git Notes ─────────────────────────────────────────
  async getNote(hash: string): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git notes", ["show", hash], () => git.raw(["notes", "show", hash])).catch(
      () => ""
    );
  }

  async addNote(hash: string, message: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git notes", ["add", hash], () =>
      git.raw(["notes", "add", "-f", "-m", message, hash])
    );
  }

  async removeNote(hash: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git notes", ["remove", hash], () => git.raw(["notes", "remove", hash]));
  }

  // ---------------------------------------------------------------------------
  // Submodules (enhanced)
  // ---------------------------------------------------------------------------

  async submoduleSync(recursive = true): Promise<void> {
    const git = this.ensureRepo();
    const args = recursive ? ["sync", "--recursive"] : ["sync"];
    await this.run("git submodule", args, () => git.raw(["submodule", ...args]));
  }

  async submoduleDeinit(submodulePath: string, force = false): Promise<void> {
    const git = this.ensureRepo();
    const args = force ? ["deinit", "-f", submodulePath] : ["deinit", submodulePath];
    await this.run("git submodule", args, () => git.raw(["submodule", ...args]));
  }

  async getSubmoduleStatus(): Promise<
    {
      name: string;
      path: string;
      url: string;
      hash: string;
      branch: string;
      status: string;
    }[]
  > {
    const git = this.ensureRepo();
    return this.run("git submodule", ["status"], async () => {
      const statusResult = await git.raw(["submodule", "status", "--recursive"]).catch(() => "");
      if (!statusResult.trim()) return [];

      // Parse .gitmodules for URLs and branches
      const configResult = await git
        .raw(["config", "--file", ".gitmodules", "--list"])
        .catch(() => "");
      const urlMap: Record<string, string> = {};
      const branchMap: Record<string, string> = {};
      for (const line of configResult.split("\n")) {
        const urlMatch = line.match(/^submodule\.(.+?)\.url=(.+)$/);
        if (urlMatch) urlMap[urlMatch[1]!] = urlMatch[2]!;
        const branchMatch = line.match(/^submodule\.(.+?)\.branch=(.+)$/);
        if (branchMatch) branchMap[branchMatch[1]!] = branchMatch[2]!;
      }

      return statusResult
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const prefix = line.charAt(0);
          const match = line.trim().match(/^[+ -U]?([0-9a-f]+)\s+(\S+)(?:\s+\((.+)\))?/);
          if (!match) return null;
          const subPath = match[2]!;
          let statusLabel = "up-to-date";
          if (prefix === "+") statusLabel = "modified";
          else if (prefix === "-") statusLabel = "uninitialized";
          else if (prefix === "U") statusLabel = "conflict";
          return {
            name: subPath,
            path: subPath,
            url: urlMap[subPath] || "",
            hash: match[1]!,
            branch: branchMap[subPath] || "",
            status: statusLabel,
          };
        })
        .filter(Boolean) as {
        name: string;
        path: string;
        url: string;
        hash: string;
        branch: string;
        status: string;
      }[];
    });
  }

  // ---------------------------------------------------------------------------
  // Git LFS
  // ---------------------------------------------------------------------------

  async lfsInstall(): Promise<string> {
    const git = this.ensureRepo();
    return this.run("git lfs", ["install"], () => git.raw(["lfs", "install"]));
  }

  async lfsStatus(): Promise<{
    installed: boolean;
    version: string;
    tracked: { pattern: string; filter: string }[];
    files: { path: string; lfsOid: string; size: string }[];
  }> {
    const git = this.ensureRepo();
    return this.run("git lfs", ["status"], async () => {
      // Check if LFS is installed
      let version = "";
      let installed = false;
      try {
        version = (await git.raw(["lfs", "version"])).trim();
        installed = true;
      } catch {
        return { installed: false, version: "", tracked: [], files: [] };
      }

      // Get tracked patterns
      const tracked: { pattern: string; filter: string }[] = [];
      try {
        const trackResult = await git.raw(["lfs", "track"]);
        for (const line of trackResult.split("\n")) {
          const m = line.match(/^\s+(\S+)\s+\((.+)\)/);
          if (m) tracked.push({ pattern: m[1]!, filter: m[2]! });
        }
      } catch {
        /* no tracked patterns */
      }

      // Get LFS files
      const files: { path: string; lfsOid: string; size: string }[] = [];
      try {
        const lsResult = await git.raw(["lfs", "ls-files", "--long"]);
        for (const line of lsResult.split("\n").filter(Boolean)) {
          const m = line.match(/^([0-9a-f]+)\s+[-*]\s+(.+)/);
          if (m) files.push({ path: m[2]!.trim(), lfsOid: m[1]!, size: "" });
        }
      } catch {
        /* no lfs files */
      }

      return { installed, version, tracked, files };
    });
  }

  async lfsListTracked(): Promise<{ pattern: string; filter: string }[]> {
    const git = this.ensureRepo();
    return this.run("git lfs", ["track"], async () => {
      const result = await git.raw(["lfs", "track"]);
      const tracked: { pattern: string; filter: string }[] = [];
      for (const line of result.split("\n")) {
        const m = line.match(/^\s+(\S+)\s+\((.+)\)/);
        if (m) tracked.push({ pattern: m[1]!, filter: m[2]! });
      }
      return tracked;
    });
  }

  async lfsTrack(pattern: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git lfs", ["track", pattern], () => git.raw(["lfs", "track", pattern]));
  }

  async lfsUntrack(pattern: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git lfs", ["untrack", pattern], () => git.raw(["lfs", "untrack", pattern]));
  }

  async lfsInfo(): Promise<{ storagePath: string; endpoint: string }> {
    const git = this.ensureRepo();
    return this.run("git lfs", ["env"], async () => {
      const result = await git.raw(["lfs", "env"]);
      let endpoint = "";
      let storagePath = "";
      for (const line of result.split("\n")) {
        if (line.includes("Endpoint")) {
          const m = line.match(/Endpoint[^=]+=\s*(.+)/);
          if (m) endpoint = m[1]!.trim();
        }
        if (line.includes("LocalMediaDir")) {
          const m = line.match(/LocalMediaDir[^=]+=\s*(.+)/);
          if (m) storagePath = m[1]!.trim();
        }
      }
      return { storagePath, endpoint };
    });
  }

  // ---------------------------------------------------------------------------
  // PR Integration
  // ---------------------------------------------------------------------------

  async detectProvider(): Promise<{
    provider: string;
    owner: string;
    repo: string;
    baseUrl: string;
  }> {
    const git = this.ensureRepo();
    return this.run("git remote", ["get-url origin"], async () => {
      const url = (await git.raw(["remote", "get-url", "origin"]).catch(() => "")).trim();
      if (!url) return { provider: "unknown", owner: "", repo: "", baseUrl: "" };

      // GitHub
      let m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (m)
        return {
          provider: "github",
          owner: m[1]!,
          repo: m[2]!,
          baseUrl: "https://github.com",
        };

      // GitLab
      m = url.match(/gitlab\.com[:/]([^/]+)\/([^/.]+)/);
      if (m)
        return {
          provider: "gitlab",
          owner: m[1]!,
          repo: m[2]!,
          baseUrl: "https://gitlab.com",
        };

      // Self-hosted detection (contains gitlab or github in hostname)
      m = url.match(/(?:https?:\/\/|git@)([^:/]+)[:/]([^/]+)\/([^/.]+)/);
      if (m) {
        const host = m[1]!;
        if (host.includes("gitlab"))
          return {
            provider: "gitlab",
            owner: m[2]!,
            repo: m[3]!,
            baseUrl: `https://${host}`,
          };
        if (host.includes("github"))
          return {
            provider: "github",
            owner: m[2]!,
            repo: m[3]!,
            baseUrl: `https://${host}`,
          };
      }

      return { provider: "unknown", owner: "", repo: "", baseUrl: "" };
    });
  }

  async listPrs(): Promise<
    {
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
    }[]
  > {
    this.ensureRepo();
    return this.run("gh/glab", ["pr list"], async () => {
      const detection = await this.detectProvider();
      const token = getPlatformTokenForRepo(this.repoPath!);

      if (detection.provider === "github") {
        if (token) {
          try {
            return await githubListPrs(detection.owner, detection.repo, token);
          } catch {
            return [];
          }
        }
        return [];
      }

      if (detection.provider === "gitlab") {
        if (token) {
          try {
            return await gitlabListMrs(detection.owner, detection.repo, token);
          } catch {
            return [];
          }
        }
        return [];
      }

      return [];
    });
  }

  async viewPr(number: number): Promise<string> {
    return this.run("gh/glab", ["pr view", String(number)], async () => {
      const detection = await this.detectProvider();
      const token = getPlatformTokenForRepo(this.repoPath!);

      if (detection.provider === "github") {
        if (!token) return "No platform token configured. Add a token in Account settings.";
        try {
          return await githubViewPr(detection.owner, detection.repo, token, number);
        } catch {
          return "Failed to fetch PR details.";
        }
      }

      if (detection.provider === "gitlab") {
        if (!token) return "No platform token configured. Add a token in Account settings.";
        try {
          return await gitlabViewMr(detection.owner, detection.repo, token, number);
        } catch {
          return "Failed to fetch MR details.";
        }
      }

      return "Unknown provider. Cannot view PR/MR.";
    });
  }

  async createPr(options: {
    title: string;
    body: string;
    targetBranch: string;
    sourceBranch: string;
    draft?: boolean;
  }): Promise<string> {
    return this.run("gh/glab", ["pr create"], async () => {
      const detection = await this.detectProvider();
      const token = getPlatformTokenForRepo(this.repoPath!);

      if (!token) {
        throw new Error(
          "No platform token configured. Add a GitHub/GitLab token in Account settings."
        );
      }

      if (detection.provider === "github") {
        return await githubCreatePr(detection.owner, detection.repo, token, options);
      }

      if (detection.provider === "gitlab") {
        return await gitlabCreateMr(detection.owner, detection.repo, token, options);
      }

      throw new Error(
        "Unknown provider. Cannot create PR/MR. Make sure 'gh' or 'glab' CLI is installed."
      );
    });
  }

  async getPrTemplate(): Promise<string | null> {
    if (!this.repoPath) return null;
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const candidates = [
      ".github/pull_request_template.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "docs/pull_request_template.md",
      "pull_request_template.md",
      "PULL_REQUEST_TEMPLATE.md",
      ".gitlab/merge_request_templates/Default.md",
    ];
    for (const candidate of candidates) {
      try {
        const content = await readFile(join(this.repoPath, candidate), "utf8");
        return content;
      } catch {
        // file not found, try next
      }
    }
    return null;
  }
}

function parseRefs(refString: string): CommitInfo["refs"] {
  if (!refString.trim()) return [];
  return refString.split(",").map((r) => {
    const trimmed = r.trim();
    if (trimmed.startsWith("HEAD -> ")) {
      return { name: trimmed.replace("HEAD -> ", ""), type: "head", current: true };
    }
    if (trimmed.startsWith("tag: ")) {
      return { name: trimmed.replace("tag: ", ""), type: "tag" };
    }
    if (trimmed.includes("/")) {
      return { name: trimmed, type: "remote" };
    }
    return { name: trimmed, type: "head" };
  });
}

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

/**
 * Given an array of unique YYYY-MM-DD date strings (sorted ascending),
 * returns the length of the longest run of consecutive calendar days.
 */
function computeLongestStreak(sortedUniqueDates: string[]): number {
  if (sortedUniqueDates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedUniqueDates.length; i++) {
    const prev = new Date(sortedUniqueDates[i - 1] + "T00:00:00Z");
    const curr = new Date(sortedUniqueDates[i] + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

/**
 * Given an array of unique YYYY-MM-DD date strings (sorted ascending),
 * returns how many consecutive days ending at today (UTC) have commits.
 */
function computeCurrentStreak(sortedUniqueDates: string[]): number {
  if (sortedUniqueDates.length === 0) return 0;
  const todayStr = new Date().toISOString().substring(0, 10);
  const dateSet = new Set(sortedUniqueDates);
  let streak = 0;
  const cursor = new Date(todayStr + "T00:00:00Z");
  while (dateSet.has(cursor.toISOString().substring(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Singleton
export const gitService = new GitService();
