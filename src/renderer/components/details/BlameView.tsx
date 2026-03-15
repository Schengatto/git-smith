import React, { useState, useEffect, useMemo } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
}

interface BlameLine {
  hash: string;
  author: string;
  date: string;
  lineNumber: number;
  content: string;
}

/** Parses `git blame --porcelain` output into structured blame lines with author and date. */
function parsePorcelainBlame(raw: string): BlameLine[] {
  const lines: BlameLine[] = [];
  const rawLines = raw.split("\n");
  let i = 0;
  let currentHash = "";
  let currentAuthor = "";
  let currentDate = "";
  let currentLineNo = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    // Header line: hash origLine finalLine [numLines]
    const headerMatch = line.match(/^([0-9a-f]{40}) \d+ (\d+)/);
    if (headerMatch) {
      currentHash = headerMatch[1];
      currentLineNo = parseInt(headerMatch[2]);
      i++;
      // Read properties until content line (prefixed with \t)
      while (i < rawLines.length && !rawLines[i].startsWith("\t")) {
        const propLine = rawLines[i];
        if (propLine.startsWith("author ")) {
          currentAuthor = propLine.slice(7);
        } else if (propLine.startsWith("author-time ")) {
          const ts = parseInt(propLine.slice(12));
          currentDate = new Date(ts * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
        i++;
      }
      // Content line
      if (i < rawLines.length && rawLines[i].startsWith("\t")) {
        lines.push({
          hash: currentHash,
          author: currentAuthor,
          date: currentDate,
          lineNumber: currentLineNo,
          content: rawLines[i].slice(1),
        });
      }
    }
    i++;
  }
  return lines;
}

// Simple hash-to-color
const BLAME_COLORS = [
  "var(--surface-1)",
  "var(--surface-2)",
];

export const BlameView: React.FC<Props> = ({ open, onClose, filePath }) => {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !filePath) return;
    setLoading(true);
    window.electronAPI.blame
      .file(filePath)
      .then(setRaw)
      .catch(() => setRaw(""))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  const lines = useMemo(() => parsePorcelainBlame(raw), [raw]);

  // Group consecutive lines by hash for striping
  const hashColors = useMemo(() => {
    const map = new Map<string, number>();
    let colorIdx = 0;
    let prevHash = "";
    for (const line of lines) {
      if (line.hash !== prevHash) {
        if (!map.has(line.hash)) {
          map.set(line.hash, colorIdx++ % BLAME_COLORS.length);
        }
        prevHash = line.hash;
      }
    }
    return map;
  }, [lines]);

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "85vw",
          maxWidth: 950,
          height: "75vh",
          maxHeight: 650,
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Blame
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {filePath}
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

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {loading ? (
            <div className="empty-state"><span>Loading blame...</span></div>
          ) : lines.length === 0 ? (
            <div className="empty-state"><span>No blame data</span></div>
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
                  const showAnnotation =
                    i === 0 || lines[i - 1].hash !== line.hash;
                  const bg = BLAME_COLORS[hashColors.get(line.hash) || 0];

                  return (
                    <tr key={i} style={{ background: bg }}>
                      {/* Annotation */}
                      <td
                        style={{
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                          color: "var(--text-muted)",
                          borderRight: "1px solid var(--border-subtle)",
                          verticalAlign: "top",
                          width: 200,
                          minWidth: 200,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {showAnnotation && (
                          <span>
                            <span style={{ color: "var(--accent)" }}>
                              {line.hash.slice(0, 8)}
                            </span>{" "}
                            <span>{line.author}</span>{" "}
                            <span style={{ color: "var(--text-muted)" }}>
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
                      <td style={{ padding: "0 8px", whiteSpace: "pre", color: "var(--text-primary)" }}>
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
