import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { ContextMenu, ContextMenuEntry } from "../layout/ContextMenu";
import { CherryPickDialog, CreateBranchDialog } from "../dialogs/BranchDialogs";
import { ResetDialog } from "../dialogs/ResetDialog";
import { CreateTagDialog } from "../dialogs/TagDialog";
import { CommitCompareDialog } from "../dialogs/CommitCompareDialog";
import { openDialogWindow } from "../../utils/open-dialog";
import { CheckoutDialog } from "../dialogs/CheckoutDialog";
import { MergeDialog } from "../dialogs/MergeDialog";
import { RebaseDialog } from "../dialogs/RebaseDialog";
import { ModalDialog, DialogActions } from "../dialogs/ModalDialog";
import type { GraphRow, BranchInfo, CommitInfo } from "../../../shared/git-types";
import { AiReviewDialog } from "../ai/AiReviewDialog";

const LANE_WIDTH = 16;
const ROW_HEIGHT = 30;
const DOT_RADIUS = 4;

const LANE_PALETTE = [
  "#89b4fa", "#a6e3a1", "#f9e2af", "#cba6f7", "#fab387",
  "#f38ba8", "#94e2d5", "#89dceb", "#f5c2e7", "#74c7ec",
  "#b4befe", "#eba0ac", "#a6adc8", "#f2cdcd", "#7f849c",
  "#9399b2",
];

const IconGitCommit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
    <circle cx="12" cy="12" r="4" />
    <line x1="1.05" y1="12" x2="7" y2="12" />
    <line x1="17.01" y1="12" x2="22.96" y2="12" />
  </svg>
);

