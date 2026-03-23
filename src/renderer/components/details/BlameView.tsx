import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGraphStore } from "../../store/graph-store";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
}

interface BlameLine {
  hash: string;
  author: string;
  date: string;
  timestamp: number;
  lineNumber: number;
  content: string;
}

function parsePorcelainBlame(raw: string): BlameLine[] {
  const lines: BlameLine[] = [];
  const rawLines = raw.split("\n");
  let i = 0;
  let currentHash = "";
  let currentAuthor = "";
  let currentDate = "";
  let currentTimestamp = 0;
  let currentLineNo = 0;

  while (i < rawLines.length) {
    const line = rawLines[i]!;
    const headerMatch = line.match(/^([0-9a-f]{40}) \d+ (\d+)/);
    if (headerMatch) {
      currentHash = headerMatch[1]!;
      currentLineNo = parseInt(headerMatch[2]!);
      i++;
      while (i < rawLines.length && !rawLines[i]!.startsWith("\t")) {
        const propLine = rawLines[i]!;
        if (propLine.startsWith("author ")) {
          currentAuthor = propLine.slice(7);
        } else if (propLine.startsWith("author-time ")) {
          currentTimestamp = parseInt(propLine.slice(12));
          currentDate = new Date(currentTimestamp * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
        i++;
      }
      if (i < rawLines.length && rawLines[i]!.startsWith("\t")) {
        lines.push({
          hash: currentHash,
          author: currentAuthor,
          date: currentDate,
          timestamp: currentTimestamp,
          lineNumber: currentLineNo,
          content: rawLines[i]!.slice(1),
        });
      }
    }
    i++;
  }
  return lines;
}

function ageColor(timestamp: number, oldest: number, newest: number): string {
  if (oldest === newest) return "var(--surface-1)";
  const ratio = (timestamp - oldest) / (newest - oldest);
  const hue = Math.round(ratio * 120); // 0=red (old) → 120=green (new)
  return `hsla(${hue}, 50%, 50%, 0.08)`;
}

export const BlameView: React.FC<Props> = ({ open, onClose, filePath }) => {
  const { t } = useTranslation();
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const { selectCommit } = useGraphStore();

  useEffect(() => {
    if (!open || !filePath) return;
    setLoading(true);
    setSelectedHash(null);
    window.electronAPI.blame
      .file(filePath)
      .then(setRaw)
      .catch(() => setRaw(""))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  const lines = useMemo(() => parsePorcelainBlame(raw), [raw]);

  const { oldest, newest } = useMemo(() => {
    let oldest = Infinity,
      newest = 0;
    for (const line of lines) {
      if (line.timestamp < oldest) oldest = line.timestamp;
      if (line.timestamp > newest) newest = line.timestamp;
    }
    return { oldest, newest };
  }, [lines]);

  const handleNavigate = useCallback(
    (hash: string) => {
      selectCommit(hash);
      onClose();
    },
    [selectCommit, onClose]
  );

  if (!open) return null;

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
          width: "90vw",
          maxWidth: 1100,
          height: "80vh",
          maxHeight: 700,
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("blame.title")}
            </span>
            {!loading && lines.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  background: "var(--surface-0)",
                  padding: "1px 6px",
                  borderRadius: 8,
                }}
              >
                {t("blame.lines", { count: lines.length })}
              </span>
            )}
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {filePath}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 8,
                  borderRadius: 2,
                  background: "var(--red-dim)",
                }}
              />
              {t("blame.older")}
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 8,
                  borderRadius: 2,
                  background: "var(--green-dim)",
                  marginLeft: 4,
                }}
              />
              {t("blame.newer")}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
              }}
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
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {loading ? (
            <div className="empty-state">
              <span>{t("blame.loadingBlame")}</span>
            </div>
          ) : lines.length === 0 ? (
            <div className="empty-state">
              <span>{t("blame.noBlameData")}</span>
            </div>
          ) : (
            <table
              className="mono"
              style={{
                width: "100%",
                fontSize: 11,
                lineHeight: 1.6,
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                {lines.map((line, i) => {
                  const showAnnotation = i === 0 || lines[i - 1]!.hash !== line.hash;
                  const bg = ageColor(line.timestamp, oldest, newest);
                  const isSelected = line.hash === selectedHash;

                  return (
                    <tr
                      key={line.lineNumber}
                      style={{
                        background: isSelected ? "var(--accent-dim)" : bg,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedHash(line.hash === selectedHash ? null : line.hash)}
                    >
                      {/* Annotation */}
                      <td
                        style={{
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                          color: "var(--text-muted)",
                          borderRight: "1px solid var(--border-subtle)",
                          verticalAlign: "top",
                          width: 240,
                          minWidth: 240,
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {showAnnotation && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span
                              style={{
                                color: "var(--accent)",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigate(line.hash);
                              }}
                              title={t("blame.showInGraph")}
                            >
                              {line.hash.slice(0, 8)}
                            </span>
                            <span>{line.author}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                              {line.date}
                            </span>
                          </span>
                        )}
                      </td>
                      {/* Line number */}
                      <td
                        style={{
                          padding: "0 8px 0 12px",
                          textAlign: "right",
                          color: "var(--text-muted)",
                          userSelect: "none",
                          width: 40,
                        }}
                      >
                        {line.lineNumber}
                      </td>
                      {/* Content */}
                      <td
                        style={{
                          padding: "0 8px",
                          whiteSpace: "pre",
                          color: "var(--text-primary)",
                        }}
                      >
                        {line.content}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};
