import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GitService } from "../git/git-service";

/**
 * Register all Git Expansion tools on the given MCP server.
 * Tools are organized by domain: read-only first, then mutating.
 */
export function registerMcpTools(server: McpServer, git: GitService): void {
  // ── Read-only / informational tools ──────────────────────────────

  server.registerTool(
    "repo_info",
    {
      title: "Repository Info",
      description: "Get current repository info (branch, dirty state, HEAD commit)",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const info = await git.getRepoInfo();
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
  );

  server.registerTool(
    "status",
    {
      title: "Working Tree Status",
      description:
        "Get working tree status: staged, unstaged, untracked files and conflicts",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const status = await git.getStatus();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );

  server.registerTool(
    "log",
    {
      title: "Commit Log",
      description: "Get commit log with optional filtering",
      inputSchema: {
        maxCount: z.number().optional().describe("Maximum number of commits to return"),
        skip: z.number().optional().describe("Number of commits to skip"),
        branchFilter: z.string().optional().describe("Branch name to filter by"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ maxCount, skip, branchFilter }) => {
      const result = await git.getLog(maxCount, skip, branchFilter);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "commit_details",
    {
      title: "Commit Details",
      description: "Get details of a single commit by hash",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash }) => {
      const details = await git.getCommitDetails(hash);
      return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
    }
  );

  server.registerTool(
    "commit_full_info",
    {
      title: "Full Commit Info",
      description: "Get full commit info including branches/tags that contain it",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash }) => {
      const info = await git.getCommitFullInfo(hash);
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
  );

  server.registerTool(
    "diff_file",
    {
      title: "File Diff",
      description: "Get diff for a working tree file",
      inputSchema: {
        file: z.string().describe("File path relative to repo root"),
        staged: z.boolean().optional().describe("If true, show staged diff"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file, staged }) => {
      const diff = await git.getDiff(file, staged);
      return { content: [{ type: "text", text: diff }] };
    }
  );

  server.registerTool(
    "diff_staged",
    {
      title: "Staged Diff",
      description: "Get diff of all staged changes",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const diff = await git.getDiff(undefined, true);
      return { content: [{ type: "text", text: diff }] };
    }
  );

  server.registerTool(
    "diff_commit",
    {
      title: "Commit Diff",
      description: "Get full diff of a commit",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash }) => {
      const diff = await git.getCommitDiff(hash);
      return { content: [{ type: "text", text: diff }] };
    }
  );

  server.registerTool(
    "diff_commit_file",
    {
      title: "Commit File Diff",
      description: "Get diff of a specific file in a commit",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
        file: z.string().describe("File path"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash, file }) => {
      const diff = await git.getCommitFileDiff(hash, file);
      return { content: [{ type: "text", text: diff }] };
    }
  );

  server.registerTool(
    "diff_commit_files",
    {
      title: "Commit Files List",
      description: "List files changed in a commit with stats",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash }) => {
      const files = await git.getCommitFiles(hash);
      return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
    }
  );

  server.registerTool(
    "diff_range_files",
    {
      title: "Range Files",
      description: "List files changed between two commits",
      inputSchema: {
        hash1: z.string().describe("First commit hash"),
        hash2: z.string().describe("Second commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash1, hash2 }) => {
      const files = await git.getRangeFiles(hash1, hash2);
      return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
    }
  );

  server.registerTool(
    "diff_range_file",
    {
      title: "Range File Diff",
      description: "Get diff of one file between two commits",
      inputSchema: {
        hash1: z.string().describe("First commit hash"),
        hash2: z.string().describe("Second commit hash"),
        file: z.string().describe("File path"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash1, hash2, file }) => {
      const diff = await git.getRangeFileDiff(hash1, hash2, file);
      return { content: [{ type: "text", text: diff }] };
    }
  );

  server.registerTool(
    "branch_list",
    {
      title: "List Branches",
      description: "List all local and remote branches",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const branches = await git.getBranches();
      return { content: [{ type: "text", text: JSON.stringify(branches, null, 2) }] };
    }
  );

  server.registerTool(
    "tag_list",
    {
      title: "List Tags",
      description: "List all tags",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const tags = await git.getTags();
      return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
    }
  );

  server.registerTool(
    "remote_list",
    {
      title: "List Remotes",
      description: "List all remotes with fetch/push URLs",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const remotes = await git.getRemotes();
      return { content: [{ type: "text", text: JSON.stringify(remotes, null, 2) }] };
    }
  );

  server.registerTool(
    "stash_list",
    {
      title: "List Stashes",
      description: "List all stash entries",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const stashes = await git.getStashList();
      return { content: [{ type: "text", text: JSON.stringify(stashes, null, 2) }] };
    }
  );

  server.registerTool(
    "blame",
    {
      title: "Blame",
      description: "Get blame output for a file",
      inputSchema: {
        file: z.string().describe("File path relative to repo root"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file }) => {
      const result = await git.blame(file);
      return { content: [{ type: "text", text: result }] };
    }
  );

  server.registerTool(
    "show_file",
    {
      title: "Show File",
      description: "Get file content at a specific commit",
      inputSchema: {
        hash: z.string().describe("Commit hash (or HEAD, branch name)"),
        file: z.string().describe("File path relative to repo root"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash, file }) => {
      const content = await git.showFile(hash, file);
      return { content: [{ type: "text", text: content }] };
    }
  );

  server.registerTool(
    "conflict_list",
    {
      title: "List Conflicts",
      description: "List files with unresolved merge conflicts",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const files = await git.getConflictedFiles();
      return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
    }
  );

  server.registerTool(
    "conflict_file_content",
    {
      title: "Conflict File Content",
      description: "Get ours/theirs/base/merged content for a conflicted file",
      inputSchema: {
        file: z.string().describe("Conflicted file path"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file }) => {
      const content = await git.getConflictFileContent(file);
      return { content: [{ type: "text", text: JSON.stringify(content, null, 2) }] };
    }
  );

  server.registerTool(
    "is_rebase_in_progress",
    {
      title: "Rebase Status",
      description: "Check if a rebase is currently in progress",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const inProgress = await git.isRebaseInProgress();
      return { content: [{ type: "text", text: JSON.stringify({ inProgress }) }] };
    }
  );

  server.registerTool(
    "file_history",
    {
      title: "File History",
      description: "Get commit history for a specific file",
      inputSchema: {
        file: z.string().describe("File path relative to repo root"),
        maxCount: z.number().optional().describe("Maximum number of commits"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ file, maxCount }) => {
      const history = await git.getFileHistory(file, maxCount);
      return { content: [{ type: "text", text: JSON.stringify(history, null, 2) }] };
    }
  );

  server.registerTool(
    "tree_files",
    {
      title: "Tree Files",
      description: "List all files in a commit tree",
      inputSchema: {
        hash: z.string().describe("Commit hash"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ hash }) => {
      const files = await git.getTreeFiles(hash);
      return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
    }
  );

  server.registerTool(
    "config_list",
    {
      title: "Git Config",
      description: "List git configuration values",
      inputSchema: {
        global: z
          .boolean()
          .optional()
          .describe("If true, list global config instead of local"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ global }) => {
      const config = await git.listConfig(global);
      return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
    }
  );

  // ── Mutating tools ───────────────────────────────────────────────

  server.registerTool(
    "stage",
    {
      title: "Stage Files",
      description: "[MUTATING] Stage files for commit",
      inputSchema: {
        paths: z.array(z.string()).describe("File paths to stage"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ paths }) => {
      await git.stage(paths);
      return { content: [{ type: "text", text: `Staged ${paths.length} file(s)` }] };
    }
  );

  server.registerTool(
    "unstage",
    {
      title: "Unstage Files",
      description: "[MUTATING] Unstage files",
      inputSchema: {
        paths: z.array(z.string()).describe("File paths to unstage"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ paths }) => {
      await git.unstage(paths);
      return { content: [{ type: "text", text: `Unstaged ${paths.length} file(s)` }] };
    }
  );

  server.registerTool(
    "discard",
    {
      title: "Discard Changes",
      description: "[MUTATING] Discard working tree changes to files",
      inputSchema: {
        paths: z.array(z.string()).describe("File paths to discard changes for"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ paths }) => {
      await git.discard(paths);
      return {
        content: [{ type: "text", text: `Discarded changes in ${paths.length} file(s)` }],
      };
    }
  );

  server.registerTool(
    "commit",
    {
      title: "Create Commit",
      description: "[MUTATING] Create a new commit with staged changes",
      inputSchema: {
        message: z.string().describe("Commit message"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ message }) => {
      const hash = await git.commit(message);
      return { content: [{ type: "text", text: `Committed: ${hash}` }] };
    }
  );

  server.registerTool(
    "amend",
    {
      title: "Amend Commit",
      description: "[MUTATING] Amend the last commit",
      inputSchema: {
        message: z
          .string()
          .optional()
          .describe("New commit message (omit to keep original)"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ message }) => {
      const hash = await git.amend(message);
      return { content: [{ type: "text", text: `Amended: ${hash}` }] };
    }
  );

  server.registerTool(
    "branch_create",
    {
      title: "Create Branch",
      description: "[MUTATING] Create a new branch",
      inputSchema: {
        name: z.string().describe("Branch name"),
        startPoint: z
          .string()
          .optional()
          .describe("Starting commit/branch (default: HEAD)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, startPoint }) => {
      await git.createBranch(name, startPoint);
      return { content: [{ type: "text", text: `Branch '${name}' created` }] };
    }
  );

  server.registerTool(
    "branch_delete",
    {
      title: "Delete Branch",
      description: "[MUTATING] Delete a branch",
      inputSchema: {
        name: z.string().describe("Branch name to delete"),
        force: z.boolean().optional().describe("Force delete even if not fully merged"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ name, force }) => {
      await git.deleteBranch(name, force);
      return { content: [{ type: "text", text: `Branch '${name}' deleted` }] };
    }
  );

  server.registerTool(
    "branch_checkout",
    {
      title: "Checkout Branch",
      description: "[MUTATING] Checkout a branch or ref",
      inputSchema: {
        ref: z.string().describe("Branch name, tag, or commit hash to checkout"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ ref }) => {
      await git.checkout(ref);
      return { content: [{ type: "text", text: `Checked out '${ref}'` }] };
    }
  );

  server.registerTool(
    "merge",
    {
      title: "Merge Branch",
      description: "[MUTATING] Merge a branch into current branch",
      inputSchema: {
        branch: z.string().describe("Branch to merge"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ branch }) => {
      const result = await git.merge(branch);
      return { content: [{ type: "text", text: result }] };
    }
  );

  server.registerTool(
    "merge_with_options",
    {
      title: "Merge with Options",
      description: "[MUTATING] Merge with advanced options (ff strategy, squash, etc.)",
      inputSchema: {
        branch: z.string().describe("Branch to merge"),
        mergeStrategy: z
          .enum(["ff", "no-ff"])
          .optional()
          .describe("Fast-forward strategy"),
        noCommit: z.boolean().optional().describe("Do not auto-commit the merge"),
        squash: z.boolean().optional().describe("Squash commits"),
        allowUnrelatedHistories: z
          .boolean()
          .optional()
          .describe("Allow unrelated histories"),
        message: z.string().optional().describe("Custom merge commit message"),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      const result = await git.mergeWithOptions({
        branch: args.branch,
        mergeStrategy: args.mergeStrategy || "ff",
        noCommit: args.noCommit,
        squash: args.squash,
        allowUnrelatedHistories: args.allowUnrelatedHistories,
        message: args.message,
      });
      return { content: [{ type: "text", text: result }] };
    }
  );

  server.registerTool(
    "rebase",
    {
      title: "Rebase",
      description: "[MUTATING] Rebase current branch onto another",
      inputSchema: {
        onto: z.string().describe("Branch or commit to rebase onto"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ onto }) => {
      await git.rebase(onto);
      return { content: [{ type: "text", text: `Rebased onto '${onto}'` }] };
    }
  );

  server.registerTool(
    "rebase_continue",
    {
      title: "Continue Rebase",
      description: "[MUTATING] Continue an in-progress rebase after resolving conflicts",
      annotations: { readOnlyHint: false },
    },
    async () => {
      await git.rebaseContinue();
      return { content: [{ type: "text", text: "Rebase continued" }] };
    }
  );

  server.registerTool(
    "rebase_abort",
    {
      title: "Abort Rebase",
      description: "[MUTATING] Abort an in-progress rebase",
      annotations: { destructiveHint: true },
    },
    async () => {
      await git.rebaseAbort();
      return { content: [{ type: "text", text: "Rebase aborted" }] };
    }
  );

  server.registerTool(
    "cherry_pick",
    {
      title: "Cherry Pick",
      description: "[MUTATING] Cherry-pick a commit onto current branch",
      inputSchema: {
        hash: z.string().describe("Commit hash to cherry-pick"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ hash }) => {
      await git.cherryPick(hash);
      return { content: [{ type: "text", text: `Cherry-picked ${hash}` }] };
    }
  );

  server.registerTool(
    "reset",
    {
      title: "Reset HEAD",
      description: "[MUTATING] Reset HEAD to a commit (soft, mixed, or hard)",
      inputSchema: {
        hash: z.string().describe("Commit hash to reset to"),
        mode: z.enum(["soft", "mixed", "hard"]).describe("Reset mode"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ hash, mode }) => {
      await git.resetToCommit(hash, mode);
      return { content: [{ type: "text", text: `Reset to ${hash} (${mode})` }] };
    }
  );

  server.registerTool(
    "stash_create",
    {
      title: "Create Stash",
      description: "[MUTATING] Stash working tree changes",
      inputSchema: {
        message: z.string().optional().describe("Stash message"),
        keepIndex: z.boolean().optional().describe("Keep staged changes"),
        includeUntracked: z.boolean().optional().describe("Include untracked files"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ message, keepIndex, includeUntracked }) => {
      await git.stashCreate(message, { keepIndex, includeUntracked });
      return { content: [{ type: "text", text: "Stash created" }] };
    }
  );

  server.registerTool(
    "stash_pop",
    {
      title: "Pop Stash",
      description: "[MUTATING] Pop a stash entry and apply it",
      inputSchema: {
        index: z.number().optional().describe("Stash index (default: 0)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ index }) => {
      await git.stashPop(index);
      return { content: [{ type: "text", text: `Stash@{${index ?? 0}} popped` }] };
    }
  );

  server.registerTool(
    "stash_apply",
    {
      title: "Apply Stash",
      description: "[MUTATING] Apply a stash entry without removing it",
      inputSchema: {
        index: z.number().optional().describe("Stash index (default: 0)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ index }) => {
      await git.stashApply(index);
      return { content: [{ type: "text", text: `Stash@{${index ?? 0}} applied` }] };
    }
  );

  server.registerTool(
    "stash_drop",
    {
      title: "Drop Stash",
      description: "[MUTATING] Drop a stash entry",
      inputSchema: {
        index: z.number().optional().describe("Stash index (default: 0)"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ index }) => {
      await git.stashDrop(index);
      return { content: [{ type: "text", text: `Stash@{${index ?? 0}} dropped` }] };
    }
  );

  server.registerTool(
    "tag_create",
    {
      title: "Create Tag",
      description: "[MUTATING] Create a new tag",
      inputSchema: {
        name: z.string().describe("Tag name"),
        commitHash: z.string().describe("Commit to tag"),
        message: z.string().optional().describe("Tag annotation message"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, commitHash, message }) => {
      await git.createTag(name, commitHash, message);
      return { content: [{ type: "text", text: `Tag '${name}' created` }] };
    }
  );

  server.registerTool(
    "tag_delete",
    {
      title: "Delete Tag",
      description: "[MUTATING] Delete a tag",
      inputSchema: {
        name: z.string().describe("Tag name"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ name }) => {
      await git.deleteTag(name);
      return { content: [{ type: "text", text: `Tag '${name}' deleted` }] };
    }
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch",
      description: "[MUTATING] Fetch from remote",
      inputSchema: {
        remote: z.string().optional().describe("Remote name (default: origin)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ remote }) => {
      await git.fetch(remote);
      return {
        content: [{ type: "text", text: `Fetched from ${remote || "default remote"}` }],
      };
    }
  );

  server.registerTool(
    "pull",
    {
      title: "Pull",
      description: "[MUTATING] Pull from remote",
      inputSchema: {
        remote: z.string().optional().describe("Remote name"),
        branch: z.string().optional().describe("Branch name"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ remote, branch }) => {
      await git.pull(remote, branch);
      return { content: [{ type: "text", text: "Pulled successfully" }] };
    }
  );

  server.registerTool(
    "push",
    {
      title: "Push",
      description: "[MUTATING] Push to remote",
      inputSchema: {
        remote: z.string().optional().describe("Remote name"),
        branch: z.string().optional().describe("Branch name"),
        force: z.boolean().optional().describe("Force push"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ remote, branch, force }) => {
      await git.push(remote, branch, force);
      return { content: [{ type: "text", text: "Pushed successfully" }] };
    }
  );

  server.registerTool(
    "conflict_resolve",
    {
      title: "Resolve Conflict",
      description: "[MUTATING] Mark a conflicted file as resolved",
      inputSchema: {
        file: z.string().describe("File path to mark as resolved"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ file }) => {
      await git.resolveConflict(file);
      return { content: [{ type: "text", text: `Conflict resolved: ${file}` }] };
    }
  );

  server.registerTool(
    "conflict_save_merged",
    {
      title: "Save Merged File",
      description: "[MUTATING] Save merged content for a conflicted file",
      inputSchema: {
        file: z.string().describe("File path"),
        content: z.string().describe("Merged file content"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ file, content }) => {
      await git.saveMergedFile(file, content);
      return { content: [{ type: "text", text: `Merged content saved: ${file}` }] };
    }
  );

  server.registerTool(
    "config_set",
    {
      title: "Set Git Config",
      description: "[MUTATING] Set a git configuration value",
      inputSchema: {
        key: z.string().describe("Config key (e.g. user.name)"),
        value: z.string().describe("Config value"),
        global: z.boolean().optional().describe("Set globally instead of locally"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ key, value, global }) => {
      await git.setConfig(key, value, global);
      return { content: [{ type: "text", text: `Config set: ${key} = ${value}` }] };
    }
  );
}
