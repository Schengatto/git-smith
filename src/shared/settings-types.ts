export interface AppSettings {
  // General
  theme: "dark" | "light";
  language: string;
  // Fetch
  autoFetchEnabled: boolean;
  autoFetchInterval: number; // seconds
  fetchPruneOnAuto: boolean;
  // Commit
  defaultCommitTemplate: string;
  signCommits: boolean;
  // Diff
  diffContextLines: number;
  preferSideBySideDiff: boolean;
  // Graph
  graphMaxInitialLoad: number;
  showRemoteBranchesInGraph: boolean;
  // Merge Tool
  mergeToolName: string; // preset name or "custom"
  mergeToolPath: string; // executable path
  mergeToolArgs: string; // argument pattern with $BASE $LOCAL $REMOTE $MERGED placeholders
  // Advanced
  maxConcurrentGitProcesses: number;
  gitBinaryPath: string; // custom git binary path, empty = use system PATH
  // AI / MCP
  aiProvider: "none" | "anthropic" | "openai" | "gemini" | "custom-mcp";
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  mcpServerEnabled: boolean;
}
