import React, { useEffect, useMemo, useState } from "react";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useUIStore } from "../../store/ui-store";
import { ContextMenu, ContextMenuEntry } from "../layout/ContextMenu";
import {
  CreateBranchDialog,
  DeleteBranchDialog,
  RenameBranchDialog,
  MergeBranchDialog,
  RebaseBranchDialog,
} from "../dialogs/BranchDialogs";
import { CreateStashDialog } from "../dialogs/StashDialog";
import { CreateTagDialog } from "../dialogs/TagDialog";
import { ModalDialog, DialogActions } from "../dialogs/ModalDialog";
import { AddSubmoduleDialog } from "../dialogs/AddSubmoduleDialog";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import { CheckoutDialog } from "../dialogs/CheckoutDialog";
import { openDialogWindow } from "../../utils/open-dialog";
import type { BranchInfo, StashEntry, TagInfo } from "../../../shared/git-types";

/* ---------- Icons ---------- */

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

const IconTag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconSubmodule = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
  </svg>
);

const IconArchive = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ---------- Types ---------- */

interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  hash: string;
}

type DialogState =
  | { type: "none" }
  | { type: "create-branch"; startPoint?: string }
  | { type: "delete-branch"; branch: string }
  | { type: "delete-remote-branch"; branch: string }
  | { type: "rename-branch"; branch: string }
  | { type: "merge-branch"; branch: string }
  | { type: "rebase"; onto: string }
  | { type: "create-tag" }
  | { type: "delete-tag"; tag: string }
  | { type: "add-submodule" }
  | { type: "create-stash" }
  | { type: "checkout"; branch: string };

type CtxMenu =
  | { x: number; y: number; kind: "branch"; branch: BranchInfo }
  | { x: number; y: number; kind: "tag"; tag: TagInfo }
  | { x: number; y: number; kind: "stash"; stash: StashEntry }
  | { x: number; y: number; kind: "section"; items: ContextMenuEntry[] }
  | null;

/* ---------- Main Component ---------- */

