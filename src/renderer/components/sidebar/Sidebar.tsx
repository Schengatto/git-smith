import React, { useEffect, useState } from "react";
import { useRepoStore } from "../../store/repo-store";
import { ContextMenu, ContextMenuEntry } from "../layout/ContextMenu";
import {
  CreateBranchDialog,
  DeleteBranchDialog,
  RenameBranchDialog,
  MergeBranchDialog,
  RebaseBranchDialog,
} from "../dialogs/BranchDialogs";
import { CreateStashDialog } from "../dialogs/StashDialog";
import { InteractiveRebaseDialog } from "../dialogs/InteractiveRebaseDialog";
import type { BranchInfo, StashEntry } from "../../../shared/git-types";

const IconGitBranch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const IconCloud = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const IconArchive = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

type DialogState =
  | { type: "none" }
  | { type: "create"; startPoint?: string }
  | { type: "delete"; branch: string }
  | { type: "rename"; branch: string }
  | { type: "merge"; branch: string }
  | { type: "rebase"; onto: string }
  | { type: "interactive-rebase"; onto: string }
  | { type: "stash-create" };

type CtxMenu =
  | { x: number; y: number; kind: "branch"; branch: BranchInfo }
  | { x: number; y: number; kind: "stash"; stash: StashEntry }
  | null;

export const Sidebar: React.FC = () => {
  const { repo } = useRepoStore();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    local: true,
    remote: true,
    stashes: false,
  });
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!repo) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path, repo?.currentBranch]);

  const loadData = async () => {
    try {
      const [branchList, stashList] = await Promise.all([
        window.electronAPI.branch.list(),
        window.electronAPI.stash.list(),
      ]);
      setBranches(branchList);
      setStashes(stashList);
    } catch {}
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((s) => ({ ...s, [section]: !s[section] }));
  };

  const closeDialog = () => {
    setDialog({ type: "none" });
    loadData();
  };

  if (!repo) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div className="empty-state-icon">
          <IconGitBranch />
        </div>
        <span>Open a repository</span>
      </div>
    );
  }

  const localBranches = branches.filter((b) => !b.remote);
  const remoteBranches = branches.filter((b) => b.remote);

  const buildBranchContextMenu = (branch: BranchInfo): ContextMenuEntry[] => {
    const items: ContextMenuEntry[] = [];

    if (!branch.current) {
      items.push({
        label: "Checkout",
        onClick: async () => {
          await window.electronAPI.branch.checkout(branch.name);
          useRepoStore.getState().refreshInfo();
          loadData();
        },
      });
    }

    if (!branch.remote) {
      items.push({
        label: "Create Branch From Here",
        onClick: () => setDialog({ type: "create", startPoint: branch.name }),
      });

      if (!branch.current) {
        items.push({
          label: "Merge into Current",
          onClick: () => setDialog({ type: "merge", branch: branch.name }),
        });
        items.push({
          label: "Rebase Current onto This",
          onClick: () => setDialog({ type: "rebase", onto: branch.name }),
        });
        items.push({
          label: "Interactive Rebase onto This",
          onClick: () => setDialog({ type: "interactive-rebase", onto: branch.name }),
        });
      }

      items.push({ divider: true });

      items.push({
        label: "Rename",
        onClick: () => setDialog({ type: "rename", branch: branch.name }),
      });

      if (!branch.current) {
        items.push({
          label: "Delete",
          color: "var(--red)",
          onClick: () => setDialog({ type: "delete", branch: branch.name }),
        });
      }
    } else {
      items.push({
        label: "Create Local Branch",
        onClick: () => setDialog({ type: "create", startPoint: branch.name }),
      });
    }

    return items;
  };

  const buildStashContextMenu = (stash: StashEntry): ContextMenuEntry[] => [
    {
      label: "Pop",
      onClick: async () => {
        await window.electronAPI.stash.pop(stash.index);
        await loadData();
        useRepoStore.getState().refreshStatus();
      },
    },
    {
      label: "Apply",
      onClick: async () => {
        await window.electronAPI.stash.apply(stash.index);
        await loadData();
        useRepoStore.getState().refreshStatus();
      },
    },
    { divider: true },
    {
      label: "Drop",
      color: "var(--red)",
      onClick: async () => {
        await window.electronAPI.stash.drop(stash.index);
        await loadData();
      },
    },
  ];

  return (
    <div
      className="h-full overflow-y-auto select-none"
      style={{ paddingTop: 4, paddingBottom: 8 }}
    >
      {/* Local Branches */}
      <SectionHeader
        icon={<IconGitBranch />}
        label="Local"
        count={localBranches.length}
        expanded={expandedSections.local}
        onClick={() => toggleSection("local")}
        action={
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ type: "create" });
            }}
            title="Create branch"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 2,
              borderRadius: 4,
              display: "flex",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <IconPlus />
          </button>
        }
      />
      {expandedSections.local && (
        <div>
          {localBranches.map((b) => (
            <BranchItem
              key={b.name}
              branch={b}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, kind: "branch", branch: b });
              }}
            />
          ))}
        </div>
      )}

      {/* Remote Branches */}
      <SectionHeader
        icon={<IconCloud />}
        label="Remote"
        count={remoteBranches.length}
        expanded={expandedSections.remote}
        onClick={() => toggleSection("remote")}
      />
      {expandedSections.remote && (
        <div>
          {remoteBranches.map((b) => (
            <BranchItem
              key={b.name}
              branch={b}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, kind: "branch", branch: b });
              }}
            />
          ))}
        </div>
      )}

      {/* Stashes */}
      <SectionHeader
        icon={<IconArchive />}
        label="Stashes"
        count={stashes.length}
        expanded={expandedSections.stashes}
        onClick={() => toggleSection("stashes")}
        action={
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ type: "stash-create" });
            }}
            title="Stash changes"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 2,
              borderRadius: 4,
              display: "flex",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <IconPlus />
          </button>
        }
      />
      {expandedSections.stashes && (
        <div>
          {stashes.map((s) => (
            <div
              key={s.index}
              className="list-item"
              style={{ paddingLeft: 28, fontSize: 12 }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, kind: "stash", stash: s });
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                stash@&#123;{s.index}&#125;
              </span>{" "}
              <span style={{ color: "var(--text-secondary)" }}>{s.message}</span>
            </div>
          ))}
          {stashes.length === 0 && (
            <div className="text-xs px-3 py-2" style={{ color: "var(--text-muted)", paddingLeft: 28 }}>
              No stashes
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.kind === "branch"
              ? buildBranchContextMenu(ctxMenu.branch)
              : buildStashContextMenu(ctxMenu.stash)
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Dialogs */}
      <CreateBranchDialog
        open={dialog.type === "create"}
        onClose={closeDialog}
        startPoint={dialog.type === "create" ? dialog.startPoint : undefined}
      />
      <DeleteBranchDialog
        open={dialog.type === "delete"}
        onClose={closeDialog}
        branchName={dialog.type === "delete" ? dialog.branch : ""}
      />
      <RenameBranchDialog
        open={dialog.type === "rename"}
        onClose={closeDialog}
        branchName={dialog.type === "rename" ? dialog.branch : ""}
      />
      <MergeBranchDialog
        open={dialog.type === "merge"}
        onClose={closeDialog}
        branchName={dialog.type === "merge" ? dialog.branch : ""}
      />
      <RebaseBranchDialog
        open={dialog.type === "rebase"}
        onClose={closeDialog}
        onto={dialog.type === "rebase" ? dialog.onto : ""}
      />
      <InteractiveRebaseDialog
        open={dialog.type === "interactive-rebase"}
        onClose={closeDialog}
        onto={dialog.type === "interactive-rebase" ? dialog.onto : ""}
      />
      <CreateStashDialog
        open={dialog.type === "stash-create"}
        onClose={closeDialog}
      />
    </div>
  );
};

