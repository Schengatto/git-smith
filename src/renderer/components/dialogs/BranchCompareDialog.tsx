import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";
import type { CommitInfo, BranchInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const BranchCompareDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [onlyInA, setOnlyInA] = useState<CommitInfo[]>([]);
  const [onlyInB, setOnlyInB] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compared, setCompared] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOnlyInA([]);
    setOnlyInB([]);
    setError(null);
    setCompared(false);
    window.electronAPI.branch.list().then((list) => {
      setBranches(list);
      const current = list.find((b) => b.current);
      const first = list[0];
      const second = list[1];
      setRefA(current?.name ?? first?.name ?? "");
      setRefB(second?.name ?? first?.name ?? "");
    });
  }, [open]);

  const handleSwap = useCallback(() => {
    setRefA(refB);
    setRefB(refA);
    setOnlyInA([]);
    setOnlyInB([]);
    setCompared(false);
    setError(null);
  }, [refA, refB]);

  const handleCompare = useCallback(async () => {
    if (!refA || !refB) return;
    setLoading(true);
    setError(null);
    setOnlyInA([]);
    setOnlyInB([]);
    setCompared(false);
    try {
      const [inA, inB] = await Promise.all([
        window.electronAPI.logRange.compare(refB, refA),
        window.electronAPI.logRange.compare(refA, refB),
      ]);
      setOnlyInA(inA);
      setOnlyInB(inB);
      setCompared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [refA, refB]);

  return (
    <ModalDialog open={open} title={t("branchCompare.title")} onClose={onClose} width={800}>
      {/* Ref selectors */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("branchCompare.branchA")}
          </label>
          <select
            value={refA}
            onChange={(e) => {
              setRefA(e.target.value);
              setCompared(false);
            }}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
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
          title={t("branchCompare.swapBranches")}
          style={{
            marginTop: 18,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
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

        <div style={{ flex: 1 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("branchCompare.branchB")}
          </label>
          <select
            value={refB}
            onChange={(e) => {
              setRefB(e.target.value);
              setCompared(false);
            }}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !refA || !refB}
          style={{
            marginTop: 18,
            padding: "7px 18px",
            borderRadius: 6,
            border: "none",
            background: loading || !refA || !refB ? "var(--surface-3)" : "var(--accent)",
            color: loading || !refA || !refB ? "var(--text-muted)" : "var(--text-on-color)",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading || !refA || !refB ? "not-allowed" : "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? t("branchCompare.comparing") : t("branchCompare.compare")}
        </button>
      </div>

      {/* Error */}
      {error && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12 }}>{error}</div>}

      {/* Results */}
      {compared && (
        <div style={{ display: "flex", gap: 12 }}>
          {/* Only in A */}
          <CommitColumn title={`Only in ${refA}`} commits={onlyInA} accentColor="var(--blue)" />
          {/* Only in B */}
          <CommitColumn title={`Only in ${refB}`} commits={onlyInB} accentColor="var(--green)" />
        </div>
      )}

      {!compared && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          {t("branchCompare.selectBranchesPrompt")}
        </div>
      )}
    </ModalDialog>
  );
};

const CommitColumn: React.FC<{
  title: string;
  commits: CommitInfo[];
  accentColor: string;
}> = ({ title, commits, accentColor }) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: "8px 12px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--surface-3)",
            borderRadius: 10,
            padding: "1px 7px",
          }}
        >
          {commits.length}
        </span>
      </div>

      {/* Commit list */}
      <div
        style={{
          maxHeight: 360,
          overflowY: "auto",
          background: "var(--surface-0)",
        }}
      >
        {commits.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            {t("branchCompare.noExclusiveCommits")}
          </div>
        ) : (
          commits.map((commit) => (
            <CommitRow key={commit.hash} commit={commit} accentColor={accentColor} />
          ))
        )}
      </div>
    </div>
  );
};

const CommitRow: React.FC<{ commit: CommitInfo; accentColor: string }> = ({
  commit,
  accentColor,
}) => (
  <div
    style={{
      padding: "7px 12px",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      gap: 3,
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: accentColor,
          background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          padding: "1px 5px",
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        {commit.abbreviatedHash}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {commit.subject}
      </span>
    </div>
    <div
      style={{
        display: "flex",
        gap: 8,
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <span>{commit.authorName}</span>
      <span>{commit.authorDate}</span>
    </div>
  </div>
);
