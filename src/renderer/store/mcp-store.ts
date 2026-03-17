import { create } from "zustand";

interface McpState {
  // AI generation state
  generating: boolean;
  lastCommitSuggestion: string | null;
  lastConflictSuggestion: string | null;
  lastReview: string | null;
  lastPrDescription: string | null;
  error: string | null;

  // MCP server state
  serverRunning: boolean;
  serverRepoPath: string | null;

  // Actions
  generateCommitMessage: () => Promise<string>;
  suggestConflictResolution: (filePath: string) => Promise<string>;
  generatePrDescription: (commitHashes: string[]) => Promise<string>;
  reviewCommit: (hash: string) => Promise<string>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  refreshServerStatus: () => Promise<void>;
  clearError: () => void;
}

export const useMcpStore = create<McpState>((set) => ({
  generating: false,
  lastCommitSuggestion: null,
  lastConflictSuggestion: null,
  lastReview: null,
  lastPrDescription: null,
  error: null,
  serverRunning: false,
  serverRepoPath: null,

  generateCommitMessage: async () => {
    set({ generating: true, error: null });
    try {
      const result = await window.electronAPI.mcp.generateCommitMessage();
      set({ generating: false, lastCommitSuggestion: result });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ generating: false, error: msg });
      throw err;
    }
  },

  suggestConflictResolution: async (filePath: string) => {
    set({ generating: true, error: null });
    try {
      const result = await window.electronAPI.mcp.suggestConflictResolution(filePath);
      set({ generating: false, lastConflictSuggestion: result });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ generating: false, error: msg });
      throw err;
    }
  },

  generatePrDescription: async (commitHashes: string[]) => {
    set({ generating: true, error: null });
    try {
      const result = await window.electronAPI.mcp.generatePrDescription(commitHashes);
      set({ generating: false, lastPrDescription: result });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ generating: false, error: msg });
      throw err;
    }
  },

  reviewCommit: async (hash: string) => {
    set({ generating: true, error: null });
    try {
      const result = await window.electronAPI.mcp.reviewCommit(hash);
      set({ generating: false, lastReview: result });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ generating: false, error: msg });
      throw err;
    }
  },

  startServer: async () => {
    try {
      await window.electronAPI.mcp.serverStart();
      set({ serverRunning: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  stopServer: async () => {
    try {
      await window.electronAPI.mcp.serverStop();
      set({ serverRunning: false, serverRepoPath: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  refreshServerStatus: async () => {
    try {
      const status = await window.electronAPI.mcp.serverStatus();
      set({ serverRunning: status.running, serverRepoPath: status.repoPath });
    } catch {
      // ignore
    }
  },

  clearError: () => set({ error: null }),
}));
