import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { McpAiClient } from "../mcp/mcp-client";
import {
  startMcpServer,
  stopMcpServer,
  isMcpServerRunning,
  getMcpServerRepoPath,
} from "../mcp/mcp-server";

const aiClient = new McpAiClient();

export function registerMcpHandlers() {
  // ── MCP Server management ──────────────────────────────────────

  ipcMain.handle(IPC.MCP.SERVER_START, async () => {
    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository is open");
    await startMcpServer(repoPath);
  });

  ipcMain.handle(IPC.MCP.SERVER_STOP, async () => {
    await stopMcpServer();
  });

  ipcMain.handle(IPC.MCP.SERVER_STATUS, () => ({
    running: isMcpServerRunning(),
    repoPath: getMcpServerRepoPath(),
  }));

  // ── AI operations ──────────────────────────────────────────────

  ipcMain.handle(IPC.MCP.GENERATE_COMMIT_MESSAGE, async () => {
    const diff = await gitService.getDiff(undefined, true);
    const status = await gitService.getStatus();
    return aiClient.generateCommitMessage(diff, status);
  });

  ipcMain.handle(
    IPC.MCP.SUGGEST_CONFLICT_RESOLUTION,
    async (_event, filePath: string) => {
      const content = await gitService.getConflictFileContent(filePath);
      return aiClient.suggestConflictResolution(
        content.ours,
        content.theirs,
        content.base,
        filePath
      );
    }
  );

  ipcMain.handle(
    IPC.MCP.GENERATE_PR_DESCRIPTION,
    async (_event, commitHashes: string[]) => {
      const commits = await Promise.all(
        commitHashes.map((h) => gitService.getCommitDetails(h))
      );
      // Get diff of all commits combined
      const firstHash = commitHashes[commitHashes.length - 1]!;
      const lastHash = commitHashes[0]!;
      const diff =
        commitHashes.length === 1
          ? await gitService.getCommitDiff(firstHash)
          : await gitService.getRangeFileDiff(
              `${firstHash}~1`,
              lastHash,
              ""
            ).catch(() => "");
      return aiClient.generatePrDescription(commits, diff);
    }
  );

  ipcMain.handle(
    IPC.MCP.REVIEW_COMMIT,
    async (_event, hash: string) => {
      const diff = await gitService.getCommitDiff(hash);
      const files = await gitService.getCommitFiles(hash);
      return aiClient.reviewCommit(hash, diff, files);
    }
  );
}
