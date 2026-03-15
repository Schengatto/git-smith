import { create } from "zustand";
import type { GraphRow, CommitInfo } from "../../shared/git-types";

interface GraphState {
  rows: GraphRow[];
  rowMap: Map<string, number>; // hash → index for O(1) lookup
  selectedCommit: CommitInfo | null;
  loading: boolean;
  hasMore: boolean;
  totalLoaded: number;

  loadGraph: (maxCount?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  selectCommit: (hash: string) => Promise<void>;
  clearSelection: () => void;
}

const CHUNK_SIZE = 500;

export const useGraphStore = create<GraphState>((set, get) => ({
  rows: [],
  rowMap: new Map(),
  selectedCommit: null,
  loading: false,
  hasMore: true,
  totalLoaded: 0,

  loadGraph: async (maxCount = CHUNK_SIZE) => {
    set({ loading: true });
    try {
      const rows = await window.electronAPI.log.graph(maxCount, 0);
      const rowMap = new Map<string, number>();
      rows.forEach((r, i) => rowMap.set(r.commit.hash, i));
      set({
        rows,
        rowMap,
        loading: false,
        hasMore: rows.length >= maxCount,
        totalLoaded: rows.length,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { rows, rowMap, loading, hasMore, totalLoaded } = get();
    if (loading || !hasMore) return;
    set({ loading: true });
    try {
      const more = await window.electronAPI.log.graph(CHUNK_SIZE, totalLoaded);
      const newRows = [...rows, ...more];
      const newMap = new Map(rowMap);
      more.forEach((r, i) => newMap.set(r.commit.hash, rows.length + i));
      set({
        rows: newRows,
        rowMap: newMap,
        loading: false,
        hasMore: more.length >= CHUNK_SIZE,
        totalLoaded: totalLoaded + more.length,
      });
    } catch {
      set({ loading: false });
    }
  },

  selectCommit: async (hash: string) => {
    try {
      const details = await window.electronAPI.log.details(hash);
      set({ selectedCommit: details });
    } catch {}
  },

  clearSelection: () => set({ selectedCommit: null }),
}));
