import { create } from "zustand";

export interface WorkspaceTab {
  id: string;
  repoPath: string;
  repoName: string;
  isDirty: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;

  addTab: (repoPath: string, repoName: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, partial: Partial<WorkspaceTab>) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  getActiveTab: () => WorkspaceTab | null;
}

let nextId = 1;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (repoPath: string, repoName: string) => {
    const existing = get().tabs.find((t) => t.repoPath === repoPath);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = `tab-${nextId++}`;
    const tab: WorkspaceTab = { id, repoPath, repoName, isDirty: false };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  removeTab: (id: string) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        const idx = s.tabs.findIndex((t) => t.id === id);
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id || null;
      }
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),

  updateTab: (id: string, partial: Partial<WorkspaceTab>) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    }));
  },

  moveTab: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      if (moved) tabs.splice(toIndex, 0, moved);
      return { tabs };
    });
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) || null;
  },
}));