export const Sidebar: React.FC = () => {
  const { repo } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const showToast = useUIStore((s) => s.showToast);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    branches: true,
    remotes: true,
    tags: true,
    submodules: false,
    stashes: false,
  });
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [deleteTagRemote, setDeleteTagRemote] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);

  // Reload sidebar data when repo or branch changes; loadData is local and stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!repo) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path, repo?.currentBranch]);

  const loadData = async () => {
    try {
      const [branchList, tagList, submoduleList, stashList] = await Promise.all([
        window.electronAPI.branch.list(),
        window.electronAPI.tag.list(),
        window.electronAPI.submodule.list(),
        window.electronAPI.stash.list(),
      ]);
      setBranches(branchList);
      setTags(tagList);
      setSubmodules(submoduleList);
      setStashes(stashList);
    } catch (err: unknown) {
      showToast(`Failed to load sidebar data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((s) => ({ ...s, [section]: !s[section] }));
  };

  const closeDialog = () => {
    setDialog({ type: "none" });
    loadData();
  };

  // Filter data based on search query
  const q = searchQuery.toLowerCase();
  const localBranches = useMemo(
    () => branches.filter((b) => !b.remote && (!q || b.name.toLowerCase().includes(q))),
    [branches, q],
  );
  const remoteBranches = useMemo(
    () => branches.filter((b) => b.remote && (!q || b.name.toLowerCase().includes(q))),
    [branches, q],
  );
  const filteredTags = useMemo(
    () => tags.filter((t) => !q || t.name.toLowerCase().includes(q)),
    [tags, q],
  );
  const filteredSubmodules = useMemo(
    () => submodules.filter((s) => !q || s.name.toLowerCase().includes(q) || s.path.toLowerCase().includes(q)),
    [submodules, q],
  );
  const filteredStashes = useMemo(
    () => stashes.filter((s) => !q || s.message.toLowerCase().includes(q)),
    [stashes, q],
  );

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

  /* ---------- Section header context menus ---------- */

  const showSectionCtx = (e: React.MouseEvent, items: ContextMenuEntry[]) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: "section", items });
  };

  const branchesSectionCtx = (e: React.MouseEvent) =>
    showSectionCtx(e, [
      { label: "Create New Branch...", onClick: () => setDialog({ type: "create-branch" }) },
    ]);

  const tagsSectionCtx = (e: React.MouseEvent) =>
    showSectionCtx(e, [
      { label: "Create New Tag...", onClick: () => setDialog({ type: "create-tag" }) },
    ]);

  const submodulesSectionCtx = (e: React.MouseEvent) =>
    showSectionCtx(e, [
      { label: "Add Submodule...", onClick: () => setDialog({ type: "add-submodule" }) },
      {
        label: "Update All (init)",
        onClick: async () => {
          try { await window.electronAPI.submodule.update(true); loadData(); } catch {}
        },
      },
      {
        label: "Sync All",
        onClick: async () => {
          try { await window.electronAPI.submodule.sync(); loadData(); } catch {}
        },
      },
    ]);

  const stashesSectionCtx = (e: React.MouseEvent) =>
    showSectionCtx(e, [
      { label: "Stash Changes...", onClick: () => setDialog({ type: "create-stash" }) },
    ]);

  /* ---------- Item context menu builders ---------- */

  const buildBranchContextMenu = (branch: BranchInfo): ContextMenuEntry[] => {
    const items: ContextMenuEntry[] = [];

    if (!branch.current) {
      items.push({
        label: "Checkout",
        onClick: () => setDialog({ type: "checkout", branch: branch.name }),
      });
    }

    if (!branch.remote) {
      items.push({
        label: "Create Branch From Here",
        onClick: () => setDialog({ type: "create-branch", startPoint: branch.name }),
      });

      if (!branch.current) {
        items.push({
          label: "Merge into Current",
          onClick: () => setDialog({ type: "merge-branch", branch: branch.name }),
        });
        items.push({
          label: "Rebase Current onto This",
          onClick: () => setDialog({ type: "rebase", onto: branch.name }),
        });
        items.push({
          label: "Interactive Rebase onto This",
          onClick: () => openDialogWindow({ dialog: "InteractiveRebaseDialog", data: { onto: branch.name } }),
        });
      }

      items.push({ divider: true });

      items.push({
        label: "Rename",
        onClick: () => setDialog({ type: "rename-branch", branch: branch.name }),
      });

      if (!branch.current) {
        items.push({
          label: "Delete",
          color: "var(--red)",
          onClick: () => setDialog({ type: "delete-branch", branch: branch.name }),
        });
      }
    } else {
      items.push({
        label: "Create Local Branch",
        onClick: () => setDialog({ type: "create-branch", startPoint: branch.name }),
      });
      items.push({ divider: true });
      items.push({
        label: "Delete Remote Branch",
        color: "var(--red)",
        onClick: () => setDialog({ type: "delete-remote-branch", branch: branch.name }),
      });
    }

    return items;
  };

  const buildTagContextMenu = (tag: TagInfo): ContextMenuEntry[] => [
    {
      label: "Push to Remote",
      onClick: async () => {
        await runGitOperation("Push Tag", () => window.electronAPI.tag.push(tag.name));
        await loadGraph();
        loadData();
      },
    },
    { divider: true },
    {
      label: "Delete",
      color: "var(--red)",
      onClick: () => setDialog({ type: "delete-tag", tag: tag.name }),
    },
  ];

  const buildStashContextMenu = (stash: StashEntry): ContextMenuEntry[] => [
    {
      label: "Pop",
      onClick: async () => {
        await runGitOperation("Stash Pop", () => window.electronAPI.stash.pop(stash.index));
        await Promise.all([loadData(), loadGraph(), useRepoStore.getState().refreshStatus()]);
      },
    },
    {
      label: "Apply",
      onClick: async () => {
        await runGitOperation("Stash Apply", () => window.electronAPI.stash.apply(stash.index));
        await Promise.all([loadData(), loadGraph(), useRepoStore.getState().refreshStatus()]);
      },
    },
    { divider: true },
    {
      label: "Drop",
      color: "var(--red)",
      onClick: async () => {
        await window.electronAPI.stash.drop(stash.index);
        await Promise.all([loadData(), loadGraph()]);
      },
    },
  ];

  const getCtxMenuItems = (): ContextMenuEntry[] => {
    if (!ctxMenu) return [];
    switch (ctxMenu.kind) {
      case "branch": return buildBranchContextMenu(ctxMenu.branch);
      case "tag": return buildTagContextMenu(ctxMenu.tag);
      case "stash": return buildStashContextMenu(ctxMenu.stash);
      case "section": return ctxMenu.items;
    }
  };

  return (
    <div className="h-full flex flex-col select-none">
      {/* Search Bar */}
      <div style={{
        padding: "6px 8px",
        borderBottom: "1px solid var(--surface-2)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--surface-1)",
          borderRadius: 4,
          padding: "4px 8px",
          border: "1px solid var(--surface-2)",
        }}>
          <span style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 12,
              width: "100%",
              padding: 0,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
                display: "flex",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto" style={{ paddingTop: 4, paddingBottom: 8 }}>

        {/* Branches (Local) */}
        <SectionHeader
          icon={<IconGitBranch />}
          label="Branches"
          count={localBranches.length}
          expanded={expandedSections.branches}
          onClick={() => toggleSection("branches")}
          onContextMenu={branchesSectionCtx}
        />
        {expandedSections.branches && (
          <div>
            {localBranches.map((b) => (
              <BranchItem
                key={b.name}
                branch={b}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, kind: "branch", branch: b });
                }}
                onCheckout={(name) => setDialog({ type: "checkout", branch: name })}
              />
            ))}
            {localBranches.length === 0 && (
              <EmptyMessage>{q ? "No matches" : "No local branches"}</EmptyMessage>
            )}
          </div>
        )}

        {/* Remotes */}
        <SectionHeader
          icon={<IconCloud />}
          label="Remotes"
          count={remoteBranches.length}
          expanded={expandedSections.remotes}
          onClick={() => toggleSection("remotes")}
        />
        {expandedSections.remotes && (
          <div>
            {remoteBranches.map((b) => (
              <BranchItem
                key={b.name}
                branch={b}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, kind: "branch", branch: b });
                }}
                onCheckout={(name) => setDialog({ type: "checkout", branch: name })}
              />
            ))}
            {remoteBranches.length === 0 && (
              <EmptyMessage>{q ? "No matches" : "No remote branches"}</EmptyMessage>
            )}
          </div>
        )}

        {/* Tags */}
        <SectionHeader
          icon={<IconTag />}
          label="Tags"
          count={filteredTags.length}
          expanded={expandedSections.tags}
          onClick={() => toggleSection("tags")}
          onContextMenu={tagsSectionCtx}
        />
        {expandedSections.tags && (
          <div>
            {filteredTags.map((t) => (
              <div
                key={t.name}
                className="list-item"
                style={{ paddingLeft: 28, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                title={t.annotation || t.name}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, kind: "tag", tag: t });
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--yellow)",
                    flexShrink: 0,
                  }}
                />
                <span className="truncate" style={{ flex: 1, minWidth: 0 }}>{t.name}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                  {t.hash.slice(0, 7)}
                </span>
              </div>
            ))}
            {filteredTags.length === 0 && (
              <EmptyMessage>{q ? "No matches" : "No tags"}</EmptyMessage>
            )}
          </div>
        )}

        {/* Submodules */}
        <SectionHeader
          icon={<IconSubmodule />}
          label="Submodules"
          count={filteredSubmodules.length}
          expanded={expandedSections.submodules}
          onClick={() => toggleSection("submodules")}
          onContextMenu={submodulesSectionCtx}
        />
        {expandedSections.submodules && (
          <div>
            {filteredSubmodules.map((s) => (
              <div
                key={s.path}
                className="list-item"
                style={{ paddingLeft: 28, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                title={`${s.path}\n${s.url}`}
              >
                <span className="truncate" style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)" }}>
                  {s.path}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                  {s.hash.slice(0, 7)}
                </span>
              </div>
            ))}
            {filteredSubmodules.length === 0 && (
              <EmptyMessage>{q ? "No matches" : "No submodules"}</EmptyMessage>
            )}
          </div>
        )}

        {/* Stashes */}
        <SectionHeader
          icon={<IconArchive />}
          label="Stashes"
          count={filteredStashes.length}
          expanded={expandedSections.stashes}
          onClick={() => toggleSection("stashes")}
          onContextMenu={stashesSectionCtx}
        />
        {expandedSections.stashes && (
          <div>
            {filteredStashes.map((s) => (
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
            {filteredStashes.length === 0 && (
              <EmptyMessage>{q ? "No matches" : "No stashes"}</EmptyMessage>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getCtxMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Dialogs */}
      <CreateBranchDialog
        open={dialog.type === "create-branch"}
        onClose={closeDialog}
        startPoint={dialog.type === "create-branch" ? dialog.startPoint : undefined}
      />
      <DeleteBranchDialog
        open={dialog.type === "delete-branch"}
        onClose={closeDialog}
        branchName={dialog.type === "delete-branch" ? dialog.branch : ""}
      />
      <RenameBranchDialog
        open={dialog.type === "rename-branch"}
        onClose={closeDialog}
        branchName={dialog.type === "rename-branch" ? dialog.branch : ""}
      />
      <MergeBranchDialog
        open={dialog.type === "merge-branch"}
        onClose={closeDialog}
        branchName={dialog.type === "merge-branch" ? dialog.branch : ""}
      />
      <RebaseBranchDialog
        open={dialog.type === "rebase"}
        onClose={closeDialog}
        onto={dialog.type === "rebase" ? dialog.onto : ""}
      />
      <CreateTagDialog
        open={dialog.type === "create-tag"}
        onClose={closeDialog}
        commitHash={repo.headCommit}
        commitSubject={`HEAD (${repo.currentBranch})`}
      />
      <AddSubmoduleDialog
        open={dialog.type === "add-submodule"}
        onClose={closeDialog}
      />
      <CreateStashDialog
        open={dialog.type === "create-stash"}
        onClose={closeDialog}
      />
      <CheckoutDialog
        open={dialog.type === "checkout"}
        onClose={closeDialog}
        branchName={dialog.type === "checkout" ? dialog.branch : undefined}
      />

      {/* Delete remote branch confirmation */}
      <ModalDialog
        open={dialog.type === "delete-remote-branch"}
        title="Delete Remote Branch"
        onClose={closeDialog}
        width={380}
      >
        <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
          Are you sure you want to delete remote branch &quot;{dialog.type === "delete-remote-branch" ? dialog.branch : ""}&quot;?
          This will remove it from the remote server.
        </p>
        <DialogActions
          onCancel={closeDialog}
          onConfirm={async () => {
            if (dialog.type !== "delete-remote-branch") return;
            try {
              // branch.name is like "origin/feature" — split into remote + branch
              const fullName = dialog.branch;
              const slashIdx = fullName.indexOf("/");
              const remote = fullName.substring(0, slashIdx);
              const branch = fullName.substring(slashIdx + 1);
              await runGitOperation("Delete Remote Branch", () => window.electronAPI.branch.deleteRemote(remote, branch));
              await loadGraph();
              loadData();
            } catch (err) {
              if (err instanceof GitOperationCancelledError) return;
              alert(`Failed to delete remote branch: ${err instanceof Error ? err.message : err}`);
            }
            setDialog({ type: "none" });
          }}
          confirmLabel="Delete"
          confirmColor="var(--red)"
        />
      </ModalDialog>

      {/* Delete tag confirmation */}
      <ModalDialog
        open={dialog.type === "delete-tag"}
        title="Delete Tag"
        onClose={() => { closeDialog(); setDeleteTagRemote(false); }}
        width={380}
      >
        <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
          Are you sure you want to delete tag &quot;{dialog.type === "delete-tag" ? dialog.tag : ""}&quot;?
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
          <input type="checkbox" checked={deleteTagRemote} onChange={(e) => setDeleteTagRemote(e.target.checked)} />
          Delete tag from remote
        </label>
        <DialogActions
          onCancel={() => { closeDialog(); setDeleteTagRemote(false); }}
          onConfirm={async () => {
            if (dialog.type !== "delete-tag") return;
            try {
              await window.electronAPI.tag.delete(dialog.tag);
              if (deleteTagRemote) {
                await window.electronAPI.tag.deleteRemote(dialog.tag);
              }
              await loadGraph();
              loadData();
            } catch (err) {
              if (err instanceof GitOperationCancelledError) return;
              alert(`Failed to delete tag: ${err instanceof Error ? err.message : err}`);
            }
            setDialog({ type: "none" });
            setDeleteTagRemote(false);
          }}
          confirmLabel="Delete"
          confirmColor="var(--red)"
        />
      </ModalDialog>
    </div>
  );
};

/* ---------- Sub-components ---------- */

const EmptyMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs px-3 py-2" style={{ color: "var(--text-muted)", paddingLeft: 28 }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ icon, label, count, expanded, onClick, onContextMenu }) => (
  <div className="section-header" onClick={onClick} onContextMenu={onContextMenu}>
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
  </div>
);

const BranchItem: React.FC<{
  branch: BranchInfo;
  onContextMenu: (e: React.MouseEvent) => void;
  onCheckout: (branchName: string) => void;
}> = ({ branch, onContextMenu, onCheckout }) => {
  const handleCheckout = () => {
    if (branch.current) return;
    onCheckout(branch.name);
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
