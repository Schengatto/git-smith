export interface CommitTemplate {
  name: string;
  prefix: string;
  body: string;
  description: string;
}

export interface CommitSnippet {
  label: string;
  text: string;
}

export interface NotificationSettings {
  enabled: boolean;
  onFetch: boolean;
  onPush: boolean;
  onError: boolean;
}

export interface IssueTrackerConfig {
  provider: "github" | "gitlab" | "jira" | "custom";
  pattern: string;
  urlTemplate: string;
}

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
  commitTemplates: CommitTemplate[];
  commitSnippets: CommitSnippet[];
  notifications: NotificationSettings;
  issueTracker: IssueTrackerConfig;
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
  // Editor Integration
  editorName: string; // preset name or "custom"
  editorPath: string; // executable name (preset) or absolute path (custom)
  editorArgs: string; // argument pattern, $FILE placeholder
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
