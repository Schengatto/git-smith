import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GitService } from "../git/git-service";
import { registerMcpTools } from "./mcp-tools";

let mcpServer: McpServer | null = null;
let mcpGitService: GitService | null = null;

/**
 * Start the MCP server for the given repository.
 * Uses stdio transport (stdin/stdout) as per MCP standard.
 * Creates its own GitService instance to avoid concurrency issues with the UI.
 */
export async function startMcpServer(repoPath: string): Promise<void> {
  if (mcpServer) {
    throw new Error("MCP server is already running");
  }

  mcpGitService = new GitService();
  await mcpGitService.openRepo(repoPath);

  mcpServer = new McpServer(
    { name: "gitsmith", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );

  registerMcpTools(mcpServer, mcpGitService);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error("[gitsmith-mcp] Server started for repo:", repoPath);
}

/** Stop the MCP server and clean up resources. */
export async function stopMcpServer(): Promise<void> {
  if (mcpServer) {
    await mcpServer.close();
    mcpServer = null;
  }
  if (mcpGitService) {
    mcpGitService.closeRepo();
    mcpGitService = null;
  }
  console.error("[gitsmith-mcp] Server stopped");
}

/** Check if the MCP server is currently running. */
export function isMcpServerRunning(): boolean {
  return mcpServer !== null;
}

/** Get the repo path the MCP server is serving. */
export function getMcpServerRepoPath(): string | null {
  return mcpGitService?.getRepoPath() ?? null;
}
