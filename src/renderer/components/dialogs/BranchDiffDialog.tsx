import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ModalDialog } from "./ModalDialog";
import type { BranchDiffResult, CommitFileInfo, BranchInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  added: "var(--green)",
  modified: "var(--yellow)",
  deleted: "var(--red)",
  renamed: "var(--blue)",
  copied: "var(--blue)",
};

const STATUS_LABELS: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
};

export const BranchDiffDialog: React.FC<Props> = ({ open, onClose }) => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<BranchDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setBranchesLoading(true);
    window.electronAPI.branch
      .list()
      .then((list) => {
        setBranches(list);
        const current = list.find((b) => b.current);
        const first = list[0];
        if (current) {
          setFrom(current.name);
          const other = list.find((b) => !b.current);
          setTo(other ? other.name : current.name);
        } else if (first) {
          setFrom(first.name);
          setTo(list[1] ? list[1].name : first.name);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBranchesLoading(false));
  }, [open]);

  const handleSwap = useCallback(() => {
    setFrom((prev) => {
      setTo(prev);
      return to;
    });
    setResult(null);
    setSelectedFile(null);
    setError(null);
  }, [to]);

  const handleCompare = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedFile(null);
    try {
      const data = await window.electronAPI.diffBranches.compare(from, to);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const totalAdditions = useMemo(
    () => result?.files.reduce((s, f) => s + f.additions, 0) ?? 0,
    [result]
  );
  const totalDeletions = useMemo(
    () => result?.files.reduce((s, f) => s + f.deletions, 0) ?? 0,
    [result]
  );

  const selectStyle: React.CSSProperties = {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-0)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  };

  return (
    <ModalDialog open={open} title="Branch Diff" onClose={onClose} width={700}>
      {/* Branch selectors row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 16 }}>
        {/* From */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>From</span>
          <select
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setResult(null);
              setSelectedFile(null);
              setError(null);
            }}
            disabled={branchesLoading}
            style={selectStyle}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwap}
          title="Swap branches"
          style={{
            flexShrink: 0,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>

        {/* To */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>To</span>
          <select
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setResult(null);
              setSelectedFile(null);
              setError(null);
            }}
            disabled={branchesLoading}
            style={selectStyle}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Compare button */}
        <button
          onClick={handleCompare}
          disabled={loading || branchesLoading || !from || !to}
          style={{
            flexShrink: 0,
            padding: "6px 18px",
            borderRadius: 6,
            border: "none",
            background:
              loading || branchesLoading || !from || !to ? "var(--surface-3)" : "var(--accent)",
            color:
              loading || branchesLoading || !from || !to
                ? "var(--text-muted)"
                : "var(--text-on-color)",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading || branchesLoading || !from || !to ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "..." : "Compare"}
        </button>
      </div>

      {/* Error */}
      {error && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 12 }}>{error}</div>}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "7px 12px",
              borderRadius: 6,
              background: "var(--surface-0)",
              border: "1px solid var(--border-subtle)",
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            <span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {result.stats.filesChanged}
              </span>{" "}
              file{result.stats.filesChanged !== 1 ? "s" : ""} changed
            </span>
            {totalAdditions > 0 && (
              <span style={{ color: "var(--green)", fontWeight: 600 }}>+{totalAdditions}</span>
            )}
            {totalDeletions > 0 && (
              <span style={{ color: "var(--red)", fontWeight: 600 }}>-{totalDeletions}</span>
            )}
          </div>

          {/* File list */}
          {result.files.length === 0 ? (
            <div
              style={{
                padding: 24,
                fontSize: 12,
                color: "var(--text-muted)",
                textAlign: "center",
                background: "var(--surface-0)",
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
              }}
            >
              No differences between these branches
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                overflow: "hidden",
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              {result.files.map((file) => (
                <BranchFileEntry
                  key={file.path}
                  file={file}
                  selected={selectedFile === file.path}
                  onClick={() => setSelectedFile((prev) => (prev === file.path ? null : file.path))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state before first compare */}
      {!result && !loading && !error && (
        <div
          style={{
            padding: 32,
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
            background: "var(--surface-0)",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
          }}
        >
          Select two branches and press Compare
        </div>
      )}
    </ModalDialog>
  );
};

const BranchFileEntry: React.FC<{
  file: CommitFileInfo;
  selected: boolean;
  onClick: () => void;
}> = ({ file, selected, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: 12,
      background: selected ? "var(--accent-dim)" : "transparent",
      borderBottom: "1px solid var(--border-subtle)",
    }}
    onMouseEnter={(e) => {
      if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = selected ? "var(--accent-dim)" : "transparent";
    }}
  >
    {/* Status badge */}
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
        color: STATUS_COLORS[file.status] ?? "var(--text-muted)",
        background: `color-mix(in srgb, ${STATUS_COLORS[file.status] ?? "var(--text-muted)"} 15%, transparent)`,
      }}
    >
      {STATUS_LABELS[file.status] ?? "?"}
    </span>

    {/* File path */}
    <span
      style={{
        flex: 1,
        color: "var(--text-primary)",
        fontFamily: "monospace",
        fontSize: 11,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {file.path}
    </span>

    {/* Additions / deletions */}
    <span style={{ fontSize: 11, flexShrink: 0, display: "flex", gap: 4 }}>
      {file.additions > 0 && <span style={{ color: "var(--green)" }}>+{file.additions}</span>}
      {file.deletions > 0 && <span style={{ color: "var(--red)" }}>-{file.deletions}</span>}
    </span>
  </div>
);
