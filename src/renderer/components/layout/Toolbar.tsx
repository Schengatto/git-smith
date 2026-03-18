import React, { useState, useEffect, useRef } from "react";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useUIStore } from "../../store/ui-store";
import { useAccountStore } from "../../store/account-store";
import { DropdownButton, DropdownEntry } from "./DropdownButton";
import { CommitDialog } from "../commit/CommitDialog";
import { RemoteDialog } from "../dialogs/RemoteDialog";
import { SetUpstreamDialog } from "../dialogs/SetUpstreamDialog";
import { runGitOperation, useGitOperationStore, GitOperationCancelledError } from "../../store/git-operation-store";
import { openDialogWindow } from "../../utils/open-dialog";

const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconArrowDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const IconArrowUp = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconMerge = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 21V9a9 9 0 0 0 9 9" />
  </svg>
);

const IconRebase = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="12" r="3" />
    <line x1="6" y1="9" x2="6" y2="15" />
    <path d="M9 6h6a3 3 0 0 1 3 3" />
  </svg>
);

const IconPrune = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconGlobe = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconCommit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="1.05" y1="12" x2="7" y2="12" />
    <line x1="17.01" y1="12" x2="22.96" y2="12" />
  </svg>
);

const IconStash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconClose = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function repoName(path: string): string {
  const segments = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

const RepoSelector: React.FC = () => {
  const { repo, recentRepos, openRepo, closeRepo, openRepoDialog } = useRepoStore();
  const { openCloneDialog } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!repo) return null;

  return (
    <div ref={ref} className="relative">
      <button
        className="toolbar-btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          maxWidth: 260,
          gap: 6,
          ...(open ? { background: "var(--surface-3)", color: "var(--text-primary)" } : {}),
        }}
        title={repo.path}
      >
        <IconFolder />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {repoName(repo.path)}
        </span>
        <IconChevronDown />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 300,
            maxWidth: 420,
            maxHeight: 400,
            overflowY: "auto",
            padding: "4px 0",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
            animation: "dropdown-in 0.12s ease-out",
          }}
        >
          {/* Current repo header */}
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Current Repository
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "var(--surface-3)",
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          >
            <IconFolder />
            <span className="flex flex-col min-w-0 flex-1">
              <span style={{ fontWeight: 600 }}>{repoName(repo.path)}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.path}</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); closeRepo(); }}
              style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4 }}
              title="Close repository"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <IconClose />
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }} />

          {/* Recent repos */}
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Recent Repositories
          </div>
          {recentRepos.filter((r) => r !== repo.path).length === 0 ? (
            <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
              No other recent repositories
            </div>
          ) : (
            recentRepos
              .filter((r) => r !== repo.path)
              .map((r) => (
                <button
                  key={r}
                  onClick={() => { setOpen(false); openRepo(r); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}><IconFolder /></span>
                  <span className="flex flex-col min-w-0">
                    <span>{repoName(r)}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
                  </span>
                </button>
              ))
          )}

          {/* Divider */}
          <div style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }} />

          {/* Actions */}
          <button
            onClick={() => { setOpen(false); openRepoDialog(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "6px 12px", border: "none", background: "transparent",
              color: "var(--text-primary)", fontSize: 12, textAlign: "left", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}><IconFolder /></span>
            Open...
          </button>
          <button
            onClick={() => { setOpen(false); openCloneDialog(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "6px 12px", border: "none", background: "transparent",
              color: "var(--text-primary)", fontSize: 12, textAlign: "left", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}><IconDownload /></span>
            Clone...
          </button>
        </div>
      )}
    </div>
  );
};

const IconUser = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const AccountSelector: React.FC = () => {
  const { repo } = useRepoStore();
  const { accounts, currentAccount, loadAccounts, loadCurrentAccount, setAccountForRepo, setDefaultAccount } = useAccountStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (repo?.path) loadCurrentAccount(repo.path);
  }, [repo?.path]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!repo || accounts.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        className="toolbar-btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          gap: 5,
          maxWidth: 180,
          ...(open ? { background: "var(--surface-3)", color: "var(--text-primary)" } : {}),
        }}
        title={currentAccount ? `${currentAccount.name} <${currentAccount.email}>` : "No account assigned"}
      >
        <IconUser />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
          {currentAccount?.label || "No account"}
        </span>
        <IconChevronDown />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 260,
            maxWidth: 360,
            padding: "4px 0",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
            animation: "dropdown-in 0.12s ease-out",
          }}
        >
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Set for this repo
          </div>

          {/* None option */}
          <div
            onClick={() => { setAccountForRepo(repo.path, null); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", cursor: "pointer", fontSize: 12,
              color: !currentAccount ? "var(--accent)" : "var(--text-secondary)",
              background: !currentAccount ? "var(--accent-dim)" : "transparent",
            }}
            onMouseEnter={(e) => { if (currentAccount) e.currentTarget.style.background = "var(--surface-3)"; }}
            onMouseLeave={(e) => { if (currentAccount) e.currentTarget.style.background = "transparent"; }}
          >
            None (use git config default)
          </div>

          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => { setAccountForRepo(repo.path, account.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", cursor: "pointer",
                color: currentAccount?.id === account.id ? "var(--accent)" : "var(--text-primary)",
                background: currentAccount?.id === account.id ? "var(--accent-dim)" : "transparent",
              }}
              onMouseEnter={(e) => { if (currentAccount?.id !== account.id) e.currentTarget.style.background = "var(--surface-3)"; }}
              onMouseLeave={(e) => { if (currentAccount?.id !== account.id) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{account.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{account.name} &lt;{account.email}&gt;</div>
              </div>
            </div>
          ))}

          {/* Set as global default */}
          <div style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }} />
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Set as global default
          </div>
          {accounts.map((account) => (
            <div
              key={`global-${account.id}`}
              onClick={() => { setDefaultAccount(account.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 12px", cursor: "pointer", fontSize: 11,
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <IconGlobe /> {account.label}
            </div>
          ))}

          {/* Manage accounts */}
          <div style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }} />
          <div
            onClick={() => { openDialogWindow({ dialog: "SettingsDialog" }); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "var(--accent)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Manage accounts...
          </div>
        </div>
      )}
    </div>
  );
};

