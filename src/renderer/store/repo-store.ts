import { create } from "zustand";
import type { RepoInfo, GitStatus } from "../../shared/git-types";
import { useGraphStore } from "./graph-store";
import { useUIStore } from "./ui-store";

export interface RepoCategories {
  [repoPath: string]: string;
}

interface RepoState {
  repo: RepoInfo | null;
  status: GitStatus | null;
  recentRepos: string[];
  repoCategories: RepoCategories;
  loading: boolean;
  error: string | null;

  openRepo: (path: string) => Promise<void>;
  openRepoDialog: () => Promise<void>;
  initRepo: () => Promise<void>;
  closeRepo: () => void;
  refreshInfo: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  loadRecentRepos: () => Promise<void>;
  removeRecentRepo: (path: string) => Promise<void>;
  clearRecentRepos: () => Promise<void>;
  removeMissingRepos: () => Promise<string[]>;
  setRepoCategory: (repoPath: string, category: string | null) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (category: string) => Promise<void>;
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repo: null,
  status: null,
  recentRepos: [],
  repoCategories: {},
  loading: false,
  error: null,

  openRepo: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const info = await window.electronAPI.repo.open(path);
      set({ repo: info, loading: false });
      get().refreshStatus();
      // Background fetch on repo open - don't await, don't block UI
      window.electronAPI.remote
        .fetchAll()
        .then(() => {
          get().refreshInfo();
          get().refreshStatus();
          useGraphStore.getState().loadGraph();
        })
        .catch(() => {
          /* background fetch — failure is non-critical */
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      useUIStore.getState().showToast(msg, "error");
    }
  },

  openRepoDialog: async () => {
    set({ loading: true, error: null });
    try {
      const info = await window.electronAPI.repo.openDialog();
      if (info) {
        set({ repo: info, loading: false });
        get().refreshStatus();
        // Background fetch on repo open
        window.electronAPI.remote
          .fetchAll()
          .then(() => {
            get().refreshInfo();
            get().refreshStatus();
            useGraphStore.getState().loadGraph();
          })
          .catch(() => {
            /* background fetch — failure is non-critical */
          });
      } else {
        set({ loading: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      useUIStore.getState().showToast(msg, "error");
    }
  },

  initRepo: async () => {
    set({ loading: true, error: null });
    try {
      const info = await window.electronAPI.repo.init();
      if (info) {
        set({ repo: info, loading: false });
        get().refreshStatus();
        get().loadRecentRepos();
      } else {
        set({ loading: false });
      }
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  closeRepo: () => {
    window.electronAPI.repo.close();
    set({ repo: null, status: null });
  },

  refreshInfo: async () => {
    try {
      const info = await window.electronAPI.repo.getInfo();
      if (info) set({ repo: info });
    } catch {}
  },

  refreshStatus: async () => {
    try {
      const status = await window.electronAPI.status.get();
      set({ status });
    } catch {}
  },

  loadRecentRepos: async () => {
    const [repos, categories] = await Promise.all([
      window.electronAPI.repo.getRecent(),
      window.electronAPI.repo.getCategories(),
    ]);
    set({ recentRepos: repos, repoCategories: categories });
  },

  removeRecentRepo: async (path: string) => {
    await window.electronAPI.repo.removeRecent(path);
    get().loadRecentRepos();
  },

  clearRecentRepos: async () => {
    await window.electronAPI.repo.clearRecent();
    set({ recentRepos: [], repoCategories: {} });
  },

  removeMissingRepos: async () => {
    const removed = await window.electronAPI.repo.removeMissing();
    get().loadRecentRepos();
    return removed;
  },

  setRepoCategory: async (repoPath: string, category: string | null) => {
    await window.electronAPI.repo.setCategory(repoPath, category);
    get().loadRecentRepos();
  },

  renameCategory: async (oldName: string, newName: string) => {
    await window.electronAPI.repo.renameCategory(oldName, newName);
    get().loadRecentRepos();
  },

  deleteCategory: async (category: string) => {
    await window.electronAPI.repo.deleteCategory(category);
    get().loadRecentRepos();
  },
}));
