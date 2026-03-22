import React, { useState, useEffect } from "react";
import { ModalDialog, DialogError } from "./ModalDialog";
import type { GistCreateOptions, GistResult } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  initialContent?: string;
  initialFilename?: string;
}

type Visibility = "public" | "secret";

export const GistDialog: React.FC<Props> = ({
  open,
  onClose,
  initialContent = "",
  initialFilename = "snippet.txt",
}) => {
  const [filename, setFilename] = useState(initialFilename);
  const [description, setDescription] = useState("");
  const [content, setContent] = useState(initialContent);
  const [visibility, setVisibility] = useState<Visibility>("secret");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GistResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(initialFilename || "snippet.txt");
      setDescription("");
      setContent(initialContent || "");
      setVisibility("secret");
      setLoading(false);
      setError(null);
      setResult(null);
      setCopied(false);
    }
  }, [open, initialContent, initialFilename]);

  const handleCreate = async () => {
    if (!filename.trim() || !content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const options: GistCreateOptions = {
        filename: filename.trim(),
        description: description.trim(),
        content: content,
        public: visibility === "public",
      };
      const res = await window.electronAPI.gist.create(options);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  const handleOpenInBrowser = () => {
    if (!result?.url) return;
    window.electronAPI.repo.openExternal(result.url);
  };

  const isCreateDisabled = !filename.trim() || !content.trim() || loading;

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
    marginBottom: 12,
  };

  return (
    <ModalDialog open={open} title="Create Gist / Snippet" onClose={onClose} width={600}>
      <div style={{ display: "flex", flexDirection: "column", padding: "4px 0" }}>
        {result ? (
          /* Success state */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--green)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                Gist created successfully!
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Gist URL</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "monospace",
                  }}
                >
                  {result.url}
                </span>
                <button
                  onClick={handleCopyUrl}
                  title="Copy URL"
                  style={{
                    background: "none",
                    border: "none",
                    color: copied ? "var(--green)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: "2px 4px",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!copied) e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!copied) e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {copied ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
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
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                onClick={onClose}
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
              <button
                onClick={handleOpenInBrowser}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text-on-color)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in Browser
              </button>
            </div>
          </div>
        ) : (
          /* Creation form */
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Filename</label>
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="snippet.txt"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type your snippet here..."
                rows={10}
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  fontSize: 12,
                  resize: "vertical",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            <div style={{ ...fieldStyle, marginBottom: 0 }}>
              <label style={labelStyle}>Visibility</label>
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  alignSelf: "flex-start",
                  width: "fit-content",
                }}
              >
                {(["secret", "public"] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    style={{
                      padding: "6px 18px",
                      fontSize: 12,
                      fontWeight: 500,
                      border: "none",
                      borderRight: v === "secret" ? "1px solid var(--border)" : "none",
                      background: visibility === v ? "var(--accent)" : "var(--surface-0)",
                      color: visibility === v ? "var(--text-on-color)" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {v === "secret" ? "Secret" : "Public"}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
                {visibility === "secret"
                  ? "Only people with the URL can view this gist."
                  : "Anyone can discover and view this gist."}
              </div>
            </div>

            <DialogError error={error} />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                onClick={onClose}
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
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreateDisabled}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: isCreateDisabled ? "var(--surface-3)" : "var(--accent)",
                  color: isCreateDisabled ? "var(--text-muted)" : "var(--text-on-color)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isCreateDisabled ? "not-allowed" : "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {loading ? "Creating..." : "Create Gist"}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalDialog>
  );
};
