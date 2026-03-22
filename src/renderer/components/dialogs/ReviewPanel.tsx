import React, { useState, useEffect } from "react";
import type { ReviewComment, ReviewData } from "../../../shared/git-types";
import { ModalDialog } from "./ModalDialog";

interface Props {
  commitHash: string;
  open: boolean;
  onClose: () => void;
}

type Severity = ReviewComment["severity"];

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; label: string }> = {
  comment: { bg: "var(--blue)", text: "var(--text-on-color)", label: "Comment" },
  suggestion: { bg: "var(--yellow)", text: "#1a1a1a", label: "Suggestion" },
  issue: { bg: "var(--red)", text: "var(--text-on-color)", label: "Issue" },
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 10,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ReviewPanel: React.FC<Props> = ({ commitHash, open, onClose }) => {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(false);

  // Add-form state
  const [file, setFile] = useState("");
  const [line, setLine] = useState<string>("1");
  const [severity, setSeverity] = useState<Severity>("comment");
  const [body, setBody] = useState("");

  // Clear confirmation state
  const [confirmClear, setConfirmClear] = useState(false);

  // Load on open
  useEffect(() => {
    if (!open || !commitHash) return;
    setLoading(true);
    setConfirmClear(false);
    window.electronAPI.review
      .load(commitHash)
      .then((data: ReviewData | null) => {
        setComments(data ? data.comments : []);
      })
      .catch(() => {
        setComments([]);
      })
      .finally(() => setLoading(false));
  }, [open, commitHash]);

  // Auto-save whenever comments change (skip initial empty load)
  const saveComments = (updated: ReviewComment[]) => {
    window.electronAPI.review.save(commitHash, updated).catch(() => {
      // best-effort save
    });
  };

  const handleAdd = () => {
    const trimmedFile = file.trim();
    const trimmedBody = body.trim();
    const parsedLine = parseInt(line, 10);

    if (!trimmedFile || !trimmedBody || isNaN(parsedLine) || parsedLine < 1) return;

    const newComment: ReviewComment = {
      id: generateId(),
      file: trimmedFile,
      line: parsedLine,
      body: trimmedBody,
      severity,
      createdAt: new Date().toISOString(),
    };

    const updated = [...comments, newComment];
    setComments(updated);
    saveComments(updated);

    // Reset form
    setFile("");
    setLine("1");
    setSeverity("comment");
    setBody("");
  };

  const handleDelete = (id: string) => {
    const updated = comments.filter((c) => c.id !== id);
    setComments(updated);
    saveComments(updated);
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      await window.electronAPI.review.clear(commitHash);
      setComments([]);
    } catch {
      // best-effort
    }
    setConfirmClear(false);
  };

  const isAddDisabled =
    !file.trim() || !body.trim() || isNaN(parseInt(line, 10)) || parseInt(line, 10) < 1;

  const title = `Inline Review — ${commitHash.slice(0, 7)} (${comments.length} comment${comments.length !== 1 ? "s" : ""})`;

  return (
    <ModalDialog open={open} title={title} onClose={onClose} width={650}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Add Comment Form */}
        <div
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 12,
            }}
          >
            Add Comment
          </div>

          {/* File + Line row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>File Path</label>
              <input
                value={file}
                onChange={(e) => setFile(e.target.value)}
                placeholder="src/renderer/App.tsx"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
            <div style={{ width: 80 }}>
              <label style={labelStyle}>Line</label>
              <input
                type="number"
                min={1}
                value={line}
                onChange={(e) => setLine(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
          </div>

          {/* Severity selector */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Severity</label>
            <div
              style={{
                display: "flex",
                gap: 0,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid var(--border)",
                width: "fit-content",
              }}
            >
              {(["comment", "suggestion", "issue"] as Severity[]).map((s, idx) => {
                const active = severity === s;
                const col = SEVERITY_COLORS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    style={{
                      padding: "6px 16px",
                      fontSize: 12,
                      fontWeight: 500,
                      border: "none",
                      borderRight: idx < 2 ? "1px solid var(--border)" : "none",
                      background: active ? col.bg : "var(--surface-0)",
                      color: active ? col.text : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body textarea */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Comment</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the comment, suggestion, or issue..."
              rows={3}
              style={{
                ...inputStyle,
                fontFamily: "inherit",
                resize: "vertical",
                lineHeight: 1.5,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Add button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleAdd}
              disabled={isAddDisabled}
              style={{
                padding: "7px 18px",
                borderRadius: 6,
                border: "none",
                background: isAddDisabled ? "var(--surface-3)" : "var(--accent)",
                color: isAddDisabled ? "var(--text-muted)" : "var(--text-on-color)",
                fontSize: 12,
                fontWeight: 600,
                cursor: isAddDisabled ? "not-allowed" : "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Add Comment
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div>
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              Loading...
            </div>
          ) : comments.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                fontSize: 12,
                color: "var(--text-muted)",
                background: "var(--surface-0)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              No review comments yet. Add the first one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comments.map((comment) => {
                const col = SEVERITY_COLORS[comment.severity];
                return (
                  <div
                    key={comment.id}
                    style={{
                      background: "var(--surface-0)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {/* Top row: file/line + badge + delete */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        {/* Severity badge */}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            background: col.bg,
                            color: col.text,
                            flexShrink: 0,
                          }}
                        >
                          {col.label}
                        </span>

                        {/* File path + line */}
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            fontFamily: "monospace",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={`${comment.file}:${comment.line}`}
                        >
                          {comment.file}
                          <span style={{ color: "var(--text-muted)", marginLeft: 2 }}>
                            :{comment.line}
                          </span>
                        </span>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        title="Delete comment"
                        aria-label="Delete comment"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: "2px 4px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>

                    {/* Body */}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-primary)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {comment.body}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Clear All + Close */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 4,
          }}
        >
          <div>
            {comments.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${confirmClear ? "var(--red)" : "var(--border)"}`,
                  background: confirmClear ? "var(--red)" : "transparent",
                  color: confirmClear ? "var(--text-on-color)" : "var(--red)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {confirmClear ? "Confirm Clear All" : "Clear All"}
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setConfirmClear(false);
              onClose();
            }}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
