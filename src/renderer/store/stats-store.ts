import { create } from "zustand";
import type { LeaderboardEntry, AuthorDetail, Timeframe } from "../../shared/stats-types";

interface StatsState {
  leaderboard: LeaderboardEntry[];
  selectedAuthor: AuthorDetail | null;
  selectedEmail: string | null;
  timeframe: Timeframe;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  detailError: string | null;
  sortField: "commits" | "linesAdded" | "linesRemoved" | "longestStreak";
  sortDirection: "asc" | "desc";

  loadLeaderboard: (timeframe: Timeframe) => Promise<void>;
  loadAuthorDetail: (email: string) => Promise<void>;
  setTimeframe: (tf: Timeframe) => void;
  setSortField: (field: "commits" | "linesAdded" | "linesRemoved" | "longestStreak") => void;
  clearSelection: () => void;
  reset: () => void;
}

const initialState = {
  leaderboard: [] as LeaderboardEntry[],
  selectedAuthor: null as AuthorDetail | null,
  selectedEmail: null as string | null,
  timeframe: "all" as Timeframe,
  loading: false,
  detailLoading: false,
  error: null as string | null,
  detailError: null as string | null,
  sortField: "commits" as "commits" | "linesAdded" | "linesRemoved" | "longestStreak",
  sortDirection: "desc" as "asc" | "desc",
};

export const useStatsStore = create<StatsState>((set, get) => ({
  ...initialState,

  loadLeaderboard: async (timeframe: Timeframe) => {
    set({ loading: true, error: null });
    try {
      const leaderboard = await window.electronAPI.stats.getLeaderboard(timeframe);
      set({ leaderboard, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  loadAuthorDetail: async (email: string) => {
    set({ detailLoading: true, detailError: null, selectedEmail: email });
    try {
      const { timeframe } = get();
      const detail = await window.electronAPI.stats.getAuthorDetail(email, timeframe);
      set({ selectedAuthor: detail, detailLoading: false });
    } catch (err: unknown) {
      set({
        detailLoading: false,
        detailError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setTimeframe: (tf: Timeframe) => {
    set({ timeframe: tf });
  },

  setSortField: (field: "commits" | "linesAdded" | "linesRemoved" | "longestStreak") => {
    const { sortField, sortDirection } = get();
    if (field === sortField) {
      set({ sortDirection: sortDirection === "desc" ? "asc" : "desc" });
    } else {
      set({ sortField: field, sortDirection: "desc" });
    }
  },

  clearSelection: () => {
    set({ selectedAuthor: null, selectedEmail: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
