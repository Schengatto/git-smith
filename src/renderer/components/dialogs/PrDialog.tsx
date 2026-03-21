import React, { useState, useEffect } from "react";
import { ModalDialog, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";

interface PrInfo {
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  sourceBranch: string;
  targetBranch: string;
  labels: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "list" | "create";

export const PrDialog: React.FC<Props> = ({ open, onClose }) => {
  const { repo } = useRepoStore();
  const [tab, setTab] = useState<Tab>("list");
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [provider, setProvider] = useState<{ provider: string; owner: string; repo: string; baseUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPr, setSelectedPr] = useState<PrInfo | null>(null);
  const [prDetail, setPrDetail] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [draft, setDraft] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerInfo, prList] = await Promise.all([
        window.electronAPI.pr.detectProvider(),
        window.electronAPI.pr.list(),
      ]);
      setProvider(providerInfo);
      setPrs(prList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setTab("list");
      setSelectedPr(null);
      setPrDetail("");
      setTitle("");
      setBody("");
      setTargetBranch("main");
      setDraft(false);
      loadData();
    }
  }, [open]);

  const handleViewPr = async (pr: PrInfo) => {
    setSelectedPr(pr);
    setPrDetail("Loading...");
    try {
      const detail = await window.electronAPI.pr.view(pr.number);
      setPrDetail(detail);
    } catch {
      setPrDetail("Failed to load details.");
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await window.electronAPI.pr.create({
        title: title.trim(),
        body: body.trim(),
        targetBranch,
        sourceBranch: repo?.currentBranch || "HEAD",
        draft,
      });
      setError(null);
      setTab("list");
      await loadData();
      if (result) {
        try { window.electronAPI.repo.openExternal(result); } catch { /* ignore */ }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const providerLabel = provider?.provider === "github" ? "GitHub" : provider?.provider === "gitlab" ? "GitLab" : "Unknown";
  const prLabel = provider?.provider === "gitlab" ? "Merge Request" : "Pull Request";

  const stateColor = (state: string) => {
    if (state === "open" || state === "opened") return "var(--green)";
    if (state === "closed") return "var(--red)";
    if (state === "merged") return "var(--mauve)";
    return "var(--text-muted)";
  };

  return (
    <ModalDialog open={open} title={`${prLabel}s (${providerLabel})`} onClose={onClose} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {provider?.provider === "unknown" && !loading && (
          <div style={{ fontSize: 12, color: "var(--peach)", padding: "8px 0" }}>
            Could not detect GitHub or GitLab from remote URL. Make sure &apos;gh&apos; or &apos;glab&apos; CLI is installed.
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => { setTab("list"); setSelectedPr(null); }}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 500,
              border: "none",
              borderBottom: tab === "list" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: tab === "list" ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            List ({prs.length})
          </button>
          <button
            onClick={() => setTab("create")}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 500,
              border: "none",
              borderBottom: tab === "create" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: tab === "create" ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Create New
          </button>
        </div>

        {tab === "list" && (
          <>
            {loading ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}>
                Loading...
              </div>
            ) : selectedPr ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="toolbar-btn"
                  onClick={() => setSelectedPr(null)}
                  style={{ fontSize: 11, padding: "3px 8px", alignSelf: "flex-start" }}
                >
                  Back to list
                </button>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  #{selectedPr.number} {selectedPr.title}
                </div>
                <pre
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    padding: 10,
                    borderRadius: 6,
                    background: "var(--surface-0)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                  }}
                >
                  {prDetail}
                </pre>
                <button
                  className="toolbar-btn"
                  onClick={() => window.electronAPI.repo.openExternal(selectedPr.url)}
                  style={{ fontSize: 11, padding: "4px 12px", alignSelf: "flex-start" }}
                >
                  Open in Browser
                </button>
              </div>
            ) : prs.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}>
                No {prLabel}s found
              </div>
            ) : (
              <div style={{ maxHeight: 350, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {prs.map((pr) => (
                  <div
                    key={pr.number}
                    onClick={() => handleViewPr(pr)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "var(--surface-0)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-0)")}
                  >
                    <span style={{ fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>#{pr.number}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pr.title}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 8, marginTop: 1 }}>
                        <span>{pr.sourceBranch} → {pr.targetBranch}</span>
                        <span>{pr.author}</span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: stateColor(pr.state) + "22",
                        color: stateColor(pr.state),
                        fontWeight: 600,
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {pr.state}
                    </span>
                    {pr.labels.length > 0 && (
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {pr.labels.slice(0, 3).map((l) => (
                          <span
                            key={l}
                            style={{
                              fontSize: 9,
                              padding: "0 4px",
                              borderRadius: 3,
                              background: "var(--accent-dim)",
                              color: "var(--accent)",
                            }}
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Source: <span style={{ color: "var(--accent)" }}>{repo?.currentBranch || "HEAD"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>Target:</label>
              <input
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  fontSize: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${prLabel} title...`}
              style={{
                padding: "6px 8px",
                fontSize: 12,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--surface-0)",
                color: "var(--text-primary)",
              }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Description (optional)..."
              rows={5}
              style={{
                padding: "6px 8px",
                fontSize: 12,
                fontFamily: "inherit",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                resize: "vertical",
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              Create as draft
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button
                className="toolbar-btn"
                onClick={onClose}
                style={{ fontSize: 11, padding: "5px 14px" }}
              >
                Cancel
              </button>
              <button
                className="toolbar-btn"
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                style={{
                  fontSize: 11,
                  padding: "5px 14px",
                  background: "var(--accent)",
                  color: "var(--base)",
                }}
              >
                {creating ? "Creating..." : `Create ${prLabel}`}
              </button>
            </div>
          </div>
        )}

        <DialogError error={error} />
      </div>
    </ModalDialog>
  );
};
