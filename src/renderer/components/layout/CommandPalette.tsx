import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
        label: "Open Repository...",
        category: "Repository",
        shortcut: "Ctrl+O",
        action: () => openRepoDialog(),
      },
      {
        id: "repo:init",
        label: "Create New Repository...",
        category: "Repository",
        action: () => initRepo(),
      },
      {
        id: "repo:clone",
        label: "Clone Repository...",
        category: "Repository",
        action: () => openCloneDialog(),
      },
      {
        id: "repo:scan",
        label: "Scan for Repositories...",
        category: "Repository",
        action: () => openScanDialog(),
      },
      {
        id: "repo:close",
        label: "Close Repository",
        category: "Repository",
        needsRepo: true,
        action: () => closeRepo(),
      },
      {
        id: "repo:refresh",
        label: "Refresh",
        category: "Repository",
        shortcut: "F5",
        needsRepo: true,
        action: () => refresh(),
      },

      // Git Operations
      {
        id: "git:fetch",
        label: "Fetch",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch", () => window.electronAPI.remote.fetch());
          await refresh();
        },
      },
      {
        id: "git:fetch-all",
        label: "Fetch All",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch All", () => window.electronAPI.remote.fetchAll());
          await refresh();
        },
      },
      {
        id: "git:fetch-prune",
        label: "Fetch & Prune",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Fetch & Prune", () =>
            window.electronAPI.remote.fetchPrune()
          );
          await refresh();
        },
      },
      {
        id: "git:pull",
        label: "Pull",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull", () => window.electronAPI.remote.pull());
          await refresh();
        },
      },
      {
        id: "git:pull-rebase",
        label: "Pull (Rebase)",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull (Rebase)", () =>
            window.electronAPI.remote.pullRebase()
          );
          await refresh();
        },
      },
      {
        id: "git:pull-merge",
        label: "Pull (Merge)",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Pull (Merge)", () =>
            window.electronAPI.remote.pullMerge()
          );
          await refresh();
        },
      },
      {
        id: "git:push",
        label: "Push",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Push", () => window.electronAPI.remote.push());
          await refresh();
        },
      },
      {
        id: "git:stash",
        label: "Stash Changes",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Stash", () => window.electronAPI.stash.create());
          await Promise.all([refreshStatus(), loadGraph()]);
        },
      },
      {
        id: "git:stash-pop",
        label: "Stash Pop",
        category: "Git",
        needsRepo: true,
        action: async () => {
          await runGitOperation("Stash Pop", () => window.electronAPI.stash.pop(0));
          await Promise.all([refreshStatus(), loadGraph()]);
        },
      },

      // Dialogs
      {
        id: "dialog:commit",
        label: "Open Commit Dialog",
        category: "Dialogs",
        shortcut: "Ctrl+K",
        needsRepo: true,
        action: () => {
          // Dispatch custom event that Toolbar listens for
          window.dispatchEvent(new CustomEvent("command-palette:open-commit"));
        },
      },
      {
        id: "dialog:stash-manager",
        label: "Manage Stashes...",
        category: "Dialogs",
        needsRepo: true,
        action: () => openDialogWindow({ dialog: "StashDialog" }),
      },
      {
        id: "dialog:remotes",
        label: "Manage Remotes...",
        category: "Dialogs",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-remotes"));
        },
      },
      {
        id: "dialog:search",
        label: "Search Commits...",
        category: "Dialogs",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-search"));
        },
      },
      {
        id: "dialog:settings",
        label: "Open Settings...",
        category: "Settings",
        shortcut: "Ctrl+,",
        action: () => openDialogWindow({ dialog: "SettingsDialog" }),
      },
      {
        id: "dialog:stale-branches",
        label: "Stale Remote Branches...",
        category: "Tools",
        needsRepo: true,
        action: () => openStaleBranchesDialog(),
      },
      {
        id: "dialog:gitignore",
        label: ".gitignore Editor...",
        category: "Tools",
        needsRepo: true,
        action: () => openGitignoreDialog(),
      },
      {
        id: "dialog:grep",
        label: "Code Search (grep)...",
        category: "Tools",
        needsRepo: true,
        action: () => openGrepDialog(),
        shortcut: "Ctrl+Shift+F",
      },
      {
        id: "dialog:branch-diff",
        label: "Branch Diff Comparison...",
        category: "Tools",
        needsRepo: true,
        action: () => openBranchDiffDialog(),
      },
      {
        id: "dialog:branch-compare",
        label: "Branch Commit Range Compare...",
        category: "Tools",
        needsRepo: true,
        action: () => openBranchCompareDialog(),
      },
      {
        id: "dialog:hooks",
        label: "Git Hooks Manager...",
        category: "Tools",
        needsRepo: true,
        action: () => openHooksDialog(),
      },
      {
        id: "dialog:undo",
        label: "Undo Git Operations...",
        category: "Tools",
        needsRepo: true,
        action: () => openUndoDialog(),
      },
      {
        id: "dialog:ci-status",
        label: "CI/CD Pipeline Status...",
        category: "Tools",
        needsRepo: true,
        action: () => openCIStatusDialog(),
      },
      {
        id: "dialog:gist",
        label: "Create Gist...",
        category: "Tools",
        needsRepo: true,
        action: () => openGistDialog(),
      },
      {
        id: "dialog:advanced-stats",
        label: "Advanced Statistics...",
        category: "Tools",
        needsRepo: true,
        action: () => openAdvancedStatsDialog(),
      },
      {
        id: "dialog:ssh",
        label: "SSH Key Manager...",
        category: "Tools",
        action: () => openSshDialog(),
      },
      {
        id: "dialog:reflog",
        label: "Git Reflog...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-reflog"));
        },
      },

      // New tools
      {
        id: "tool:bisect",
        label: "Git Bisect...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-bisect"));
        },
      },
      {
        id: "tool:worktrees",
        label: "Manage Worktrees...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-worktrees"));
        },
      },
      {
        id: "tool:patch-apply",
        label: "Apply Patch...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-patch-apply"));
        },
      },
      {
        id: "tool:shortcuts",
        label: "Keyboard Shortcuts",
        category: "Help",
        shortcut: "?",
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-shortcuts"));
        },
      },
      {
        id: "tool:submodules",
        label: "Manage Submodules...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-submodules"));
        },
      },
      {
        id: "tool:lfs",
        label: "Git LFS...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-lfs"));
        },
      },
      {
        id: "tool:pr",
        label: "Pull Requests / Merge Requests...",
        category: "Tools",
        needsRepo: true,
        action: () => {
          window.dispatchEvent(new CustomEvent("command-palette:open-pr"));
        },
      },

      // View
      {
        id: "view:toggle-theme",
        label: "Toggle Dark/Light Theme",
        category: "View",
        action: () => toggleTheme(),
      },
      {
        id: "view:about",
        label: "About Git Expansion",
        category: "Help",
        action: () => openAboutDialog(),
      },
    ];
  }, []);

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
            placeholder="Type a command..."
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
              No commands found
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
                  color:
                    i === selectedIndex ? "var(--text-primary)" : "var(--text-secondary)",
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