/* ---------- Sub-components ---------- */

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
  action?: React.ReactNode;
}> = ({ icon, label, count, expanded, onClick, action }) => (
  <div className="section-header" onClick={onClick}>
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="currentColor"
      style={{
        transition: "transform 0.15s ease",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <path d="M2 1l4 3-4 3z" />
    </svg>
    {icon}
    {label}
    <span
      className="ml-auto rounded-full text-center"
      style={{
        fontSize: 10,
        minWidth: 18,
        padding: "0 5px",
        lineHeight: "16px",
        background: "var(--surface-3)",
        color: "var(--text-muted)",
      }}
    >
      {count}
    </span>
    {action && (
      <span style={{ marginLeft: 4 }} onClick={(e) => e.stopPropagation()}>
        {action}
      </span>
    )}
  </div>
);

const BranchItem: React.FC<{
  branch: BranchInfo;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ branch, onContextMenu }) => {
  const handleCheckout = async () => {
    if (branch.current) return;
    try {
      await window.electronAPI.branch.checkout(branch.name);
      useRepoStore.getState().refreshInfo();
    } catch {}
  };

  return (
    <div
      className={`list-item ${branch.current ? "list-item-active" : ""}`}
      style={{ paddingLeft: 28, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
      onDoubleClick={handleCheckout}
      onContextMenu={onContextMenu}
      title={branch.name}
    >
      {branch.current && (
        <span
          className="inline-block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: "var(--accent)",
            flexShrink: 0,
          }}
        />
      )}
      <span className="truncate" style={{ flex: 1, minWidth: 0 }}>{branch.name}</span>
      {branch.ahead != null && branch.ahead > 0 && (
        <span style={{ fontSize: 10, color: "var(--green)", flexShrink: 0 }} title={`${branch.ahead} ahead`}>
          {"\u2191"}{branch.ahead}
        </span>
      )}
      {branch.behind != null && branch.behind > 0 && (
        <span style={{ fontSize: 10, color: "var(--peach)", flexShrink: 0 }} title={`${branch.behind} behind`}>
          {"\u2193"}{branch.behind}
        </span>
      )}
    </div>
  );
};
