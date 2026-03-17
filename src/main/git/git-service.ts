import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import { BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { IPC } from "../../shared/ipc-channels";
import type {
  CommandLogEntry,
  CommandOutputLine,
  RepoInfo,
  GitStatus,
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
} from "../../shared/git-types";

let idCounter = 0;
function nextId(): string {
  return `cmd-${Date.now()}-${++idCounter}`;
}

export class GitService {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

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

  /** ID of the currently running command (for associating output handler lines) */
  private _currentRunId: string | null = null;

  private setupOutputHandler() {
    if (!this.git) return;
    this.git.outputHandler((_command, stdout, stderr) => {
      const bindStream = (stream: NodeJS.ReadableStream, name: "stdout" | "stderr") => {
        stream.on("data", (data: Buffer) => {
          const id = this._currentRunId;
          if (!id) return;
          const text = data.toString("utf-8");
          // Split into lines and emit each non-empty line
          for (const line of text.split(/\r?\n/)) {
            if (line.length > 0) {
              this.emitCommandOutput({ id, stream: name, text: line });
            }
          }
        });
      };
      bindStream(stdout, "stdout");
      bindStream(stderr, "stderr");
    });
  }

  private async run<T>(
    description: string,
    args: string[],
    fn: () => Promise<T>
  ): Promise<T> {
    const entry = this.logCommand(description, args);
    this._currentRunId = entry.id;
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
      this._currentRunId = null;
    }
  }

  async openRepo(path: string): Promise<RepoInfo> {
    const options: Partial<SimpleGitOptions> = {
      baseDir: path,
      binary: "git",
      maxConcurrentProcesses: 6,
    };
    this.git = simpleGit(options);
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
    const options: Partial<SimpleGitOptions> = {
      baseDir: dirPath,
      binary: "git",
      maxConcurrentProcesses: 6,
    };
    const git = simpleGit(options);
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

      return {
        staged,
        unstaged,
        untracked: status.not_added,
      };
    });
  }

  async stage(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git add", paths, () => git.add(paths));
  }

  async unstage(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git reset HEAD", paths, () =>
      git.reset(["HEAD", "--", ...paths])
    );
  }

  async stageLines(patch: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git apply", ["--cached"], async () => {
      const tmpFile = path.join(this.repoPath!, ".git", "tmp-patch.diff");
      fs.writeFileSync(tmpFile, patch);
      try {
        await git.applyPatch(tmpFile, ["--cached"]);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
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
        try { fs.unlinkSync(tmpFile); } catch {}
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
            b.startsWith("remotes/")
              ? `--exclude=refs/${b}`
              : `--exclude=refs/heads/${b}`
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
          "%H",    // 0  hash
          "%h",    // 1  abbreviated hash
          "%s",    // 2  subject
          "%an",   // 3  author name
          "%ae",   // 4  author email
          "%aI",   // 5  author date ISO
          "%cI",   // 6  committer date ISO
          "%P",    // 7  parent hashes
          "%D",    // 8  ref names
          "%B",    // 9  full message (subject+body) — MUST be last
        ].join(FIELD_SEP);

        const result = await git.raw([
          "log",
          ...refArgs,
          "--topo-order",
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
              gravatarHash: email ? crypto.createHash("md5").update(email).digest("hex") : undefined,
            };
          });
      }
    );
  }

  async getCommitDetails(hash: string): Promise<CommitInfo> {
    const git = this.ensureRepo();
    return this.run("git show", [hash, "--format=..."], async () => {
      const format = [
        "%H", "%h", "%s", "%b", "%an", "%ae", "%aI", "%cI", "%P", "%D",
      ].join("%x00");

      const result = await git.raw([
        "show",
        hash,
        `--format=${format}`,
        "--no-patch",
      ]);

      const parts = result.trim().split("\0");
      const detailEmail = (parts[5] || "").trim().toLowerCase();
      return {
        hash: parts[0],
        abbreviatedHash: parts[1],
        subject: parts[2],
        body: parts[3],
        authorName: parts[4],
        authorEmail: parts[5],
        authorDate: parts[6],
        committerDate: parts[7],
        parentHashes: parts[8] ? parts[8].split(" ") : [],
        refs: parseRefs(parts[9] || ""),
        gravatarHash: detailEmail ? crypto.createHash("md5").update(detailEmail).digest("hex") : undefined,
      };
    });
  }

  async getCommitFullInfo(hash: string): Promise<CommitFullInfo> {
    const git = this.ensureRepo();
    return this.run("git show / branch --contains / tag --contains", [hash], async () => {
      // Get commit details including committer info
      const FIELD_SEP = "%x00";
      const format = [
        "%H", "%h", "%s", "%b", "%an", "%ae", "%aI", "%cn", "%ce", "%cI", "%P", "%D",
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
      } catch { /* no children */ }

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
      } catch { /* empty */ }

      // Get tags containing this commit
      let containedInTags: string[] = [];
      try {
        const tagResult = await git.raw(["tag", "--contains", hash]);
        containedInTags = tagResult.trim().split("\n").filter(Boolean).map((t) => t.trim());
      } catch { /* empty */ }

      // Get nearest ancestor tag
      let derivesFromTag = "";
      try {
        derivesFromTag = (await git.raw(["describe", "--tags", "--abbrev=0", hash])).trim();
      } catch { /* no tag */ }

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
        if (aheadMatch) ahead = parseInt(aheadMatch[1]);
        if (behindMatch) behind = parseInt(behindMatch[1]);

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
    await this.run("git branch", [flag, name], () =>
      git.branch([flag, name])
    );
  }

  async deleteRemoteBranch(remote: string, branch: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git push", [remote, "--delete", branch], () =>
      git.raw(["push", remote, "--delete", branch])
    );
  }

  async checkout(ref: string): Promise<void> {
    const git = this.ensureRepo();
    // Remote tracking refs (remotes/origin/feature) cause detached HEAD.
    // Strip the remote prefix so git DWIM creates/switches to a local tracking branch.
    const checkoutRef = ref.startsWith("remotes/")
      ? ref.replace(/^remotes\/[^/]+\//, "")
      : ref;
    await this.run("git checkout", [checkoutRef], () => git.checkout(checkoutRef));
  }

  async checkoutWithOptions(ref: string, options: { merge?: boolean }): Promise<void> {
    const git = this.ensureRepo();
    const checkoutRef = ref.startsWith("remotes/")
      ? ref.replace(/^remotes\/[^/]+\//, "")
      : ref;
    const args = [checkoutRef];
    if (options.merge) args.push("--merge");
    await this.run("git checkout", args, () => git.raw(["checkout", ...args]));
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

  async mergeWithOptions(options: import("../../shared/git-types").MergeOptions): Promise<string> {
    const git = this.ensureRepo();
    const args: string[] = [];

    if (options.mergeStrategy === "no-ff") args.push("--no-ff");
    if (options.noCommit) args.push("--no-commit");
    if (options.squash) args.push("--squash");
    if (options.allowUnrelatedHistories) args.push("--allow-unrelated-histories");
    if (options.log != null && options.log > 0) args.push(`--log=${options.log}`);
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
      const todoContent = options.todoEntries
        .map((e) => `${e.action} ${e.hash}`)
        .join("\n") + "\n";

      const todoPath = path.join(this.repoPath!, ".git", "rebase-todo-custom.txt");
      fs.writeFileSync(todoPath, todoContent);

      const editorScript = path.join(this.repoPath!, ".git", "rebase-editor.sh");
      fs.writeFileSync(
        editorScript,
        `#!/bin/sh\ncp "${todoPath}" "$1"\n`,
        { mode: 0o755 }
      );

      await this.run("git rebase", args, async () => {
        try {
          await git.env("GIT_SEQUENCE_EDITOR", editorScript).rebase(args);
        } finally {
          try { fs.unlinkSync(todoPath); } catch {}
          try { fs.unlinkSync(editorScript); } catch {}
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

  async resetToCommit(hash: string, mode: "soft" | "mixed" | "hard"): Promise<void> {
    const git = this.ensureRepo();
    const flag = `--${mode}`;
    await this.run("git reset", [flag, hash], () =>
      git.reset([flag, hash])
    );
  }

  async cherryPick(hash: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git cherry-pick", [hash], () =>
      git.raw(["cherry-pick", hash])
    );
  }

  async getTags(): Promise<TagInfo[]> {
    const git = this.ensureRepo();
    return this.run("git tag", ["-l"], async () => {
      const result = await git.tags();
      return result.all.map((name) => ({ name, hash: "" }));
    });
  }

  async createTag(
    name: string,
    commitHash: string,
    message?: string
  ): Promise<void> {
    const git = this.ensureRepo();
    if (message) {
      await this.run("git tag", ["-a", name, commitHash, "-m", message], () =>
        git.tag(["-a", name, commitHash, "-m", message])
      );
    } else {
      await this.run("git tag", [name, commitHash], () =>
        git.tag([name, commitHash])
      );
    }
  }

  async deleteTag(name: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git tag", ["-d", name], () => git.tag(["-d", name]));
  }

  async pushTag(name: string, remote = "origin"): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git push", [remote, name], () =>
      git.push(remote, name)
    );
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

  async stashCreate(message?: string, options?: { keepIndex?: boolean; includeUntracked?: boolean; staged?: boolean }): Promise<void> {
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
    return this.run("git blame", [file], () =>
      git.raw(["blame", "--porcelain", file])
    );
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
      const format = [
        "%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D",
      ].join(FIELD_SEP);

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
    const todoContent = todoEntries
      .map((e) => `${e.action} ${e.hash}`)
      .join("\n") + "\n";

    // Write todo to a temp file
    const todoPath = path.join(this.repoPath!, ".git", "rebase-todo-custom.txt");
    fs.writeFileSync(todoPath, todoContent);

    // Create a script that copies our todo over the default one
    const editorScript = path.join(this.repoPath!, ".git", "rebase-editor.sh");
    // The editor receives the todo file path as $1
    fs.writeFileSync(
      editorScript,
      `#!/bin/sh\ncp "${todoPath}" "$1"\n`,
      { mode: 0o755 }
    );

    await this.run(
      "git rebase",
      ["-i", onto],
      async () => {
        try {
          await git.env("GIT_SEQUENCE_EDITOR", editorScript).rebase(["-i", onto]);
        } finally {
          // Cleanup temp files
          try { fs.unlinkSync(todoPath); } catch {}
          try { fs.unlinkSync(editorScript); } catch {}
        }
      }
    );
  }

  async rebaseContinue(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", ["--continue"], () =>
      git.rebase(["--continue"])
    );
  }

  async rebaseSkip(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git rebase", ["--skip"], () =>
      git.rebase(["--skip"])
    );
  }

  async isRebaseInProgress(): Promise<boolean> {
    if (!this.repoPath) return false;
    return (
      fs.existsSync(path.join(this.repoPath, ".git", "rebase-merge")) ||
      fs.existsSync(path.join(this.repoPath, ".git", "rebase-apply"))
    );
  }

  // ─── Conflict resolution ───────────────────────────

  async getConflictedFiles(): Promise<import("../../shared/git-types").ConflictFile[]> {
    const git = this.ensureRepo();
    // git diff --name-only --diff-filter=U lists unmerged files
    const raw = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
    if (!raw.trim()) return [];

    const files: import("../../shared/git-types").ConflictFile[] = [];
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

  async getConflictFileContent(
    filePath: string
  ): Promise<import("../../shared/git-types").ConflictFileContent> {
    const git = this.ensureRepo();

    // Read the three versions using git show :<stage>:<path>
    // Stage 1 = base, Stage 2 = ours, Stage 3 = theirs
    let base: string | null = null;
    let ours: string | null = null;
    let theirs: string | null = null;

    try { base = await git.raw(["show", `:1:${filePath}`]); } catch { base = null; }
    try { ours = await git.raw(["show", `:2:${filePath}`]); } catch { ours = null; }
    try { theirs = await git.raw(["show", `:3:${filePath}`]); } catch { theirs = null; }

    // Read the current working tree file with conflict markers
    let merged = "";
    try {
      const fullPath = path.join(this.repoPath!, filePath);
      merged = fs.readFileSync(fullPath, "utf-8");
    } catch { merged = ""; }

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

    const repoPath = this.repoPath!;
    const content = await this.getConflictFileContent(filePath);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-expansion-merge-"));

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
    const args = resolvedArgs.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"|"$/g, "")) || [];

    return new Promise((resolve) => {
      const proc = spawn(toolPath, args, { stdio: "ignore" });
      proc.on("error", () => {
        cleanup();
        resolve({ exitCode: -1, mergedContent: "" });
      });
      proc.on("close", (code) => {
        let mergedContent = "";
        try { mergedContent = fs.readFileSync(mergedPath, "utf-8"); } catch { /* file may not exist */ }
        cleanup();
        resolve({ exitCode: code ?? -1, mergedContent });
      });

      function cleanup() {
        try { fs.unlinkSync(basePath); } catch { /* ignore */ }
        try { fs.unlinkSync(localPath); } catch { /* ignore */ }
        try { fs.unlinkSync(remotePath); } catch { /* ignore */ }
        try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
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
    await this.run("git config", args, () =>
      git.raw(["config", ...args])
    );
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

  async addSubmodule(url: string, path?: string): Promise<void> {
    const git = this.ensureRepo();
    const args = ["add", url];
    if (path) args.push(path);
    await this.run("git submodule", args, () =>
      git.raw(["submodule", ...args])
    );
  }

  async submoduleUpdate(init = false): Promise<void> {
    const git = this.ensureRepo();
    const args = init ? ["update", "--init", "--recursive"] : ["update", "--recursive"];
    await this.run("git submodule", args, () =>
      git.raw(["submodule", ...args])
    );
  }

  async getFileHistory(
    file: string,
    maxCount = 100
  ): Promise<CommitInfo[]> {
    const git = this.ensureRepo();
    return this.run("git log", ["--follow", file], async () => {
      const RECORD_SEP = "%x1e";
      const FIELD_SEP = "%x00";
      const format = [
        "%H", "%h", "%s", "%an", "%ae", "%aI", "%cI", "%P", "%D",
      ].join(FIELD_SEP);

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
    await this.run("git remote add", [name, url], () =>
      git.addRemote(name, url)
    );
  }

  async removeRemote(name: string): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git remote remove", [name], () =>
      git.removeRemote(name)
    );
  }

  async clone(
    url: string,
    directory: string,
    options?: {
      branch?: string;
      bare?: boolean;
      recurseSubmodules?: boolean;
      shallow?: boolean;
    }
  ): Promise<void> {
    const git = simpleGit();
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
    await this.run("git clone", [url, directory, ...args], () =>
      git.clone(url, directory, args)
    );
  }

  async listRemoteBranches(url: string): Promise<string[]> {
    const git = simpleGit();
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
    await this.run("git fetch", args, () =>
      remote ? git.fetch(remote) : git.fetch()
    );
  }

  async fetchAll(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git fetch", ["--all"], () => git.fetch(["--all"]));
  }

  async fetchPrune(): Promise<void> {
    const git = this.ensureRepo();
    await this.run("git fetch", ["--all", "--prune"], () =>
      git.fetch(["--all", "--prune"])
    );
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

  async getDiff(
    file?: string,
    staged = false
  ): Promise<string> {
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
        const statusChar = parts[0][0];
        const filePath = parts[parts.length - 1];
        statusMap.set(filePath, statusChar);
      }

      return result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("\t");
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
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

        const commitDate = new Date(dateStr);
        if (commitDate >= cutoff) continue;

        // Split "origin/branch-name" into remote and branch
        const slashIdx = fullName.indexOf("/");
        const remote = fullName.substring(0, slashIdx);
        const branchName = fullName.substring(slashIdx + 1);

        results.push({
          name: fullName,
          remote,
          branchName,
          lastCommitHash: hash,
          lastCommitDate: dateStr,
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
      const format = [
        "%H", "%h", "%s", "%b", "%an", "%ae", "%aI", "%cI", "%P", "%D",
      ].join("%x00");
      const raw = await git.raw([
        "log", remoteBranch, `--max-count=${maxCount}`,
        `--format=${format}`,
      ]);
      if (!raw.trim()) return [];
      return raw.trim().split("\n").map((line) => {
        const parts = line.split("\x00");
        return {
          hash: parts[0],
          abbreviatedHash: parts[1],
          subject: parts[2],
          body: parts[3],
          authorName: parts[4],
          authorEmail: parts[5],
          authorDate: parts[6],
          committerDate: parts[7],
          parentHashes: parts[8] ? parts[8].split(" ") : [],
          refs: parseRefs(parts[9] || ""),
        };
      });
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
          git.raw(["show", `${hash}:${file}`]).then((content) =>
            `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split("\n").length} @@\n` +
            content.split("\n").map((l) => `+${l}`).join("\n")
          )
        );
      }
    });
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

// Singleton
export const gitService = new GitService();
