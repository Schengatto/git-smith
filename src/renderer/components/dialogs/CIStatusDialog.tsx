import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";
import type { CIStatus } from "../../../shared/git-types";
import { useRepoStore } from "../../store/repo-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

const StatusBadge: React.FC<{ status: CIStatus["status"] }> = ({ status }) => {
  if (status === "running") {
    return (
      <>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: "ci-spin 0.9s linear infinite", flexShrink: 0 }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <style>{`@keyframes ci-spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  const colorMap: Record<CIStatus["status"], string> = {
    success: "var(--green)",
    failure: "var(--red)",
    pending: "var(--yellow)",
    running: "var(--blue)",
    unknown: "var(--text-muted)",
  };

  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: colorMap[status] ?? "var(--text-muted)",
        flexShrink: 0,
      }}
    />
  );
};

export const CIStatusDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { repo } = useRepoStore();
  const [runs, setRuns] = useState<CIStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sha = repo?.headCommit ?? null;

  const loadStatus = async () => {
    if (!sha) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.ci.status(sha);
      setRuns(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setRuns([]);
      loadStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sha]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const conclusionLabel = (run: CIStatus): string => {
    if (run.conclusion) return run.conclusion;
    if (run.status === "running") return t("cicd.inProgress");
    if (run.status === "pending") return t("cicd.waiting");
    return run.status;
  };

  const conclusionColor = (run: CIStatus): string => {
    const s = run.status;
    if (s === "success") return "var(--green)";
    if (s === "failure") return "var(--red)";
    if (s === "pending") return "var(--yellow)";
    if (s === "running") return "var(--blue)";
    return "var(--text-muted)";
  };

  return (
    <ModalDialog open={open} title={t("cicd.title")} onClose={onClose} width={600}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
        {/* Commit SHA + Refresh */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={sha ?? ""}
          >
            {sha ? `HEAD: ${sha.slice(0, 12)}` : t("cicd.noCommitLoaded")}
          </span>
          <button
            onClick={loadStatus}
            disabled={loading || !sha}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 500,
              border: "1px solid var(--border)",
              borderRadius: 5,
              background: "transparent",
              color: loading || !sha ? "var(--text-muted)" : "var(--text-secondary)",
              cursor: loading || !sha ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!loading && sha) e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (!loading && sha) e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={loading ? { animation: "ci-spin 0.9s linear infinite" } : undefined}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {t("cicd.refresh")}
          </button>
        </div>

        {/* Content area */}
        {loading ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "24px 0",
              textAlign: "center",
            }}
          >
            {t("cicd.loadingCiRuns")}
          </div>
        ) : error ? (
          <div style={{ fontSize: 12, color: "var(--red)", padding: "12px 0" }}>{error}</div>
        ) : runs.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "24px 0",
              textAlign: "center",
            }}
          >
            {t("cicd.noRunsFound")}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 380,
              overflowY: "auto",
            }}
          >
            {runs.map((run, i) => (
              <div
                key={`${run.name}-${i}`}
                onClick={() => {
                  if (run.url) window.electronAPI.shell.openFile(run.url);
                }}
                title={run.url ? t("cicd.clickToOpen") : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-subtle)",
                  cursor: run.url ? "pointer" : "default",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (run.url) e.currentTarget.style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--surface-0)";
                }}
              >
                {/* Status badge */}
                <StatusBadge status={run.status} />

                {/* Run name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {run.name || t("cicd.unnamedRun")}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    {t("cicd.started")} {formatDate(run.startedAt)}
                  </div>
                </div>

                {/* Conclusion badge */}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: conclusionColor(run) + "22",
                    color: conclusionColor(run),
                    flexShrink: 0,
                  }}
                >
                  {conclusionLabel(run)}
                </span>

                {/* External link icon */}
                {run.url && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalDialog>
  );
};
