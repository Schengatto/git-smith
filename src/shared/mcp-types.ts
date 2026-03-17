// MCP-related types shared between main process and renderer

/** AI provider options for the MCP client */
export type AiProvider = "none" | "anthropic" | "openai" | "custom-mcp";

/** Configuration for an external MCP server */
export interface McpExternalServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** AI / MCP settings stored in AppSettings */
export interface AiSettings {
  aiProvider: AiProvider;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  mcpServerEnabled: boolean;
  mcpExternalServers: McpExternalServer[];
}

export const defaultAiSettings: AiSettings = {
  aiProvider: "none",
  aiApiKey: "",
  aiModel: "",
  aiBaseUrl: "",
  mcpServerEnabled: false,
  mcpExternalServers: [],
};

/** Result returned by AI generation operations */
export interface AiGenerationResult {
  text: string;
  provider: AiProvider;
  model: string;
}

/** MCP server status */
export interface McpServerStatus {
  running: boolean;
  repoPath: string | null;
}
