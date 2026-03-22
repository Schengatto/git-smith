import { create } from "zustand";

type Theme = "dark" | "light";
type Panel = "sidebar" | "graph" | "details" | "commandLog";

export interface ToastMessage {
  id: number;
  text: string;
  type: "error" | "info";
}

let toastId = 0;

interface UIState {
  theme: Theme;
  visiblePanels: Set<Panel>;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  togglePanel: (panel: Panel) => void;
  isPanelVisible: (panel: Panel) => boolean;

  // Shared dialog state (so MenuBar, Toolbar, and WelcomeScreen can open dialogs)
  cloneDialogOpen: boolean;
  settingsDialogOpen: boolean;
  scanDialogOpen: boolean;
  aboutDialogOpen: boolean;
  staleBranchesDialogOpen: boolean;
  gitignoreDialogOpen: boolean;
  grepDialogOpen: boolean;
  branchDiffDialogOpen: boolean;
  branchCompareDialogOpen: boolean;
  hooksDialogOpen: boolean;
  undoDialogOpen: boolean;
  ciStatusDialogOpen: boolean;
  gistDialogOpen: boolean;
  advancedStatsDialogOpen: boolean;
  sshDialogOpen: boolean;
  mergeEditorOpen: boolean;
  mergeEditorFile: string;
  reviewPanelOpen: boolean;
  reviewPanelCommit: string;
  openCloneDialog: () => void;
  closeCloneDialog: () => void;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
  openScanDialog: () => void;
  closeScanDialog: () => void;
  openAboutDialog: () => void;
  closeAboutDialog: () => void;
  openStaleBranchesDialog: () => void;
  closeStaleBranchesDialog: () => void;
  openGitignoreDialog: () => void;
  closeGitignoreDialog: () => void;
  openGrepDialog: () => void;
  closeGrepDialog: () => void;
  openBranchDiffDialog: () => void;
  closeBranchDiffDialog: () => void;
  openBranchCompareDialog: () => void;
  closeBranchCompareDialog: () => void;
  openHooksDialog: () => void;
  closeHooksDialog: () => void;
  openUndoDialog: () => void;
  closeUndoDialog: () => void;
  openCIStatusDialog: () => void;
  closeCIStatusDialog: () => void;
  openGistDialog: () => void;
  closeGistDialog: () => void;
  openAdvancedStatsDialog: () => void;
  closeAdvancedStatsDialog: () => void;
  openSshDialog: () => void;
  closeSshDialog: () => void;
  openMergeEditor: (filePath: string) => void;
  closeMergeEditor: () => void;
  openReviewPanel: (commitHash: string) => void;
  closeReviewPanel: () => void;

  toasts: ToastMessage[];
  showToast: (text: string, type?: "error" | "info") => void;
  dismissToast: (id: number) => void;
}

// Read persisted theme
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("gitsmith-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  try {
    localStorage.setItem("gitsmith-theme", theme);
  } catch {}
}

// Apply on load
applyTheme(getInitialTheme());

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  visiblePanels: new Set(["sidebar", "graph", "details"] as Panel[]),

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
    window.electronAPI?.settings.update({ theme: next }).catch(() => {});
  },

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
    window.electronAPI?.settings.update({ theme }).catch(() => {});
  },

  togglePanel: (panel: Panel) =>
    set((s) => {
      const next = new Set(s.visiblePanels);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return { visiblePanels: next };
    }),

  isPanelVisible: (panel: Panel) => get().visiblePanels.has(panel),

  cloneDialogOpen: false,
  settingsDialogOpen: false,
  scanDialogOpen: false,
  aboutDialogOpen: false,
  openCloneDialog: () => set({ cloneDialogOpen: true }),
  closeCloneDialog: () => set({ cloneDialogOpen: false }),
  openSettingsDialog: () => set({ settingsDialogOpen: true }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  openScanDialog: () => set({ scanDialogOpen: true }),
  closeScanDialog: () => set({ scanDialogOpen: false }),
  staleBranchesDialogOpen: false,
  gitignoreDialogOpen: false,
  grepDialogOpen: false,
  branchDiffDialogOpen: false,
  branchCompareDialogOpen: false,
  hooksDialogOpen: false,
  undoDialogOpen: false,
  ciStatusDialogOpen: false,
  gistDialogOpen: false,
  advancedStatsDialogOpen: false,
  sshDialogOpen: false,
  mergeEditorOpen: false,
  mergeEditorFile: "",
  reviewPanelOpen: false,
  reviewPanelCommit: "",
  openAboutDialog: () => set({ aboutDialogOpen: true }),
  closeAboutDialog: () => set({ aboutDialogOpen: false }),
  openStaleBranchesDialog: () => set({ staleBranchesDialogOpen: true }),
  closeStaleBranchesDialog: () => set({ staleBranchesDialogOpen: false }),
  openGitignoreDialog: () => set({ gitignoreDialogOpen: true }),
  closeGitignoreDialog: () => set({ gitignoreDialogOpen: false }),
  openGrepDialog: () => set({ grepDialogOpen: true }),
  closeGrepDialog: () => set({ grepDialogOpen: false }),
  openBranchDiffDialog: () => set({ branchDiffDialogOpen: true }),
  closeBranchDiffDialog: () => set({ branchDiffDialogOpen: false }),
  openBranchCompareDialog: () => set({ branchCompareDialogOpen: true }),
  closeBranchCompareDialog: () => set({ branchCompareDialogOpen: false }),
  openHooksDialog: () => set({ hooksDialogOpen: true }),
  closeHooksDialog: () => set({ hooksDialogOpen: false }),
  openUndoDialog: () => set({ undoDialogOpen: true }),
  closeUndoDialog: () => set({ undoDialogOpen: false }),
  openCIStatusDialog: () => set({ ciStatusDialogOpen: true }),
  closeCIStatusDialog: () => set({ ciStatusDialogOpen: false }),
  openGistDialog: () => set({ gistDialogOpen: true }),
  closeGistDialog: () => set({ gistDialogOpen: false }),
  openAdvancedStatsDialog: () => set({ advancedStatsDialogOpen: true }),
  closeAdvancedStatsDialog: () => set({ advancedStatsDialogOpen: false }),
  openSshDialog: () => set({ sshDialogOpen: true }),
  closeSshDialog: () => set({ sshDialogOpen: false }),
  openMergeEditor: (filePath: string) => set({ mergeEditorOpen: true, mergeEditorFile: filePath }),
  closeMergeEditor: () => set({ mergeEditorOpen: false, mergeEditorFile: "" }),
  openReviewPanel: (commitHash: string) =>
    set({ reviewPanelOpen: true, reviewPanelCommit: commitHash }),
  closeReviewPanel: () => set({ reviewPanelOpen: false, reviewPanelCommit: "" }),

  toasts: [],
  showToast: (text, type = "error") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Listen for theme changes broadcast from other windows
if (typeof window !== "undefined" && window.electronAPI?.settings?.onThemeChanged) {
  window.electronAPI.settings.onThemeChanged((theme) => {
    if (theme === "dark" || theme === "light") {
      applyTheme(theme);
      useUIStore.setState({ theme });
    }
  });
}
