import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useUIStore } from "../../store/ui-store";
import { runGitOperation } from "../../store/git-operation-store";
import { openDialogWindow } from "../../utils/open-dialog";

export interface CommandEntry {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  needsRepo?: boolean;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasRepo = !!useRepoStore((s) => s.repo);

  const commands = useMemo<CommandEntry[]>(() => {
    const { refreshStatus, refreshInfo, openRepoDialog, initRepo, closeRepo } =
      useRepoStore.getState();
    const { loadGraph } = useGraphStore.getState();
    const {
      openCloneDialog,
      openScanDialog,
      openAboutDialog,
      openStaleBranchesDialog,
      openGitignoreDialog,
      openGrepDialog,
      openBranchDiffDialog,
      openBranchCompareDialog,
      openHooksDialog,
      openUndoDialog,
      openCIStatusDialog,
      openGistDialog,
      openAdvancedStatsDialog,
      openSshDialog,
      toggleTheme,
    } = useUIStore.getState();

    const refresh = async () => {
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
    };

    return [
      // Repository
      {
        id: "repo:open",
        label: t("commandPalette.openRepo"),
        category: t("commandPalette.categoryRepository"),
        shortcut: "Ctrl+O",
        action: () => openRepoDialog(),
      },
      {
        id: "repo:init",
        label: t("commandPalette.createNewRepo"),
        category: t("commandPalette.categoryRepository"),
        action: () => initRepo(),
      },
      {
        id: "repo:clone",
        label: t("commandPalette.cloneRepo"),
        category: t("commandPalette.categoryRepository"),
        action: () => openCloneDialog(),
      },
      {
        id: "repo:scan",
        label: t("commandPalette.scanRepos"),
        category: t("commandPalette.categoryRepository"),
        action: () => openScanDialog(),
      },
      {
        id: "repo:close",
        label: t("commandPalette.closeRepo"),
        category: t("commandPalette.categoryRepository"),
        needsRepo: true,
        action: () => closeRepo(),
      },
      {
        id: "repo:refresh",
        label: t("commandPalette.refresh"),
        category: t("commandPalette.categoryRepository"),
        shortcut: "F5",
        needsRepo: true,
        action: () => refresh(),
      },

      // Git Operations
      {
        id: "git:fetch",
        label: t("commandPalette.fetch"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch", () => window.electronAPI.remote.fetch());
          await refresh();
        },
      },
      {
        id: "git:fetch-all",
        label: t("commandPalette.fetchAll"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch All", () => window.electronAPI.remote.fetchAll());
          await refresh();
        },
      },
      {
        id: "git:fetch-prune",
        label: t("commandPalette.fetchPrune"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch & Prune", () => window.electronAPI.remote.fetchPrune());
          await refresh();
        },
      },
      {
        id: "git:pull",
        label: t("commandPalette.pull"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull", () => window.electronAPI.remote.pull());
          await refresh();
        },
      },
      {
        id: "git:pull-rebase",
        label: t("commandPalette.pullRebase"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull (Rebase)", () => window.electronAPI.remote.pullRebase());
          await refresh();
        },
      },
      {
        id: "git:pull-merge",
        label: t("commandPalette.pullMerge"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull (Merge)", () => window.electronAPI.remote.pullMerge());
          await refresh();
        },
      },
      {
        id: "git:push",
        label: t("commandPalette.push"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Push", () => window.electronAPI.remote.push());
          await refresh();
        },
      },
      {
        id: "git:stash",
        label: t("commandPalette.stashChanges"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Stash", () => window.electronAPI.stash.create());
          await Promise.all([refreshStatus(), loadGraph()]);
        },
      },
      {
        id: "git:stash-pop",
        label: t("commandPalette.stashPop"),
        category: t("commandPalette.categoryGit"),
        needsRepo: true,
        action: async () => {
          await runGitOperation("Stash Pop", () => window.electronAPI.stash.pop(0));
          await Promise.all([refreshStatus(), loadGraph()]);
        },
      },

      // Dialogs
      {
        id: "dialog:commit",
        label: t("commandPalette.openCommitDialog"),
        category: t("commandPalette.categoryDialogs"),
        shortcut: "Ctrl+K",
        needsRepo: true,
        action: () => {
          // Dispatch custom event that Toolbar listens for
          window.dispatchEvent(new CustomEvent("command-palette:open-commit"));
        },
      },
      {
        id: "dialog:stash-manager",
        label: t("commandPalette.manageStashes"),
        category: t("commandPalette.categoryDialogs"),
        needsRepo: true,
        action: () => openDialogWindow({ dialog: "StashDialog" }),
      },
      {
        id: "dialog:remotes",
        label: t("commandPalette.manageRemotes"),
        category: t("commandPalette.categoryDialogs"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-remotes"));
        },
      },
      {
        id: "dialog:search",
        label: t("commandPalette.searchCommits"),
        category: t("commandPalette.categoryDialogs"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-search"));
        },
      },
      {
        id: "dialog:settings",
        label: t("commandPalette.openSettings"),
        category: t("commandPalette.categorySettings"),
        shortcut: "Ctrl+,",
        action: () => openDialogWindow({ dialog: "SettingsDialog" }),
      },
      {
        id: "dialog:stale-branches",
        label: t("commandPalette.staleBranches"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openStaleBranchesDialog(),
      },
      {
        id: "dialog:gitignore",
        label: t("commandPalette.gitignoreEditor"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openGitignoreDialog(),
      },
      {
        id: "dialog:grep",
        label: t("commandPalette.codeSearchGrep"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openGrepDialog(),
        shortcut: "Ctrl+Shift+F",
      },
      {
        id: "dialog:branch-diff",
        label: t("commandPalette.branchDiffComparison"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openBranchDiffDialog(),
      },
      {
        id: "dialog:branch-compare",
        label: t("commandPalette.branchCommitRangeCompare"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openBranchCompareDialog(),
      },
      {
        id: "dialog:hooks",
        label: t("commandPalette.gitHooksManager"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openHooksDialog(),
      },
      {
        id: "dialog:undo",
        label: t("commandPalette.undoGitOps"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openUndoDialog(),
      },
      {
        id: "dialog:ci-status",
        label: t("commandPalette.cicdPipelineStatus"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openCIStatusDialog(),
      },
      {
        id: "dialog:gist",
        label: t("commandPalette.createGist"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openGistDialog(),
      },
      {
        id: "dialog:advanced-stats",
        label: t("commandPalette.advancedStats"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => openAdvancedStatsDialog(),
      },
      {
        id: "dialog:ssh",
        label: t("commandPalette.sshKeyManager"),
        category: t("commandPalette.categoryTools"),
        action: () => openSshDialog(),
      },
      {
        id: "dialog:reflog",
        label: t("commandPalette.gitReflog"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-reflog"));
        },
      },

      // New tools
      {
        id: "tool:bisect",
        label: t("commandPalette.gitBisect"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-bisect"));
        },
      },
      {
        id: "tool:worktrees",
        label: t("commandPalette.manageWorktrees"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-worktrees"));
        },
      },
      {
        id: "tool:patch-apply",
        label: t("commandPalette.applyPatch"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-patch-apply"));
        },
      },
      {
        id: "tool:shortcuts",
        label: t("commandPalette.keyboardShortcuts"),
        category: t("commandPalette.categoryHelp"),
        shortcut: "?",
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-shortcuts"));
        },
      },
      {
        id: "tool:submodules",
        label: t("commandPalette.manageSubmodules"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-submodules"));
        },
      },
      {
        id: "tool:lfs",
        label: t("commandPalette.gitLfs"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-lfs"));
        },
      },
      {
        id: "tool:pr",
        label: t("commandPalette.pullRequestsMergeRequests"),
        category: t("commandPalette.categoryTools"),
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-pr"));
        },
      },

      // View
      {
        id: "view:toggle-theme",
        label: t("commandPalette.toggleTheme"),
        category: t("commandPalette.categoryView"),
        action: () => toggleTheme(),
      },
      {
        id: "view:about",
        label: t("commandPalette.aboutGitSmith"),
        category: t("commandPalette.categoryHelp"),
        action: () => openAboutDialog(),
      },
    ];
  }, [t]);

  const filtered = useMemo(() => {
    const available = commands.filter((c) => !c.needsRepo || hasRepo);
    if (!query.trim()) return available;
    const q = query.toLowerCase();
    const terms = q.split(/\s+/);
    return available
      .map((cmd) => {
        const text = `${cmd.category} ${cmd.label}`.toLowerCase();
        const score = terms.reduce((acc, term) => {
          if (!text.includes(term)) return -1;
          return acc + (cmd.label.toLowerCase().startsWith(term) ? 2 : 1);
        }, 0);
        return { cmd, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd);
  }, [commands, query, hasRepo]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: CommandEntry) => {
      onClose();
      requestAnimationFrame(() => cmd.action());
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, executeCommand, onClose]
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(2px)",
        animation: "fade-in 0.1s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "90vw",
          maxHeight: "min(460px, 70vh)",
          borderRadius: 10,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "palette-in 0.12s ease-out",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            gap: 8,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.placeholder")}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              padding: "2px 6px",
              borderRadius: 3,
              background: "var(--surface-3)",
              flexShrink: 0,
            }}
          >
            ESC
          </span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {t("commandPalette.noCommandsFound")}
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "7px 12px",
                  border: "none",
                  background: i === selectedIndex ? "var(--accent-dim)" : "transparent",
                  color: i === selectedIndex ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                  fontFamily: "inherit",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    minWidth: 64,
                    flexShrink: 0,
                  }}
                >
                  {cmd.category}
                </span>
                <span style={{ flex: 1 }}>{cmd.label}</span>
                {cmd.shortcut && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: "var(--surface-3)",
                    }}
                  >
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes palette-in { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};
