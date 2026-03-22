import React, { useState, useEffect } from "react";
import type { ChangelogData } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  commitSubject?: string;
  mode?: "overlay" | "window";
}

export const ChangelogDialog: React.FC<Props> = ({
  open,
  onClose,
  commitHash,
  commitSubject,
  mode = "overlay",
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedBase, setSelectedBase] = useState("");
  const [customBase, setCustomBase] = useState("");
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChangelog(null);
    setError(null);
    setLoading(false);
    setCustomBase("");
    window.electronAPI.changelog
      .getTagsBefore(commitHash)
      .then((result) => {
        setTags(result);
        if (result.length > 0) setSelectedBase(result[0]!);
        else setSelectedBase("__custom__");
      })
      .catch(() => {
        setTags([]);
        setSelectedBase("__custom__");
      });
  }, [open, commitHash]);

  // Auto-generate when selectedBase changes (including initial load)
  useEffect(() => {
    if (!open || !selectedBase || selectedBase === "__custom__") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.electronAPI.changelog
      .generate(selectedBase, commitHash)
      .then((result) => {
        if (!cancelled) setChangelog(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedBase, commitHash]);

  useEffect(() => {
    if (mode === "window") {
      document.title = changelog ? `Changelog — ${changelog.from}..${changelog.to}` : "Changelog";
    }
  }, [changelog, mode]);

  const effectiveBase = selectedBase === "__custom__" ? customBase.trim() : selectedBase;

  const handleGenerateCustom = async () => {
    if (!effectiveBase) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.changelog.generate(effectiveBase, commitHash);
      setChangelog(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!changelog) return;
    const md = changelogToMarkdown(changelog);
    navigator.clipboard.writeText(md);
  };

  if (!open) return null;

  const isWindow = mode === "window";

  return (
    <div
      style={{
        ...(isWindow
          ? { height: "100vh", display: "flex", flexDirection: "column" }
          : {
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }),
        background: isWindow ? "var(--surface-0)" : undefined,
      }}
    >
      <div
        style={{
          ...(isWindow
            ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
            : {
                background: "var(--surface-0)",
                borderRadius: 8,
                width: 700,
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
              }),
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--surface-2)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 13, flexShrink: 0 }}>From</span>
            <select
              value={selectedBase}
              onChange={(e) => setSelectedBase(e.target.value)}
              style={{
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 13,
                flex: 1,
                minWidth: 0,
              }}
            >
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
              <option value="__custom__">Custom ref...</option>
            </select>
            <span style={{ color: "var(--text-muted)", fontSize: 13, flexShrink: 0 }}>to</span>
            <span
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 13,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
                flex: 1,
              }}
            >
              {commitHash.slice(0, 7)}
              {commitSubject ? ` — ${commitSubject}` : ""}
            </span>
          </div>
          {selectedBase === "__custom__" && (
            <input
              type="text"
              value={customBase}
              onChange={(e) => setCustomBase(e.target.value)}
              placeholder="branch, tag, or commit hash"
              style={{
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 16,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {error && <div style={{ color: "var(--red)", marginBottom: 12 }}>{error}</div>}
          {!changelog && !error && loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              Generating changelog...
            </div>
          )}
          {!changelog && !error && !loading && selectedBase === "__custom__" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              Enter a ref and click Generate
            </div>
          )}
          {changelog && changelog.totalCommits === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              No commits in this range
            </div>
          )}
          {changelog &&
            changelog.totalCommits > 0 &&
            changelog.groups.map((group) => (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    color: group.color,
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  {group.label === "Breaking Changes" ? "⚠ " : "✦ "}
                  {group.label}
                </div>
                <div
                  style={{
                    paddingLeft: 12,
                    borderLeft: `2px solid ${group.color}`,
                  }}
                >
                  {group.entries.map((entry) => (
                    <div key={entry.hash} style={{ marginBottom: 4 }}>
                      <span style={{ color: "var(--text-primary)" }}>
                        {entry.scope && <strong>{entry.scope}: </strong>}
                        {entry.description}
                      </span>
                      <span
                        style={{
                          color: "var(--overlay1)",
                          marginLeft: 8,
                          fontSize: 11,
                        }}
                      >
                        {entry.abbreviatedHash}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--overlay1)", fontSize: 12 }}>
            {changelog
              ? `${changelog.totalCommits} commits · ${changelog.authors.length} authors`
              : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedBase === "__custom__" && (
              <button
                onClick={handleGenerateCustom}
                disabled={!effectiveBase || loading}
                style={{
                  background: "var(--blue)",
                  color: "var(--text-on-color)",
                  border: "none",
                  borderRadius: 4,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: effectiveBase && !loading ? "pointer" : "not-allowed",
                  opacity: !effectiveBase || loading ? 0.6 : 1,
                }}
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            )}
            {changelog && (
              <button
                onClick={handleCopyMarkdown}
                style={{
                  background: "var(--surface-1)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--surface-2)",
                  borderRadius: 4,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Copy as Markdown
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function changelogToMarkdown(data: ChangelogData): string {
  const lines: string[] = [`## Changelog (${data.from}..${data.to})`, ""];
  for (const group of data.groups) {
    const icon = group.label === "Breaking Changes" ? "⚠ " : "";
    lines.push(`### ${icon}${group.label}`);
    for (const entry of group.entries) {
      const scopePrefix = entry.scope ? `**${entry.scope}:** ` : "";
      lines.push(`- ${scopePrefix}${entry.description} (${entry.abbreviatedHash})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
