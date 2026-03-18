import { registerRepoHandlers } from "./repo.ipc";
import { registerStatusHandlers } from "./git-status.ipc";
import { registerCommitHandlers } from "./git-commit.ipc";
import { registerLogHandlers } from "./git-log.ipc";
import { registerBranchHandlers } from "./git-branch.ipc";
import { registerRemoteHandlers } from "./git-remote.ipc";
import { registerDiffHandlers } from "./git-diff.ipc";
import { registerStashHandlers } from "./git-stash.ipc";
import { registerBlameHandlers } from "./git-blame.ipc";
import { registerShellHandlers } from "./shell.ipc";
import { registerGitignoreHandlers } from "./git-gitignore.ipc";
import { registerConflictHandlers } from "./git-conflict.ipc";
import { registerOperationHandlers } from "./git-operation.ipc";
import { registerTerminalHandlers } from "./terminal.ipc";
import { registerMcpHandlers } from "./mcp.ipc";
import { registerAccountHandlers } from "./git-account.ipc";
import { registerDialogHandlers } from "./dialog.ipc";
import { registerStatsHandlers } from "./stats.ipc";

export function registerAllHandlers() {
  registerRepoHandlers();
  registerStatusHandlers();
  registerCommitHandlers();
  registerLogHandlers();
  registerBranchHandlers();
  registerRemoteHandlers();
  registerDiffHandlers();
  registerStashHandlers();
  registerBlameHandlers();
  registerShellHandlers();
  registerGitignoreHandlers();
  registerConflictHandlers();
  registerOperationHandlers();
  registerTerminalHandlers();
  registerMcpHandlers();
  registerAccountHandlers();
  registerDialogHandlers();
  registerStatsHandlers();
}