export const CommitGraphPanel: React.FC = () => {
  const { repo } = useRepoStore();
  const {
    rows, loading, hasMore, loadGraph, loadMore, selectCommit, selectedCommit,
    branchFilter, setBranchFilter, branchVisibility, setBranchVisibility,
    restoreViewSettings, viewSettingsRestored,
  } = useGraphStore();

  useEffect(() => {
    if (!repo) return;
    const init = async () => {
      await restoreViewSettings();
      await loadGraph();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path]);

  // Reload graph when HEAD changes (but not on initial mount which is handled above)
  const prevHeadRef = useRef(repo?.headCommit);
  useEffect(() => {
    if (!repo || !viewSettingsRestored) return;
    if (prevHeadRef.current !== undefined && prevHeadRef.current !== repo.headCommit) {
      loadGraph();
    }
    prevHeadRef.current = repo.headCommit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.headCommit]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: GraphRow } | null>(null);
  const [cherryPickTarget, setCherryPickTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [createBranchFrom, setCreateBranchFrom] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [tagTarget, setTagTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<string | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);
  const [deleteTagRemote, setDeleteTagRemote] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{ refs: import("../../../shared/git-types").RefInfo[]; hash: string; subject: string } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [rebaseTarget, setRebaseTarget] = useState<{ onto: string; interactive?: boolean } | null>(null);
  const [compareTarget, setCompareTarget] = useState<{ commit1: CommitInfo; commit2: CommitInfo } | null>(null);
  const [aiReviewHash, setAiReviewHash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [branchFilterInput, setBranchFilterInput] = useState(branchFilter);
  const branchFilterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Branch visibility filter dropdown state
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [allBranches, setAllBranches] = useState<BranchInfo[]>([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [pendingMode, setPendingMode] = useState<"include" | "exclude">(branchVisibility?.mode || "include");
  const [pendingBranches, setPendingBranches] = useState<Set<string>>(new Set(branchVisibility?.branches || []));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load branches when dropdown opens
  useEffect(() => {
    if (branchDropdownOpen) {
      window.electronAPI.branch.list().then((branches) => {
        setAllBranches(branches);
      });
      // Sync pending state with current visibility
      setPendingMode(branchVisibility?.mode || "include");
      setPendingBranches(new Set(branchVisibility?.branches || []));
      setBranchSearch("");
    }
  }, [branchDropdownOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!branchDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [branchDropdownOpen]);

  const toggleBranchSelection = useCallback((name: string) => {
    setPendingBranches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const applyBranchVisibility = useCallback(() => {
    if (pendingBranches.size === 0) {
      setBranchVisibility(null);
    } else {
      setBranchVisibility({ mode: pendingMode, branches: Array.from(pendingBranches) });
    }
    setBranchDropdownOpen(false);
    // Clear text filter when using visibility filter
    setBranchFilter("");
    setBranchFilterInput("");
    loadGraph();
  }, [pendingMode, pendingBranches, setBranchVisibility, setBranchFilter, loadGraph]);

  const clearBranchVisibility = useCallback(() => {
    setBranchVisibility(null);
    setPendingBranches(new Set());
    loadGraph();
  }, [setBranchVisibility, loadGraph]);

  const applyBranchFilter = useCallback((value: string) => {
    setBranchFilter(value);
    // Clear visibility filter when using text filter
    if (value) {
      setBranchVisibility(null);
      setPendingBranches(new Set());
    }
    loadGraph();
  }, [setBranchFilter, setBranchVisibility, loadGraph]);

  const handleBranchFilterChange = useCallback((value: string) => {
    setBranchFilterInput(value);
    if (branchFilterTimerRef.current) clearTimeout(branchFilterTimerRef.current);
    branchFilterTimerRef.current = setTimeout(() => applyBranchFilter(value), 400);
  }, [applyBranchFilter]);

  const handleBranchFilterClear = useCallback(() => {
    setBranchFilterInput("");
    if (branchFilterTimerRef.current) clearTimeout(branchFilterTimerRef.current);
    applyBranchFilter("");
  }, [applyBranchFilter]);

  const hasActiveFilter = !!(branchVisibility && branchVisibility.branches.length > 0);

  // Filter rows by search
  const filteredRows = searchQuery.trim()
    ? rows.filter((r) => {
        const q = searchQuery.toLowerCase();
        const c = r.commit;
        return (
          c.subject.toLowerCase().includes(q) ||
          c.authorName.toLowerCase().includes(q) ||
          c.authorEmail.toLowerCase().includes(q) ||
          c.hash.startsWith(searchQuery) ||
          c.abbreviatedHash.startsWith(searchQuery) ||
          c.refs.some((ref) => ref.name.toLowerCase().includes(q))
        );
      })
    : rows;

  const maxGraphWidth = useMemo(() => {
    let maxLanes = 0;
    for (const r of filteredRows) {
      if (r.activeLaneCount > maxLanes) maxLanes = r.activeLaneCount;
    }
    return Math.max((maxLanes + 2) * LANE_WIDTH, 32);
  }, [filteredRows]);

  const scrollToHead = useCallback(() => {
    const targetRows = searchQuery.trim() ? filteredRows : rows;
    const idx = targetRows.findIndex((r) => r.commit.hash === repo?.headCommit);
    if (idx !== -1) {
      virtuosoRef.current?.scrollToIndex({ index: idx, behavior: "smooth", align: "center" });
    }
  }, [rows, filteredRows, searchQuery, repo?.headCommit]);

  // Toggle search with Ctrl+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible((v) => !v);
      }
      if (e.key === "Escape" && searchVisible) {
        setSearchVisible(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchVisible]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) loadMore();
  }, [hasMore, loading, loadMore]);

  const handleContextMenu = (e: React.MouseEvent, row: GraphRow) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, row });
  };

  const commitContextItems = (row: GraphRow): ContextMenuEntry[] => {
    const checkableBranches = row.commit.refs.filter(
      (r) => (r.type === "head" || r.type === "remote") && !r.current
    );

    const items: ContextMenuEntry[] = [];

    // Checkout option — show when there are branches or allow detached HEAD
    if (checkableBranches.length > 0) {
      items.push({
        label: checkableBranches.length === 1
          ? `Checkout "${checkableBranches[0].name}"`
          : "Checkout...",
        onClick: () =>
          setCheckoutTarget({
            refs: row.commit.refs,
            hash: row.commit.hash,
            subject: row.commit.subject,
          }),
      });
    } else if (!row.commit.refs.some((r) => r.current)) {
      // No branches but also not the current HEAD commit — offer detached checkout
      items.push({
        label: "Checkout Commit (detached HEAD)",
        onClick: () =>
          setCheckoutTarget({
            refs: row.commit.refs,
            hash: row.commit.hash,
            subject: row.commit.subject,
          }),
      });
    }

    // Merge into current branch — show branches/tags on this commit
    const mergeableRefs = row.commit.refs.filter(
      (r) => (r.type === "head" || r.type === "remote" || r.type === "tag") && !r.current
    );
    if (mergeableRefs.length > 0) {
      items.push({
        label: "Merge into current branch...",
        children: mergeableRefs.map((ref) => ({
          label: ref.name,
          onClick: () => setMergeTarget(ref.name),
        })),
      });
    }

    // Rebase current branch on — submenu with selected commit + interactive option
    {
      const rebaseChildren: ContextMenuEntry[] = [
        {
          label: "Selected commit",
          onClick: () => setRebaseTarget({ onto: row.commit.hash }),
        },
        {
          label: "Selected commit interactively...",
          onClick: () => setRebaseTarget({ onto: row.commit.hash, interactive: true }),
        },
        {
          label: "Selected commit with advanced options...",
          onClick: () => setRebaseTarget({ onto: row.commit.hash }),
        },
      ];

      // Add branch/tag refs as additional rebase targets
      const rebaseRefs = row.commit.refs.filter(
        (r) => (r.type === "head" || r.type === "remote" || r.type === "tag") && !r.current
      );
      if (rebaseRefs.length > 0) {
        rebaseChildren.push({ divider: true });
        for (const ref of rebaseRefs) {
          rebaseChildren.push({
            label: ref.name,
            onClick: () => setRebaseTarget({ onto: ref.name }),
          });
        }
      }

      items.push({
        label: "Rebase current branch on",
        children: rebaseChildren,
      });
    }

    items.push(
      {
        label: "Cherry Pick",
        onClick: () =>
          setCherryPickTarget({ hash: row.commit.hash, subject: row.commit.subject }),
      },
      {
        label: "Create Branch Here",
        onClick: () => setCreateBranchFrom(row.commit.hash),
      },
      {
        label: "Create Tag Here",
        onClick: () =>
          setTagTarget({ hash: row.commit.hash, subject: row.commit.subject }),
      },
    );

    // Add delete options for branches on this commit
    const localBranches = row.commit.refs.filter((r) => r.type === "head" && !r.current);
    const tags = row.commit.refs.filter((r) => r.type === "tag");

    if (localBranches.length > 0 || tags.length > 0) {
      items.push({ divider: true });
      for (const branch of localBranches) {
        items.push({
          label: `Delete Branch "${branch.name}"`,
          color: "var(--red)",
          onClick: () => setDeleteBranchTarget(branch.name),
        });
      }
      for (const tag of tags) {
        items.push({
          label: `Delete Tag "${tag.name}"`,
          color: "var(--red)",
          onClick: () => setDeleteTagTarget(tag.name),
        });
      }
    }

    items.push(
      { divider: true },
      {
        label: "Reset Current Branch to Here",
        color: "var(--peach)",
        onClick: () =>
          setResetTarget({ hash: row.commit.hash, subject: row.commit.subject }),
      },
      { divider: true },
      {
        label: "View Commit Info",
        onClick: () => openDialogWindow({ dialog: "CommitInfoWindow", data: { commitHash: row.commit.hash } }),
      },
    );

    // Compare options
    const headRow = rows.find((r) => r.commit.hash === repo?.headCommit);
    if (headRow && headRow.commit.hash !== row.commit.hash) {
      items.push({
        label: "Compare with HEAD",
        onClick: () => setCompareTarget({ commit1: row.commit, commit2: headRow.commit }),
      });
    }
    if (selectedCommit && selectedCommit.hash !== row.commit.hash && selectedCommit.hash !== headRow?.commit.hash) {
      items.push({
        label: `Compare with selected (${selectedCommit.abbreviatedHash})`,
        onClick: () => setCompareTarget({ commit1: row.commit, commit2: selectedCommit }),
      });
    }

    items.push(
      { divider: true },
      {
        label: "Generate Changelog...",
        icon: "📋",
        onClick: () =>
          openDialogWindow({
            dialog: "ChangelogDialog",
            data: { commitHash: row.commit.hash, commitSubject: row.commit.subject },
          }),
      },
    );

    items.push(
      {
        label: `Copy Hash (${row.commit.abbreviatedHash})`,
        onClick: () => navigator.clipboard.writeText(row.commit.hash),
      },
      { divider: true },
      {
        label: "AI Code Review",
        onClick: () => setAiReviewHash(row.commit.hash),
      },
    );

    return items;
  };

  if (!repo) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconGitCommit />
        </div>
        <span>Open a repository to view commits</span>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="empty-state">
        <div
          className="rounded-full"
          style={{
            width: 20,
            height: 20,
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span>Loading commits...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="h-full" style={{ display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 6px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {/* Branch filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }} ref={dropdownRef}>
          {/* Filter button */}
          <button
            onClick={() => setBranchDropdownOpen((v) => !v)}
            title="Filter branches"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              border: `1px solid ${hasActiveFilter ? "var(--accent)" : "var(--border)"}`,
              background: hasActiveFilter ? "var(--accent-dim)" : "var(--surface-1)",
              color: hasActiveFilter ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!hasActiveFilter) {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!hasActiveFilter) {
                e.currentTarget.style.background = "var(--surface-1)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            Branches
            {hasActiveFilter && (
              <span style={{ fontSize: 10, fontWeight: 600 }}>
                ({branchVisibility?.branches.length || 0})
              </span>
            )}
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Active filter badge */}
          {hasActiveFilter && (
            <>
              <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {branchVisibility?.mode === "exclude" ? "Excluding" : "Showing"} {branchVisibility?.branches.length} branch{(branchVisibility?.branches.length || 0) !== 1 ? "es" : ""} — {rows.length} commits
              </span>
              <button
                onClick={clearBranchVisibility}
                title="Clear branch filter"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}

          {/* Branch filter text input (alternative quick filter) */}
          {!hasActiveFilter && (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                value={branchFilterInput}
                onChange={(e) => handleBranchFilterChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (branchFilterTimerRef.current) clearTimeout(branchFilterTimerRef.current);
                    applyBranchFilter(branchFilterInput);
                  }
                  if (e.key === "Escape") handleBranchFilterClear();
                }}
                placeholder="Quick filter..."
                style={{
                  width: 120,
                  padding: "2px 22px 2px 6px",
                  borderRadius: 4,
                  border: `1px solid ${branchFilter ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = branchFilter ? "var(--accent)" : "var(--border)")}
              />
              {branchFilterInput && (
                <button
                  onClick={handleBranchFilterClear}
                  style={{
                    position: "absolute",
                    right: 2,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Clear filter"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {branchFilter && !hasActiveFilter && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {rows.length} commits
            </span>
          )}

          {/* Branch dropdown panel */}
          {branchDropdownOpen && (
            <BranchFilterDropdown
              branches={allBranches}
              search={branchSearch}
              onSearchChange={setBranchSearch}
              mode={pendingMode}
              onModeChange={setPendingMode}
              selected={pendingBranches}
              onToggle={toggleBranchSelection}
              onApply={applyBranchVisibility}
              onClear={() => {
                setPendingBranches(new Set());
                clearBranchVisibility();
                setBranchDropdownOpen(false);
              }}
            />
          )}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={scrollToHead}
          title="Scroll to HEAD (local commit)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--surface-1)",
            color: "var(--text-secondary)",
            fontSize: 11,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-1)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="1.05" y1="12" x2="7" y2="12" />
            <line x1="17.01" y1="12" x2="22.96" y2="12" />
          </svg>
          Go to HEAD
        </button>
      </div>

      {/* Search bar */}
      {searchVisible && (
        <div
          style={{
            padding: "4px 8px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commits (message, author, hash, ref)..."
            style={{
              flex: 1,
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          {searchQuery && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
              {filteredRows.length}/{rows.length}
            </span>
          )}
          <button
            onClick={() => { setSearchVisible(false); setSearchQuery(""); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 2,
              display: "flex",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div style={{ flex: 1 }}>
        <Virtuoso
          ref={virtuosoRef}
          totalCount={filteredRows.length}
          itemContent={(index) => (
            <GraphRowItem
              row={filteredRows[index]}
              graphWidth={maxGraphWidth}
              selected={selectedCommit?.hash === filteredRows[index].commit.hash}
              isHead={filteredRows[index].commit.hash === repo.headCommit}
              onClick={() => selectCommit(filteredRows[index].commit.hash)}
              onDoubleClick={() => openDialogWindow({ dialog: "CommitInfoWindow", data: { commitHash: filteredRows[index].commit.hash } })}
              onContextMenu={(e) => handleContextMenu(e, filteredRows[index])}
            />
          )}
          endReached={!searchQuery ? handleEndReached : undefined}
          style={{ height: "100%" }}
          fixedItemHeight={ROW_HEIGHT}
        />
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={commitContextItems(ctxMenu.row)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <CherryPickDialog
        open={!!cherryPickTarget}
        onClose={() => setCherryPickTarget(null)}
        commitHash={cherryPickTarget?.hash || ""}
        commitSubject={cherryPickTarget?.subject || ""}
      />

      <CreateBranchDialog
        open={!!createBranchFrom}
        onClose={() => setCreateBranchFrom(null)}
        startPoint={createBranchFrom || undefined}
      />

      <ResetDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        commitHash={resetTarget?.hash || ""}
        commitSubject={resetTarget?.subject || ""}
      />

      <CreateTagDialog
        open={!!tagTarget}
        onClose={() => setTagTarget(null)}
        commitHash={tagTarget?.hash || ""}
        commitSubject={tagTarget?.subject || ""}
      />

      {compareTarget && (
        <CommitCompareDialog
          open={true}
          onClose={() => setCompareTarget(null)}
          commit1={compareTarget.commit1}
          commit2={compareTarget.commit2}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleteBranchTarget}
        title="Delete Branch"
        message={`Are you sure you want to delete branch "${deleteBranchTarget}"?`}
        onConfirm={async () => {
          if (!deleteBranchTarget) return;
          try {
            await window.electronAPI.branch.delete(deleteBranchTarget);
            loadGraph();
          } catch (err) {
            alert(`Failed to delete branch: ${err instanceof Error ? err.message : err}`);
          }
          setDeleteBranchTarget(null);
        }}
        onCancel={() => setDeleteBranchTarget(null)}
      />

      <CheckoutDialog
        open={!!checkoutTarget}
        onClose={() => setCheckoutTarget(null)}
        refs={checkoutTarget?.refs ?? []}
        commitHash={checkoutTarget?.hash ?? ""}
        commitSubject={checkoutTarget?.subject ?? ""}
      />

      <MergeDialog
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        preselectedBranch={mergeTarget || undefined}
      />

      <RebaseDialog
        open={!!rebaseTarget}
        onClose={() => setRebaseTarget(null)}
        preselectedOnto={rebaseTarget?.onto}
        startInteractive={rebaseTarget?.interactive}
      />

      {aiReviewHash && (
        <AiReviewDialog
          hash={aiReviewHash}
          onClose={() => setAiReviewHash(null)}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTagTarget}
        title="Delete Tag"
        message={`Are you sure you want to delete tag "${deleteTagTarget}"?`}
        onConfirm={async () => {
          if (!deleteTagTarget) return;
          try {
            await window.electronAPI.tag.delete(deleteTagTarget);
            if (deleteTagRemote) {
              await window.electronAPI.tag.deleteRemote(deleteTagTarget);
            }
            loadGraph();
          } catch (err) {
            alert(`Failed to delete tag: ${err instanceof Error ? err.message : err}`);
          }
          setDeleteTagTarget(null);
          setDeleteTagRemote(false);
        }}
        onCancel={() => { setDeleteTagTarget(null); setDeleteTagRemote(false); }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
          <input type="checkbox" checked={deleteTagRemote} onChange={(e) => setDeleteTagRemote(e.target.checked)} />
          Delete tag from remote
        </label>
      </ConfirmDeleteDialog>
    </div>
  );
};

const GraphRowItem: React.FC<{
  row: GraphRow;
  graphWidth: number;
  selected: boolean;
  isHead: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = React.memo(({ row, graphWidth, selected, isHead, onClick, onDoubleClick, onContextMenu }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = graphWidth * dpr;
    canvas.height = ROW_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, graphWidth, ROW_HEIGHT);

    const midY = ROW_HEIGHT / 2;

    // Draw edges (extend 1px beyond canvas bounds to avoid anti-aliasing gaps between rows)
    const TOP = -1;
    const BOTTOM = ROW_HEIGHT + 1;

    for (const edge of row.edges) {
      const fromX = edge.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
      const toX = edge.toLane * LANE_WIDTH + LANE_WIDTH / 2;
      ctx.strokeStyle = LANE_PALETTE[edge.color % LANE_PALETTE.length];
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      if (edge.type === "straight") {
        ctx.moveTo(fromX, TOP);
        ctx.lineTo(toX, BOTTOM);
      } else if (edge.type === "start") {
        // Branch tip: line from commit dot downward
        ctx.moveTo(fromX, midY);
        ctx.lineTo(toX, BOTTOM);
      } else if (edge.type === "end") {
        // Root commit: line from top of row to commit dot
        ctx.moveTo(fromX, TOP);
        ctx.lineTo(toX, midY);
      } else if (edge.type === "converge-left" || edge.type === "converge-right") {
        // Lane converging into commit from above: line from top curves to commit dot
        ctx.moveTo(fromX, TOP);
        ctx.bezierCurveTo(fromX, midY - 10, toX, midY + 10, toX, midY);
      } else {
        // fork-left, fork-right, merge-left, merge-right: line from commit dot curves downward
        ctx.moveTo(fromX, midY);
        ctx.bezierCurveTo(fromX, midY + 10, toX, midY - 10, toX, BOTTOM);
      }
      ctx.stroke();
    }

    // Commit dot
    const dotX = row.laneIndex * LANE_WIDTH + LANE_WIDTH / 2;
    const colorIdx =
      row.edges.find((e) => e.fromLane === row.laneIndex)?.color ?? 0;
    const color = LANE_PALETTE[colorIdx % LANE_PALETTE.length];
    const radius = isHead ? DOT_RADIUS + 1.5 : DOT_RADIUS;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = isHead ? 10 : 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dotX, midY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Clean border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isHead ? "#ffffff" : "var(--surface-0)";
    ctx.lineWidth = isHead ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(dotX, midY, radius + 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [row, graphWidth, isHead]);

  const { commit } = row;

  return (
    <div
      className="flex items-center cursor-pointer"
      style={{
        height: ROW_HEIGHT,
        background: selected ? "var(--accent-dim)" : "transparent",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
        transition: "background 0.1s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <canvas
        ref={canvasRef}
        style={{ width: graphWidth, height: ROW_HEIGHT }}
        className="shrink-0"
      />
      <div className="flex items-center gap-1.5 min-w-0 px-1">
        {commit.refs.map((ref) => (
          <span
            key={ref.name}
            title={ref.name}
            className={`badge ${
              ref.type === "head"
                ? ref.current
                  ? "badge-head-current"
                  : "badge-head"
                : ref.type === "remote"
                ? "badge-remote"
                : "badge-tag"
            }`}
          >
            {ref.name}
          </span>
        ))}
        <span className="truncate text-xs" style={{ color: "var(--text-primary)", fontWeight: isHead ? 700 : 400 }}>
          {commit.subject}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3 px-3 shrink-0">
        <div className="flex items-center gap-1.5" style={{ width: 120 }}>
          {commit.gravatarHash && (
            <img
              src={`https://www.gravatar.com/avatar/${commit.gravatarHash}?s=40&d=retro`}
              alt=""
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                flexShrink: 0,
              }}
              loading="lazy"
            />
          )}
          <span
            className="truncate"
            style={{ color: "var(--text-secondary)", fontSize: 11 }}
          >
            {commit.authorName}
          </span>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 11, width: 110, textAlign: "right" }}>
          {formatDate(commit.authorDate)}
        </span>
        <span className="mono" style={{ color: "var(--text-muted)", fontSize: 11 }}>
          {commit.abbreviatedHash}
        </span>
      </div>
    </div>
  );
});

const ConfirmDeleteDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}> = ({ open, title, message, onConfirm, onCancel, children }) => (
  <ModalDialog open={open} title={title} onClose={onCancel} width={380}>
    <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{message}</p>
    {children}
    <DialogActions
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      confirmColor="var(--red)"
    />
  </ModalDialog>
);

const BranchFilterDropdown: React.FC<{
  branches: BranchInfo[];
  search: string;
  onSearchChange: (v: string) => void;
  mode: "include" | "exclude";
  onModeChange: (m: "include" | "exclude") => void;
  selected: Set<string>;
  onToggle: (name: string) => void;
  onApply: () => void;
  onClear: () => void;
}> = ({ branches, search, onSearchChange, mode, onModeChange, selected, onToggle, onApply, onClear }) => {
  const localBranches = branches.filter((b) => !b.remote);
  const remoteBranches = branches.filter((b) => b.remote);

  const q = search.toLowerCase();
  const filteredLocal = q ? localBranches.filter((b) => b.name.toLowerCase().includes(q)) : localBranches;
  const filteredRemote = q ? remoteBranches.filter((b) => b.name.toLowerCase().includes(q)) : remoteBranches;

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 4,
        width: 320,
        maxHeight: 420,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Mode toggle */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <button
          onClick={() => onModeChange("include")}
          style={{
            flex: 1,
            padding: "6px 0",
            fontSize: 11,
            fontWeight: mode === "include" ? 600 : 400,
            border: "none",
            borderBottom: mode === "include" ? "2px solid var(--accent)" : "2px solid transparent",
            background: mode === "include" ? "var(--accent-dim)" : "transparent",
            color: mode === "include" ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Show selected
        </button>
        <button
          onClick={() => onModeChange("exclude")}
          style={{
            flex: 1,
            padding: "6px 0",
            fontSize: 11,
            fontWeight: mode === "exclude" ? 600 : 400,
            border: "none",
            borderBottom: mode === "exclude" ? "2px solid var(--red)" : "2px solid transparent",
            background: mode === "exclude" ? "color-mix(in srgb, var(--red) 10%, transparent)" : "transparent",
            color: mode === "exclude" ? "var(--red)" : "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Hide selected
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search branches..."
          style={{
            width: "100%",
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 11,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Branch list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filteredLocal.length > 0 && (
          <>
            <div style={{ padding: "4px 12px 2px", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Local Branches
            </div>
            {filteredLocal.map((b) => (
              <BranchCheckboxItem
                key={b.name}
                name={b.name}
                current={b.current}
                checked={selected.has(b.name)}
                onToggle={() => onToggle(b.name)}
              />
            ))}
          </>
        )}
        {filteredRemote.length > 0 && (
          <>
            <div style={{ padding: "8px 12px 2px", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Remote Branches
            </div>
            {filteredRemote.map((b) => (
              <BranchCheckboxItem
                key={b.name}
                name={b.name}
                current={false}
                checked={selected.has(b.name)}
                onToggle={() => onToggle(b.name)}
              />
            ))}
          </>
        )}
        {filteredLocal.length === 0 && filteredRemote.length === 0 && (
          <div style={{ padding: "12px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
            No branches found
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 8px",
        borderTop: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {selected.size} selected
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onClear}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
          <button
            onClick={onApply}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--base)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const BranchCheckboxItem: React.FC<{
  name: string;
  current: boolean;
  checked: boolean;
  onToggle: () => void;
}> = ({ name, current, checked, onToggle }) => (
  <div
    onClick={onToggle}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "3px 12px",
      cursor: "pointer",
      fontSize: 11,
      color: "var(--text-primary)",
      background: checked ? "var(--accent-dim)" : "transparent",
    }}
    onMouseEnter={(e) => {
      if (!checked) e.currentTarget.style.background = "var(--surface-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = checked ? "var(--accent-dim)" : "transparent";
    }}
  >
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: checked ? "none" : "1.5px solid var(--border)",
        background: checked ? "var(--accent)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--base)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
    <span className="truncate" style={{ fontWeight: current ? 600 : 400 }}>
      {name}
    </span>
    {current && (
      <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>HEAD</span>
    )}
  </div>
);

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return "Future";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return "";
  }
}
