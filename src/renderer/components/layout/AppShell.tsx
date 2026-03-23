import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui-store";
import { setAppLanguage } from "../../i18n";
import type { DockviewReadyEvent, IDockviewPanelProps, DockviewApi } from "dockview";
import { DockviewReact } from "dockview";
import { MenuBar } from "./MenuBar";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { WelcomeScreen } from "./WelcomeScreen";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useCommandLogStore } from "../../store/command-log-store";
import { Sidebar } from "../sidebar/Sidebar";
import { CommitGraphPanel } from "../graph/CommitGraphPanel";
import { CommitDetailsPanel } from "../details/CommitDetailsPanel";
import { CommitInfoPanel } from "../details/CommitInfoPanel";
import { CommandLogPanel } from "../command-log/CommandLogPanel";
import { ConsolePanel } from "../console/ConsolePanel";
import { StatsPanel } from "../stats/StatsPanel";
import { CodebaseStatsPanel } from "../stats/CodebaseStatsPanel";
import { CloneDialog } from "../dialogs/CloneDialog";
import { ScanDialog } from "../dialogs/ScanDialog";
import { openDialogWindow } from "../../utils/open-dialog";
import { AboutDialog } from "../dialogs/AboutDialog";
import { StaleBranchesDialog } from "../dialogs/StaleBranchesDialog";
import { GitOperationLogDialog } from "../dialogs/GitOperationLogDialog";
import { useGitOperationStore } from "../../store/git-operation-store";
import { ConflictBanner } from "./ConflictBanner";
import { CommandPalette } from "./CommandPalette";
import { ReflogDialog } from "../dialogs/ReflogDialog";
import { GitignoreDialog } from "../dialogs/GitignoreDialog";
import { GrepDialog } from "../dialogs/GrepDialog";
import { BranchDiffDialog } from "../dialogs/BranchDiffDialog";
import { BranchCompareDialog } from "../dialogs/BranchCompareDialog";
import { HooksDialog } from "../dialogs/HooksDialog";
import { UndoDialog } from "../dialogs/UndoDialog";
import { CIStatusDialog } from "../dialogs/CIStatusDialog";
import { GistDialog } from "../dialogs/GistDialog";
import { TabBar } from "./TabBar";
import { AdvancedStatsDialog } from "../dialogs/AdvancedStatsDialog";
import { SSHDialog } from "../dialogs/SSHDialog";
import { MergeEditorDialog } from "../dialogs/MergeEditorDialog";
import { ReviewPanel } from "../dialogs/ReviewPanel";
import { useWorkspaceStore } from "../../store/workspace-store";

const components: Record<string, React.FC<IDockviewPanelProps>> = {
  sidebar: () => <Sidebar />,
  graph: () => <CommitGraphPanel />,
  commitInfo: () => <CommitInfoPanel />,
  details: () => <CommitDetailsPanel />,
  commandLog: () => <CommandLogPanel />,
  console: () => <ConsolePanel />,
  stats: () => <StatsPanel />,
  codebaseStats: () => <CodebaseStatsPanel />,
};

