import React, { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "../../store/ui-store";
import {
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelProps,
  DockviewApi,
} from "dockview";
import { MenuBar } from "./MenuBar";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { WelcomeScreen } from "./WelcomeScreen";
import { useRepoStore } from "../../store/repo-store";
import { useCommandLogStore } from "../../store/command-log-store";
import { Sidebar } from "../sidebar/Sidebar";
import { CommitGraphPanel } from "../graph/CommitGraphPanel";
import { CommitDetailsPanel } from "../details/CommitDetailsPanel";
import { CommandLogPanel } from "../command-log/CommandLogPanel";
import { CloneDialog } from "../dialogs/CloneDialog";
import { SettingsDialog } from "../dialogs/SettingsDialog";
import { ScanDialog } from "../dialogs/ScanDialog";
import { AboutDialog } from "../dialogs/AboutDialog";
import { StaleBranchesDialog } from "../dialogs/StaleBranchesDialog";
import { GitOperationLogDialog } from "../dialogs/GitOperationLogDialog";
import { useGitOperationStore } from "../../store/git-operation-store";

const components: Record<string, React.FC<IDockviewPanelProps>> = {
  sidebar: () => <Sidebar />,
  graph: () => <CommitGraphPanel />,
  details: () => <CommitDetailsPanel />,
  commandLog: () => <CommandLogPanel />,
};

export const AppShell: React.FC = () => {
  const { repo, loadRecentRepos, openRepoDialog, initRepo } = useRepoStore();
  const { addEntry } = useCommandLogStore();
  const {
    theme,
    cloneDialogOpen, closeCloneDialog, openCloneDialog,
    settingsDialogOpen, closeSettingsDialog, openSettingsDialog,
    scanDialogOpen, closeScanDialog, openScanDialog,
    aboutDialogOpen, closeAboutDialog, openAboutDialog,
    staleBranchesDialogOpen, closeStaleBranchesDialog, openStaleBranchesDialog,
  } = useUIStore();
  const dockviewApiRef = useRef<DockviewApi | null>(null);
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initializing, setInitializing] = useState(true);

  const saveLayout = useCallback(() => {
    const api = dockviewApiRef.current;
    const repoPath = useRepoStore.getState().repo?.path;
    if (!api || !repoPath) return;
    // Debounce layout saves to avoid excessive writes
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      try {
        const layout = api.toJSON();
        window.electronAPI.repo.setViewSettings(repoPath, { dockviewLayout: layout });
      } catch {}
    }, 500);
  }, []);

  useEffect(() => {
    loadRecentRepos();
    setInitializing(false);

    const unsub = window.electronAPI.on.commandLog((entry) => {
      addEntry(entry);
      useGitOperationStore.getState().addEntry(entry);
    });
    const unsubOutput = window.electronAPI.on.commandOutput((line) => {
      useGitOperationStore.getState().addOutputLine(line);
    });
    const unsubMenu = window.electronAPI.on.menuOpenRepo(() => {
      useRepoStore.getState().openRepoDialog();
    });

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        useRepoStore.getState().openRepoDialog();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && !useRepoStore.getState().repo) {
        e.preventDefault();
        useRepoStore.getState().initRepo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unsub();
      unsubOutput();
      unsubMenu();
      window.removeEventListener("keydown", handleKeyDown);
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedLayoutRef = useRef<unknown | null>(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  // Load saved layout when repo changes
  useEffect(() => {
    if (!repo) {
      savedLayoutRef.current = null;
      setLayoutLoaded(false);
      return;
    }
    window.electronAPI.repo.getViewSettings(repo.path).then((settings) => {
      savedLayoutRef.current = settings.dockviewLayout;
      setLayoutLoaded(true);
    }).catch(() => {
      savedLayoutRef.current = null;
      setLayoutLoaded(true);
    });
  }, [repo?.path]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    dockviewApiRef.current = event.api;

    const savedLayout = savedLayoutRef.current;
    if (savedLayout && typeof savedLayout === "object") {
      try {
        event.api.fromJSON(savedLayout as Parameters<DockviewApi["fromJSON"]>[0]);
        // Subscribe to layout changes for persistence
        event.api.onDidLayoutChange(() => saveLayout());
        return;
      } catch {
        // Fallback to default layout if restore fails
      }
    }

    // Default layout
    const sidebarPanel = event.api.addPanel({
      id: "sidebar",
      component: "sidebar",
      title: "Explorer",
    });

    const graphPanel = event.api.addPanel({
      id: "graph",
      component: "graph",
      title: "Commit Graph",
      position: { referencePanel: sidebarPanel, direction: "right" },
    });

    const detailsPanel = event.api.addPanel({
      id: "details",
      component: "details",
      title: "Details",
      position: { referencePanel: graphPanel, direction: "below" },
    });

    event.api.addPanel({
      id: "commandLog",
      component: "commandLog",
      title: "Command Log",
      position: { referencePanel: detailsPanel, direction: "within" },
    });

    sidebarPanel.api.setSize({ width: 220 });

    // Subscribe to layout changes for persistence
    event.api.onDidLayoutChange(() => saveLayout());
  }, [saveLayout]);

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-surface-0 text-text-secondary">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p style={{ marginTop: 16, fontSize: 14, opacity: 0.7 }}>Loading Git Expansion…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-text-primary">
      <MenuBar
        onOpenClone={openCloneDialog}
        onOpenSettings={openSettingsDialog}
        onOpenScan={openScanDialog}
        onOpenAbout={openAboutDialog}
        onOpenStaleBranches={openStaleBranchesDialog}
      />
      {repo && <Toolbar />}
      <div className="flex-1 overflow-hidden">
        {repo && layoutLoaded ? (
          <DockviewReact
            key={repo.path}
            className={theme === "dark" ? "dockview-theme-dark" : "dockview-theme-light"}
            onReady={onReady}
            components={components}
          />
        ) : repo && !layoutLoaded ? (
          <div className="flex items-center justify-center h-full bg-surface-0 text-text-secondary">
            <p style={{ fontSize: 14, opacity: 0.7 }}>Loading layout…</p>
          </div>
        ) : (
          <WelcomeScreen />
        )}
      </div>
      <StatusBar />

      <CloneDialog open={cloneDialogOpen} onClose={closeCloneDialog} />
      <SettingsDialog open={settingsDialogOpen} onClose={closeSettingsDialog} />
      <ScanDialog open={scanDialogOpen} onClose={closeScanDialog} />
      <AboutDialog open={aboutDialogOpen} onClose={closeAboutDialog} />
      <StaleBranchesDialog open={staleBranchesDialogOpen} onClose={closeStaleBranchesDialog} />
      <GitOperationLogDialog />
    </div>
  );
};
