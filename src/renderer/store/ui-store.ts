import { create } from "zustand";

type Theme = "dark" | "light";
type Panel = "sidebar" | "graph" | "details" | "commandLog";

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
}

// Read persisted theme
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("git-expansion-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  try {
    localStorage.setItem("git-expansion-theme", theme);
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
  },

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
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
  openAboutDialog: () => set({ aboutDialogOpen: true }),
  closeAboutDialog: () => set({ aboutDialogOpen: false }),
  openStaleBranchesDialog: () => set({ staleBranchesDialogOpen: true }),
  closeStaleBranchesDialog: () => set({ staleBranchesDialogOpen: false }),
}));