export const AppShell: React.FC = () => {
  const { t } = useTranslation();
  const { repo, loadRecentRepos } = useRepoStore();
  const status = useRepoStore((s) => s.status);
  const { addTab, updateTab } = useWorkspaceStore();
  const { addEntry } = useCommandLogStore();
  const {
    theme,
    cloneDialogOpen,
    closeCloneDialog,
    openCloneDialog,
    scanDialogOpen,
    closeScanDialog,
    openScanDialog,
    aboutDialogOpen,
    closeAboutDialog,
    openAboutDialog,
    staleBranchesDialogOpen,
    closeStaleBranchesDialog,
    openStaleBranchesDialog,
    gitignoreDialogOpen,
    closeGitignoreDialog,
    openGitignoreDialog,
    grepDialogOpen,
    closeGrepDialog,
    openGrepDialog,
    branchDiffDialogOpen,
    closeBranchDiffDialog,
    openBranchDiffDialog,
    branchCompareDialogOpen,
    closeBranchCompareDialog,
    openBranchCompareDialog,
    hooksDialogOpen,
    closeHooksDialog,
    openHooksDialog,
    undoDialogOpen,
    closeUndoDialog,
    openUndoDialog,
    ciStatusDialogOpen,
    closeCIStatusDialog,
    openCIStatusDialog,
    gistDialogOpen,
    closeGistDialog,
    openGistDialog,
    advancedStatsDialogOpen,
    closeAdvancedStatsDialog,
    openAdvancedStatsDialog,
    sshDialogOpen,
    closeSshDialog,
    openSshDialog,
    mergeEditorOpen,
    mergeEditorFile,
    closeMergeEditor,
    reviewPanelOpen,
    reviewPanelCommit,
    closeReviewPanel,
  } = useUIStore();
  const dockviewApiRef = useRef<DockviewApi | null>(null);
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [reflogOpen, setReflogOpen] = useState(false);

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

    window.electronAPI.settings.get().then((s) => {
      if (s.language && s.language !== "en") {
        setAppLanguage(s.language);
      }
    });

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
    const unsubRepoChanged = window.electronAPI.on.repoChanged(() => {
      const repo = useRepoStore.getState().repo;
      if (!repo) return;
      useRepoStore.getState().refreshInfo();
      useRepoStore.getState().refreshStatus();
      useGraphStore.getState().loadGraph();
    });

    const unsubDialogResult = window.electronAPI.dialog.onResult((result) => {
      if (result.action === "resolved" || result.action === "closed") {
        useRepoStore.getState().refreshInfo();
        useRepoStore.getState().refreshStatus();
        useGraphStore.getState().loadGraph();
      }
      if (result.action === "navigate" && result.data?.hash) {
        const hash = result.data.hash as string;
        const { rows, selectCommit } = useGraphStore.getState();
        selectCommit(hash);
        const idx = rows.findIndex((r) => r.commit.hash === hash);
        if (idx !== -1) {
          // Graph scrolling is handled by CommitGraphPanel via store subscription
        }
      }
    });

    // Sync workspace tabs when repo changes
    const unsubWorkspaceSync = useRepoStore.subscribe((state) => {
      if (state.repo) {
        const tabId = addTab(state.repo.path, state.repo.name);
        updateTab(tabId, { isDirty: state.repo.isDirty });
      }
    });

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
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

    const handleOpenReflog = () => setReflogOpen(true);
    window.addEventListener("command-palette:open-reflog", handleOpenReflog);

    return () => {
      unsub();
      unsubOutput();
      unsubMenu();
      unsubRepoChanged();
      unsubWorkspaceSync();
      unsubDialogResult();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("command-palette:open-reflog", handleOpenReflog);
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    };
    // Mount-only: registers IPC listeners and global keyboard shortcuts
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
    window.electronAPI.repo
      .getViewSettings(repo.path)
      .then((settings) => {
        savedLayoutRef.current = settings.dockviewLayout;
        setLayoutLoaded(true);
      })
      .catch(() => {
        savedLayoutRef.current = null;
        setLayoutLoaded(true);
      });
    // Only re-run when the repo path changes, not on every repo object update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path]);

  const resetLayout = useCallback(() => {
    const api = dockviewApiRef.current;
    const repoPath = useRepoStore.getState().repo?.path;
    if (!api || !repoPath) return;

    // Clear saved layout
    window.electronAPI.repo.setViewSettings(repoPath, { dockviewLayout: null });

    // Remove all existing panels
    const panels = api.panels.slice();
    for (const p of panels) {
      try {
        api.removePanel(p);
      } catch {}
    }

    // Rebuild default layout
    const sidebarPanel = api.addPanel({
      id: "sidebar",
      component: "sidebar",
      title: t("panels.explorer"),
    });
    const graphPanel = api.addPanel({
      id: "graph",
      component: "graph",
      title: t("panels.commitGraph"),
      position: { referencePanel: sidebarPanel, direction: "right" },
    });
    api.addPanel({
      id: "commitInfo",
      component: "commitInfo",
      title: t("panels.commitInfo"),
      position: { referencePanel: graphPanel, direction: "right" },
    });
    const detailsPanel = api.addPanel({
      id: "details",
      component: "details",
      title: t("panels.diffFiles"),
      position: { referencePanel: graphPanel, direction: "below" },
    });
    api.addPanel({
      id: "commandLog",
      component: "commandLog",
      title: t("panels.commandLog"),
      position: { referencePanel: detailsPanel, direction: "within" },
    });
    api.addPanel({
      id: "console",
      component: "console",
      title: t("panels.console"),
      position: { referencePanel: detailsPanel, direction: "within" },
    });
    api.addPanel({
      id: "stats",
      component: "stats",
      title: t("panels.authorStats"),
      position: { referencePanel: detailsPanel, direction: "within" },
    });
    sidebarPanel.api.setSize({ width: 220 });
  }, [t]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      dockviewApiRef.current = event.api;

      const savedLayout = savedLayoutRef.current;
      if (savedLayout && typeof savedLayout === "object") {
        try {
          event.api.fromJSON(savedLayout as Parameters<DockviewApi["fromJSON"]>[0]);

          // Migrate: add commitInfo panel if missing from saved layout
          if (!event.api.getPanel("commitInfo")) {
            const graphPanel = event.api.getPanel("graph");
            if (graphPanel) {
              event.api.addPanel({
                id: "commitInfo",
                component: "commitInfo",
                title: t("panels.commitInfo"),
                position: { referencePanel: graphPanel, direction: "right" },
              });
            }
          }

          // Migrate: add console panel if missing from saved layout
          if (!event.api.getPanel("console")) {
            const detailsPanel = event.api.getPanel("details");
            const commandLogPanel = event.api.getPanel("commandLog");
            const referencePanel = commandLogPanel ?? detailsPanel;
            if (referencePanel) {
              event.api.addPanel({
                id: "console",
                component: "console",
                title: t("panels.console"),
                position: { referencePanel: referencePanel, direction: "within" },
              });
            }
          }

          // Migrate: add stats panel if missing from saved layout
          if (!event.api.getPanel("stats")) {
            const detailsPanel = event.api.getPanel("details");
            const consolePanel = event.api.getPanel("console");
            const commandLogPanel = event.api.getPanel("commandLog");
            const referencePanel = consolePanel ?? commandLogPanel ?? detailsPanel;
            if (referencePanel) {
              event.api.addPanel({
                id: "stats",
                component: "stats",
                title: t("panels.authorStats"),
                position: { referencePanel: referencePanel, direction: "within" },
              });
            }
          }

          // Migrate: add codebaseStats panel if missing from saved layout
          if (!event.api.getPanel("codebaseStats")) {
            const ref =
              event.api.getPanel("stats") ??
              event.api.getPanel("console") ??
              event.api.getPanel("commandLog") ??
              event.api.getPanel("details");
            if (ref) {
              event.api.addPanel({
                id: "codebaseStats",
                component: "codebaseStats",
                title: t("panels.codebaseStats"),
                position: { referencePanel: ref, direction: "within" },
              });
            }
          }

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
        title: t("panels.explorer"),
      });

      const graphPanel = event.api.addPanel({
        id: "graph",
        component: "graph",
        title: t("panels.commitGraph"),
        position: { referencePanel: sidebarPanel, direction: "right" },
      });

      event.api.addPanel({
        id: "commitInfo",
        component: "commitInfo",
        title: t("panels.commitInfo"),
        position: { referencePanel: graphPanel, direction: "right" },
      });

      const detailsPanel = event.api.addPanel({
        id: "details",
        component: "details",
        title: t("panels.diffFiles"),
        position: { referencePanel: graphPanel, direction: "below" },
      });

      event.api.addPanel({
        id: "commandLog",
        component: "commandLog",
        title: t("panels.commandLog"),
        position: { referencePanel: detailsPanel, direction: "within" },
      });

      event.api.addPanel({
        id: "console",
        component: "console",
        title: t("panels.console"),
        position: { referencePanel: detailsPanel, direction: "within" },
      });

      event.api.addPanel({
        id: "stats",
        component: "stats",
        title: t("panels.authorStats"),
        position: { referencePanel: detailsPanel, direction: "within" },
      });

      event.api.addPanel({
        id: "codebaseStats",
        component: "codebaseStats",
        title: t("panels.codebaseStats"),
        position: { referencePanel: detailsPanel, direction: "within" },
      });

      sidebarPanel.api.setSize({ width: 220 });

      // Subscribe to layout changes for persistence
      event.api.onDidLayoutChange(() => saveLayout());
    },
    [saveLayout, t]
  );

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-surface-0 text-text-secondary">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p style={{ marginTop: 16, fontSize: 14, opacity: 0.7 }}>{t("app.loading")}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-text-primary">
      <TabBar />
      <MenuBar
        onOpenClone={openCloneDialog}
        onOpenSettings={() => openDialogWindow({ dialog: "SettingsDialog" })}
        onOpenScan={openScanDialog}
        onOpenAbout={openAboutDialog}
        onOpenStaleBranches={openStaleBranchesDialog}
        onOpenGitignore={openGitignoreDialog}
        onOpenGrep={openGrepDialog}
        onOpenBranchDiff={openBranchDiffDialog}
        onOpenBranchCompare={openBranchCompareDialog}
        onOpenHooks={openHooksDialog}
        onOpenUndo={openUndoDialog}
        onOpenCIStatus={openCIStatusDialog}
        onOpenGist={openGistDialog}
        onOpenAdvancedStats={openAdvancedStatsDialog}
        onOpenSsh={openSshDialog}
        onResetLayout={resetLayout}
      />
      {repo && <Toolbar />}
      {repo && status && <ConflictBanner status={status} />}
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
            <p style={{ fontSize: 14, opacity: 0.7 }}>{t("app.loadingLayout")}</p>
          </div>
        ) : (
          <WelcomeScreen />
        )}
      </div>
      <StatusBar />

      <CloneDialog open={cloneDialogOpen} onClose={closeCloneDialog} />
      <ScanDialog open={scanDialogOpen} onClose={closeScanDialog} />
      <AboutDialog open={aboutDialogOpen} onClose={closeAboutDialog} />
      <StaleBranchesDialog open={staleBranchesDialogOpen} onClose={closeStaleBranchesDialog} />
      <GitOperationLogDialog />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ReflogDialog open={reflogOpen} onClose={() => setReflogOpen(false)} />
      <GitignoreDialog open={gitignoreDialogOpen} onClose={closeGitignoreDialog} />
      <GrepDialog open={grepDialogOpen} onClose={closeGrepDialog} />
      <BranchDiffDialog open={branchDiffDialogOpen} onClose={closeBranchDiffDialog} />
      <BranchCompareDialog open={branchCompareDialogOpen} onClose={closeBranchCompareDialog} />
      <HooksDialog open={hooksDialogOpen} onClose={closeHooksDialog} />
      <UndoDialog open={undoDialogOpen} onClose={closeUndoDialog} />
      <CIStatusDialog open={ciStatusDialogOpen} onClose={closeCIStatusDialog} />
      <GistDialog open={gistDialogOpen} onClose={closeGistDialog} />
      <AdvancedStatsDialog open={advancedStatsDialogOpen} onClose={closeAdvancedStatsDialog} />
      <SSHDialog open={sshDialogOpen} onClose={closeSshDialog} />
      <MergeEditorDialog
        open={mergeEditorOpen}
        onClose={closeMergeEditor}
        filePath={mergeEditorFile}
      />
      <ReviewPanel
        open={reviewPanelOpen}
        onClose={closeReviewPanel}
        commitHash={reviewPanelCommit}
      />
    </div>
  );
};
