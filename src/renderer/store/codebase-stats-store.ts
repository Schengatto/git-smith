import { create } from "zustand";
import type { CodebaseStats } from "../../shared/codebase-stats-types";

interface CodebaseStatsState {
  stats: CodebaseStats | null;
  loading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  stats: null as CodebaseStats | null,
  loading: false,
  error: null as string | null,
};

export const useCodebaseStatsStore = create<CodebaseStatsState>((set) => ({
  ...initialState,

  loadStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await window.electronAPI.stats.getCodebaseStats();
      set({ stats, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
