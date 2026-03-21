/**
 * Standalone MCP server entry point.
 * Run inside Electron with: electron . --mcp-server /path/to/repo
 * Or directly: node mcp-entry.js --repo /path/to/repo
 *
 * This file bootstraps the MCP server without creating any UI.
 * It uses stdio transport for MCP communication.
 */
import { startMcpServer } from "./mcp-server";

function getRepoArg(): string {
  // Support both --repo /path and positional after --mcp-server
  const args = process.argv.slice(2);
  const repoIdx = args.indexOf("--repo");
  if (repoIdx !== -1 && args[repoIdx + 1]) {
    return args[repoIdx + 1]!;
  }
  // Fallback: first non-flag argument
  for (const arg of args) {
    if (!arg.startsWith("--")) return arg;
  }
  return process.cwd();
}

const repoPath = getRepoArg();

startMcpServer(repoPath).catch((err) => {
  console.error(`[git-expansion-mcp] Failed to start: ${err.message}`);
  process.exit(1);
});
