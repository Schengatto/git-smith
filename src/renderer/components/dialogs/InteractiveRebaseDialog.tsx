import React, { useState, useEffect } from "react";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import type { CommitInfo } from "../../../shared/git-types";
import { runGitOperation } from "../../store/git-operation-store";

type RebaseAction = "pick" | "reword" | "squash" | "fixup" | "edit" | "drop";

interface TodoEntry {
  action: RebaseAction;
  commit: CommitInfo;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onto: string;
}

const ACTIONS: { value: RebaseAction; label: string; color: string; shortKey: string }[] = [
  { value: "pick", label: "Pick", color: "var(--green)", shortKey: "p" },
  { value: "reword", label: "Reword", color: "var(--accent)", shortKey: "r" },
  { value: "squash", label: "Squash", color: "var(--yellow)", shortKey: "s" },
  { value: "fixup", label: "Fixup", color: "var(--peach)", shortKey: "f" },
  { value: "edit", label: "Edit", color: "var(--mauve)", shortKey: "e" },
  { value: "drop", label: "Drop", color: "var(--red)", shortKey: "d" },
];

export const InteractiveRebaseDialog: React.FC<Props> = ({ open, onClose, onto }) => {
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [entries, setEntries] = useState<TodoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !onto) return;
    setLoading(true);
    setError(null);
    setSelectedIndex(null);
    window.electronAPI.branch
      .rebaseCommits(onto)
      .then((commits) => {
        setEntries(commits.map((c) => ({ action: "pick", commit: c })));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [open, onto]);

  const setAction = (index: number, action: RebaseAction) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], action };
      return next;
    });
  };

  const moveEntry = (from: number, to: number) => {
    if (to < 0 || to >= entries.length) return;
    setEntries((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSelectedIndex(to);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;

      // Action shortcuts
      for (const a of ACTIONS) {
        if (e.key === a.shortKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setAction(selectedIndex, a.value);
          return;
        }
      }

      // Move up/down with Alt+Arrow
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        moveEntry(selectedIndex, selectedIndex - 1);
      } else if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        moveEntry(selectedIndex, selectedIndex + 1);
      }

      // Navigate
      if (e.key === "ArrowUp" && !e.altKey) {
        e.preventDefault();
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (e.key === "ArrowDown" && !e.altKey) {
        e.preventDefault();
        setSelectedIndex(Math.min(entries.length - 1, selectedIndex + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIndex, entries]);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const fullTodo = entries.map((e) => ({
        action: e.action,
        hash: e.commit.hash,
      }));

      await runGitOperation("Interactive Rebase", () => window.electronAPI.branch.rebaseInteractive(onto, fullTodo));
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveEntry(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  if (!open) return null;

  const dropCount = entries.filter((e) => e.action === "drop").length;
  const squashCount = entries.filter((e) => e.action === "squash" || e.action === "fixup").length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 0.15s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "85vw",
          maxWidth: 800,
          height: "75vh",
          maxHeight: 600,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modal-in 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mauve)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Interactive Rebase
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              onto {onto}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Action legend */}
        <div
          style={{
            padding: "6px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {ACTIONS.map((a) => (
            <span key={a.value} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-muted)" }}>
              <kbd
                style={{
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "var(--surface-3)",
                  fontSize: 9,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {a.shortKey}
              </kbd>
              <span style={{ color: a.color, fontWeight: 500 }}>{a.label}</span>
            </span>
          ))}
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Alt+{"\u2191\u2193"} move
          </span>
        </div>

        {/* Commit list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div className="empty-state"><span>Loading commits...</span></div>
          ) : entries.length === 0 ? (
            <div className="empty-state"><span>No commits to rebase</span></div>
          ) : (
            entries.map((entry, i) => (
              <RebaseRow
                key={entry.commit.hash}
                entry={entry}
                selected={selectedIndex === i}
                onSelect={() => setSelectedIndex(i)}
                onActionChange={(action) => setAction(i, action)}
                onMoveUp={() => moveEntry(i, i - 1)}
                onMoveDown={() => moveEntry(i, i + 1)}
                canMoveUp={i > 0}
                canMoveDown={i < entries.length - 1}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
            <span>{entries.length} commits</span>
            {dropCount > 0 && <span style={{ color: "var(--red)" }}>{dropCount} dropped</span>}
            {squashCount > 0 && <span style={{ color: "var(--yellow)" }}>{squashCount} squashed</span>}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {error && (
              <span style={{ fontSize: 11, color: "var(--red)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {error}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={executing || entries.length === 0}
              style={{
                padding: "7px 18px", borderRadius: 6, border: "none",
                background: executing || entries.length === 0 ? "var(--surface-3)" : "var(--mauve)",
                color: executing || entries.length === 0 ? "var(--text-muted)" : "var(--surface-0)",
                fontSize: 12, fontWeight: 600,
                cursor: executing || entries.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {executing ? "Rebasing..." : "Start Rebase"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ---------- Row component ---------- */

const RebaseRow: React.FC<{
  entry: TodoEntry;
  selected: boolean;
  onSelect: () => void;
  onActionChange: (action: RebaseAction) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}> = ({
  entry,
  selected,
  onSelect,
  onActionChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragOver,
  onDragEnd,
}) => {
  const actionInfo = ACTIONS.find((a) => a.value === entry.action)!;

  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        background: selected ? "var(--accent-dim)" : "transparent",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
        cursor: "grab",
        opacity: entry.action === "drop" ? 0.4 : 1,
        transition: "background 0.1s, opacity 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Drag handle */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text-muted)" style={{ flexShrink: 0, cursor: "grab" }}>
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>

      {/* Move arrows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={!canMoveUp}
          style={{ background: "none", border: "none", cursor: canMoveUp ? "pointer" : "default", padding: 0, color: canMoveUp ? "var(--text-muted)" : "var(--surface-3)", lineHeight: 1 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
          style={{ background: "none", border: "none", cursor: canMoveDown ? "pointer" : "default", padding: 0, color: canMoveDown ? "var(--text-muted)" : "var(--surface-3)", lineHeight: 1 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Action selector */}
      <select
        value={entry.action}
        onChange={(e) => {
          e.stopPropagation();
          onActionChange(e.target.value as RebaseAction);
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "2px 4px",
          borderRadius: 4,
          border: `1px solid ${actionInfo.color}40`,
          background: `${actionInfo.color}15`,
          color: actionInfo.color,
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
          width: 70,
          outline: "none",
          appearance: "none",
          textAlign: "center",
        }}
      >
        {ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>

      {/* Hash */}
      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
        {entry.commit.abbreviatedHash}
      </span>

      {/* Subject */}
      <span
        className="truncate"
        style={{
          flex: 1,
          fontSize: 12,
          color: entry.action === "drop" ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: entry.action === "drop" ? "line-through" : "none",
        }}
      >
        {entry.commit.subject}
      </span>

      {/* Author & date */}
      <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
        {entry.commit.authorName}
      </span>
    </div>
  );
};
