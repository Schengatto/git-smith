import { create } from "zustand";
import type { GraphRow, CommitInfo } from "../../shared/git-types";
import { buildGraph } from "../../shared/graph-builder";
import { useRepoStore } from "./repo-store";

export interface BranchVisibility {
  mode: "include" | "exclude";
  branches: string[];
}

export type AuthorFilterMode = "highlight" | "filter";

interface GraphState {
  rows: GraphRow[];
  rowMap: Map<string, number>; // hash → index for O(1) lookup
  selectedCommit: CommitInfo | null;
  loading: boolean;
  hasMore: boolean;
  totalLoaded: number;
  branchFilter: string;
  branchVisibility: BranchVisibility | null;
  /** Raw commits accumulated across all loaded pages */
  allCommits: CommitInfo[];
  /** Whether saved view settings have been restored for the current repo */
  viewSettingsRestored: boolean;
  authorFilter: string | null;
  authorFilterMode: AuthorFilterMode;

  loadGraph: (maxCount?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  selectCommit: (hash: string) => Promise<void>;
  clearSelection: () => void;
  setBranchFilter: (filter: string) => void;
  setBranchVisibility: (visibility: BranchVisibility | null) => void;
  setAuthorFilter: (author: string | null) => void;
  setAuthorFilterMode: (mode: AuthorFilterMode) => void;
  restoreViewSettings: () => Promise<void>;
}

const CHUNK_SIZE = 500;

export const useGraphStore = create<GraphState>((set, get) => ({
  rows: [],
  rowMap: new Map(),
  selectedCommit: null,
  loading: false,
  hasMore: true,
  totalLoaded: 0,
  branchFilter: "",
  branchVisibility: null,
  allCommits: [],
  viewSettingsRestored: false,
  authorFilter: null,
  authorFilterMode: "highlight",

  restoreViewSettings: async () => {
    const repoPath = useRepoStore.getState().repo?.path;
    if (!repoPath) return;
    try {
      const saved = await window.electronAPI.repo.getViewSettings(repoPath);
      set({
        branchFilter: saved.branchFilter || "",
        branchVisibility: saved.branchVisibility || null,
        viewSettingsRestored: true,
      });
    } catch {
      set({ viewSettingsRestored: true });
    }
  },

  loadGraph: async (maxCount = CHUNK_SIZE) => {
    set({ loading: true });
    try {
      const { branchFilter, branchVisibility } = get();
      const vis =
        branchVisibility && branchVisibility.branches.length > 0 ? branchVisibility : undefined;
      const commits = await window.electronAPI.log.getCommits(
        maxCount,
        0,
        branchFilter || undefined,
        vis
      );
      const rows = buildGraph(commits);
      const rowMap = new Map<string, number>();
      rows.forEach((r, i) => rowMap.set(r.commit.hash, i));
      set({
        rows,
        rowMap,
        allCommits: commits,
        loading: false,
        hasMore: commits.length >= maxCount,
        totalLoaded: commits.length,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { allCommits, loading, hasMore, totalLoaded, branchFilter, branchVisibility } = get();
    if (loading || !hasMore) return;
    set({ loading: true });
    try {
      const vis =
        branchVisibility && branchVisibility.branches.length > 0 ? branchVisibility : undefined;
      const moreCommits = await window.electronAPI.log.getCommits(
        CHUNK_SIZE,
        totalLoaded,
        branchFilter || undefined,
        vis
      );
      // Accumulate all commits and rebuild graph from scratch
      const newAllCommits = [...allCommits, ...moreCommits];
      const rows = buildGraph(newAllCommits);
      const rowMap = new Map<string, number>();
      rows.forEach((r, i) => rowMap.set(r.commit.hash, i));
      set({
        rows,
        rowMap,
        allCommits: newAllCommits,
        loading: false,
        hasMore: moreCommits.length >= CHUNK_SIZE,
        totalLoaded: totalLoaded + moreCommits.length,
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

  setBranchFilter: (filter: string) => {
    set({ branchFilter: filter });
    const repoPath = useRepoStore.getState().repo?.path;
    if (repoPath) {
      window.electronAPI.repo.setViewSettings(repoPath, { branchFilter: filter });
    }
  },

  setBranchVisibility: (visibility: BranchVisibility | null) => {
    set({ branchVisibility: visibility });
    const repoPath = useRepoStore.getState().repo?.path;
    if (repoPath) {
      window.electronAPI.repo.setViewSettings(repoPath, { branchVisibility: visibility });
    }
  },

  setAuthorFilter: (author: string | null) => set({ authorFilter: author }),

  setAuthorFilterMode: (mode: AuthorFilterMode) => set({ authorFilterMode: mode }),
}));