export const Toolbar: React.FC = () => {
  const { repo, status, refreshStatus, refreshInfo } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const [commitOpen, setCommitOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);

  const changedCount = status
    ? (status.staged.length || 0) +
      (status.unstaged.length || 0) +
      (status.untracked.length || 0)
    : 0;

  // Ctrl+K to open commit dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k" && repo) {
        e.preventDefault();
        setCommitOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [repo]);

  const handleRefresh = async () => {
    await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
  };

  const [forcePushConfirm, setForcePushConfirm] = useState(false);
  const [setUpstreamError, setSetUpstreamError] = useState<{
    suggestedRemote: string;
    suggestedBranch: string;
    force: boolean;
  } | null>(null);

  const handlePushError = (err: unknown, force: boolean): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("has no upstream branch")) {
      const match = msg.match(/git push --set-upstream (\S+) (\S+)/);
      // Close the operation log dialog — we handle the error with SetUpstreamDialog
      useGitOperationStore.getState().close();
      setSetUpstreamError({
        suggestedRemote: match?.[1] ?? "origin",
        suggestedBranch: match?.[2] ?? (repo?.currentBranch ?? ""),
        force,
      });
      return true;
    }
    return false;
  };

  const pushItems: DropdownEntry[] = [
    {
      label: "Push",
      sublabel: "git push",
      icon: <IconArrowUp />,
      onClick: async () => {
        try {
          await runGitOperation("Push", () => window.electronAPI.remote.push());
          await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
        } catch (err) {
          if (err instanceof GitOperationCancelledError) return;
          handlePushError(err, false);
        }
      },
    },
    { divider: true },
    {
      label: "Force Push",
      sublabel: "git push --force (rewrites remote history!)",
      icon: <IconWarning />,
      onClick: () => setForcePushConfirm(true),
    },
  ];

  const pullItems: DropdownEntry[] = [
    {
      label: "Pull",
      sublabel: "Default strategy from git config",
      icon: <IconArrowDown />,
      onClick: async () => {
        await runGitOperation("Pull", () => window.electronAPI.remote.pull());
        await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      },
    },
    {
      label: "Pull (Merge)",
      sublabel: "git pull --no-rebase",
      icon: <IconMerge />,
      onClick: async () => {
        await runGitOperation("Pull (Merge)", () => window.electronAPI.remote.pullMerge());
        await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      },
    },
    {
      label: "Pull (Rebase)",
      sublabel: "git pull --rebase",
      icon: <IconRebase />,
      onClick: async () => {
        await runGitOperation("Pull (Rebase)", () => window.electronAPI.remote.pullRebase());
        await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      },
    },
  ];

  const handleStashQuick = async (opts?: { staged?: boolean }) => {
    try {
      await runGitOperation("Stash", () => window.electronAPI.stash.create(undefined, opts));
      await Promise.all([refreshStatus(), loadGraph()]);
    } catch { /* stash dialog will handle errors */ }
  };

  const handleStashPop = async () => {
    try {
      await runGitOperation("Stash Pop", () => window.electronAPI.stash.pop(0));
      await Promise.all([refreshStatus(), loadGraph()]);
    } catch { /* ignore */ }
  };

  const stashItems: DropdownEntry[] = [
    {
      label: "Stash",
      sublabel: "Stash all modified files",
      icon: <IconStash />,
      onClick: () => handleStashQuick(),
    },
    {
      label: "Stash staged",
      sublabel: "Stash only staged files",
      icon: <IconStash />,
      onClick: () => handleStashQuick({ staged: true }),
    },
    {
      label: "Stash pop",
      sublabel: "Restore the most recent stash",
      icon: <IconArrowDown />,
      onClick: handleStashPop,
    },
    { divider: true },
    {
      label: "Manage stashes...",
      sublabel: "View and manage all stashes",
      icon: <IconStash />,
      onClick: () => openDialogWindow({ dialog: "StashDialog" }),
    },
    {
      label: "Create a stash...",
      sublabel: "Stash with message and options",
      icon: <IconStash />,
      onClick: () => openDialogWindow({ dialog: "StashDialog" }),
    },
  ];

  const fetchItems: DropdownEntry[] = [
    {
      label: "Fetch",
      sublabel: "Fetch from default remote",
      icon: <IconDownload />,
      onClick: async () => {
        await runGitOperation("Fetch", () => window.electronAPI.remote.fetch());
        await Promise.all([refreshInfo(), loadGraph()]);
      },
    },
    {
      label: "Fetch All",
      sublabel: "git fetch --all",
      icon: <IconGlobe />,
      onClick: async () => {
        await runGitOperation("Fetch All", () => window.electronAPI.remote.fetchAll());
        await Promise.all([refreshInfo(), loadGraph()]);
      },
    },
    { divider: true },
    {
      label: "Fetch & Prune",
      sublabel: "git fetch --all --prune",
      icon: <IconPrune />,
      onClick: async () => {
        await runGitOperation("Fetch & Prune", () => window.electronAPI.remote.fetchPrune());
        await Promise.all([refreshInfo(), loadGraph()]);
      },
    },
  ];

  return (
    <div
      className="shrink-0 flex items-center px-2 gap-1 select-none"
      style={{
        height: 40,
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <RepoSelector />

          <div
            className="mx-1"
            style={{ width: 1, height: 18, background: "var(--border)" }}
          />
          <button onClick={handleRefresh} className="toolbar-btn" title="Refresh">
            <IconRefresh /> Refresh
          </button>

          <div
            className="mx-1"
            style={{ width: 1, height: 18, background: "var(--border)" }}
          />

          <DropdownButton
            icon={<IconDownload />}
            label="Fetch"
            items={fetchItems}
          />

          <DropdownButton
            icon={<IconArrowDown />}
            label="Pull"
            items={pullItems}
          />

          <div
            className="mx-1"
            style={{ width: 1, height: 18, background: "var(--border)" }}
          />

          <button
            onClick={() => setCommitOpen(true)}
            className="toolbar-btn"
            title="Commit (Ctrl+K)"
            style={
              changedCount > 0
                ? { color: "var(--peach)" }
                : undefined
            }
          >
            <IconCommit />
            Commit
            {changedCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "0 5px",
                  lineHeight: "16px",
                  borderRadius: 8,
                  background: "var(--peach)",
                  color: "var(--surface-0)",
                  minWidth: 18,
                  textAlign: "center",
                  display: "inline-block",
                }}
              >
                {changedCount}
              </span>
            )}
          </button>

          <DropdownButton
            icon={<IconArrowUp />}
            label="Push"
            items={pushItems}
          />

          <div
            className="mx-1"
            style={{ width: 1, height: 18, background: "var(--border)" }}
          />

          <DropdownButton
            icon={<IconStash />}
            label="Stash"
            items={stashItems}
          />

          <button
            onClick={() => setRemotesOpen(true)}
            className="toolbar-btn"
            title="Manage Remotes"
          >
            <IconGlobe /> Remotes
          </button>

          <div
            className="mx-1"
            style={{ width: 1, height: 18, background: "var(--border)" }}
          />

          <AccountSelector />

      <div className="flex-1" />

      <button
        onClick={() => openDialogWindow({ dialog: "SettingsDialog" })}
        className="toolbar-btn"
        title="Settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <ThemeToggle />

      <CommitDialog open={commitOpen} onClose={() => setCommitOpen(false)} />
      <RemoteDialog open={remotesOpen} onClose={() => setRemotesOpen(false)} />
      <SetUpstreamDialog
        open={!!setUpstreamError}
        onClose={() => setSetUpstreamError(null)}
        suggestedRemote={setUpstreamError?.suggestedRemote ?? "origin"}
        suggestedBranch={setUpstreamError?.suggestedBranch ?? ""}
        force={setUpstreamError?.force}
      />
      <ForcePushConfirmDialog
        open={forcePushConfirm}
        onClose={() => setForcePushConfirm(false)}
        onConfirm={async () => {
          try {
            await runGitOperation("Force Push", () => window.electronAPI.remote.push(undefined, undefined, true));
            await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
          } catch (err) {
            if (err instanceof GitOperationCancelledError) return;
            handlePushError(err, true);
          } finally {
            setForcePushConfirm(false);
          }
        }}
      />
    </div>
  );
};

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useUIStore();
  return (
    <button
      onClick={toggleTheme}
      className="toolbar-btn"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
};

const ForcePushConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        animation: "fade-in 0.12s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 420,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          animation: "modal-in 0.15s ease-out",
          overflow: "hidden",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--red-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Force Push</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>This action is destructive</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          Force pushing will <strong style={{ color: "var(--red)" }}>overwrite the remote branch history</strong>.
          Any commits pushed by other collaborators that are not in your local branch will be permanently lost.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: "8px 18px", borderRadius: 6, border: "none",
              background: "var(--red)", color: "#fff", fontSize: 12, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Pushing..." : "Force Push"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};
