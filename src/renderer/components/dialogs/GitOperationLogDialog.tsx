import React, { useRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitOperationStore } from "../../store/git-operation-store";
import type { OutputLine } from "../../store/git-operation-store";
import type { CommandLogEntry } from "../../../shared/git-types";

export const GitOperationLogDialog: React.FC = () => {
  const { t } = useTranslation();
  const {
    open,
    label,
    entries,
    outputLines,
    running,
    error,
    close,
    cancel,
    autoClose,
    setAutoClose,
  } = useGitOperationStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logExpanded, setLogExpanded] = useState(false);

  // Group output lines by entry id
  const outputByEntry = useMemo(() => {
    const map = new Map<string, OutputLine[]>();
    for (const line of outputLines) {
      const list = map.get(line.entryId);
      if (list) list.push(line);
      else map.set(line.entryId, [line]);
    }
    return map;
  }, [outputLines]);

  // Auto-scroll to bottom when entries or output change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, outputLines]);

  if (!open) return null;

  const isSuccess = !running && !error;

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
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) close();
      }}
    >
      <div
        style={{
          width: 600,
          maxWidth: "90vw",
          maxHeight: "70vh",
          borderRadius: 12,
          background: "var(--surface-1)",
          border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          animation: "modal-in 0.15s ease-out",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {running && <Spinner />}
            {isSuccess && <SuccessIcon />}
            {error && <ErrorIcon />}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {label}
              {running && ` — ${t("operationLog.running")}`}
              {isSuccess && ` — ${t("operationLog.done")}`}
              {error && ` — ${t("operationLog.failed")}`}
            </span>
          </div>
          {!running && (
            <button
              onClick={close}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Log area (collapsible) */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setLogExpanded((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "6px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-muted)",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{
                transition: "transform 0.15s ease",
                transform: logExpanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              <polygon points="6,2 22,12 6,22" />
            </svg>
            {logExpanded ? t("operationLog.hideLogDetails") : t("operationLog.showLogDetails")}
          </button>
          {logExpanded && (
            <div
              ref={scrollRef}
              style={{
                overflow: "auto",
                padding: "8px 16px",
                fontFamily: "var(--font-mono, 'Cascadia Code', 'Fira Code', monospace)",
                fontSize: 12,
                lineHeight: 1.6,
                maxHeight: "40vh",
              }}
            >
              {entries.length === 0 && running && (
                <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  {t("operationLog.waitingForOutput")}
                </div>
              )}
              {entries.map((entry) => (
                <LogEntryBlock
                  key={entry.id}
                  entry={entry}
                  outputLines={outputByEntry.get(entry.id) ?? []}
                />
              ))}
            </div>
          )}
        </div>

        {/* Error detail */}
        {error && (
          <div
            style={{
              padding: "8px 16px 12px",
              borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--red)",
                background: "rgba(var(--red-rgb, 210,15,57), 0.08)",
                padding: "8px 12px",
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              {stripAnsi(error)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 11,
              color: "var(--text-muted)",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              style={{ margin: 0, accentColor: "var(--accent)" }}
            />
            {t("operationLog.closeOnSuccess")}
          </label>
          {running ? (
            <button
              onClick={cancel}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--red)",
                background: "transparent",
                color: "var(--red)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "color-mix(in srgb, var(--red) 12%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {t("dialogs.cancel")}
            </button>
          ) : (
            <button
              onClick={close}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {t("dialogs.close")}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

/* ---------- Helpers ---------- */

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)/g;
const stripAnsi = (text: string): string => text.replace(ANSI_RE, "");

/* ---------- Sub-components ---------- */

const LogEntryBlock: React.FC<{ entry: CommandLogEntry; outputLines: OutputLine[] }> = ({
  entry,
  outputLines,
}) => {
  const hasFinished = entry.exitCode !== undefined;
  const isError = entry.exitCode !== undefined && entry.exitCode !== 0;

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Command line */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>$</span>
        <span style={{ color: "var(--text-primary)" }}>
          {entry.command} {entry.args.join(" ")}
        </span>
        {hasFinished && (
          <span
            style={{
              fontSize: 10,
              color: isError ? "var(--red)" : "var(--green)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {isError ? `exit ${entry.exitCode}` : `${entry.duration ?? 0}ms`}
          </span>
        )}
      </div>

      {/* Output lines (stdout/stderr from hooks, git progress, etc.) */}
      {outputLines.length > 0 && (
        <div style={{ paddingLeft: 16, marginTop: 2 }}>
          {outputLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.stream === "stderr" ? "var(--yellow)" : "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {stripAnsi(line.text)}
            </div>
          ))}
        </div>
      )}

      {/* Error from the exception (shown when no output lines already show the error) */}
      {isError && entry.error && outputLines.length === 0 && (
        <div
          style={{
            color: "var(--red)",
            paddingLeft: 16,
            marginTop: 2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {stripAnsi(entry.error)}
        </div>
      )}
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--accent)"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ animation: "spin 0.8s linear infinite" }}
  >
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const SuccessIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--green)"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--red)"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
