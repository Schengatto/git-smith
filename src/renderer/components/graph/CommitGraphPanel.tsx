import React, { useEffect, useRef, useCallback, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { ContextMenu, ContextMenuEntry } from "../layout/ContextMenu";
import { CherryPickDialog, CreateBranchDialog } from "../dialogs/BranchDialogs";
import { ResetDialog } from "../dialogs/ResetDialog";
import { CreateTagDialog } from "../dialogs/TagDialog";
import type { GraphRow } from "../../../shared/git-types";

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
  const { rows, loading, hasMore, loadGraph, loadMore, selectCommit, selectedCommit } =
    useGraphStore();

  useEffect(() => {
    if (repo) loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path, repo?.headCommit, loadGraph]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: GraphRow } | null>(null);
  const [cherryPickTarget, setCherryPickTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [createBranchFrom, setCreateBranchFrom] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [tagTarget, setTagTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

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

  const commitContextItems = (row: GraphRow): ContextMenuEntry[] => [
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
    { divider: true },
    {
      label: "Reset Current Branch to Here",
      color: "var(--peach)",
      onClick: () =>
        setResetTarget({ hash: row.commit.hash, subject: row.commit.subject }),
    },
    { divider: true },
    {
      label: `Copy Hash (${row.commit.abbreviatedHash})`,
      onClick: () => navigator.clipboard.writeText(row.commit.hash),
    },
  ];

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
          justifyContent: "flex-end",
          gap: 4,
          padding: "2px 6px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
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
              selected={selectedCommit?.hash === filteredRows[index].commit.hash}
              isHead={filteredRows[index].commit.hash === repo.headCommit}
              onClick={() => selectCommit(filteredRows[index].commit.hash)}
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
    </div>
  );
};

const GraphRowItem: React.FC<{
  row: GraphRow;
  selected: boolean;
  isHead: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = React.memo(({ row, selected, isHead, onClick, onContextMenu }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphWidth = Math.max((row.activeLaneCount + 2) * LANE_WIDTH, 32);

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

    // Draw edges
    for (const edge of row.edges) {
      const fromX = edge.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
      const toX = edge.toLane * LANE_WIDTH + LANE_WIDTH / 2;
      ctx.strokeStyle = LANE_PALETTE[edge.color % LANE_PALETTE.length];
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      if (edge.type === "straight") {
        ctx.moveTo(fromX, 0);
        ctx.lineTo(toX, ROW_HEIGHT);
      } else {
        ctx.moveTo(fromX, midY);
        ctx.bezierCurveTo(fromX, midY + 10, toX, midY - 10, toX, ROW_HEIGHT);
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
        <span className="mono" style={{ color: "var(--text-muted)", fontSize: 11 }}>
          {commit.abbreviatedHash}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 11, width: 64, textAlign: "right" }}>
          {formatDate(commit.authorDate)}
        </span>
        <span
          className="truncate"
          style={{ color: "var(--text-secondary)", fontSize: 11, width: 100, textAlign: "right" }}
        >
          {commit.authorName}
        </span>
      </div>
    </div>
  );
});

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 0) return "Future";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return "";
  }
}
