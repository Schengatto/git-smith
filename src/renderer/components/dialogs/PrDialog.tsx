import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useMcpStore } from "../../store/mcp-store";

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
  const { t } = useTranslation();
  const { repo } = useRepoStore();
  const { generating, generatePrTitle, generatePrDescription } = useMcpStore();
  const [tab, setTab] = useState<Tab>("list");
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [provider, setProvider] = useState<{
    provider: string;
    owner: string;
    repo: string;
    baseUrl: string;
  } | null>(null);
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
  const [aiError, setAiError] = useState<string | null>(null);

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
    setPrDetail(t("dialogs.loading"));
    try {
      const detail = await window.electronAPI.pr.view(pr.number);
      setPrDetail(detail);
    } catch {
      setPrDetail(t("pr.failedToLoadDetails"));
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
        try {
          window.electronAPI.repo.openExternal(result);
        } catch {
          /* ignore */
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleAiGenerate = async () => {
    setAiError(null);
    const source = repo?.currentBranch || "HEAD";
    try {
      const [aiTitle, aiBody] = await Promise.all([
        generatePrTitle(source, targetBranch),
        generatePrDescription(source, targetBranch),
      ]);
      setTitle(aiTitle);
      setBody(aiBody);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    }
  };

  const providerLabel =
    provider?.provider === "github"
      ? t("pr.github")
      : provider?.provider === "gitlab"
        ? t("pr.gitlab")
        : t("pr.unknown");
  const prLabel = provider?.provider === "gitlab" ? t("pr.mergeRequest") : t("pr.pullRequest");

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
            {t("pr.providerUnknown")}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => {
              setTab("list");
              setSelectedPr(null);
            }}
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
            {t("pr.list")} ({prs.length})
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
            {t("pr.createNew")}
          </button>
        </div>

        {tab === "list" && (
          <>
            {loading ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: 16,
                  textAlign: "center",
                }}
              >
                {t("dialogs.loading")}
              </div>
            ) : selectedPr ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="toolbar-btn"
                  onClick={() => setSelectedPr(null)}
                  style={{ fontSize: 11, padding: "3px 8px", alignSelf: "flex-start" }}
                >
                  {t("pr.backToList")}
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
                  {t("pr.openInBrowser")}
                </button>
              </div>
            ) : prs.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: 16,
                  textAlign: "center",
                }}
              >
                {t("pr.noPrsFound", { prLabel })}
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 350,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
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
                    <span style={{ fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
                      #{pr.number}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pr.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          display: "flex",
                          gap: 8,
                          marginTop: 1,
                        }}
                      >
                        <span>
                          {pr.sourceBranch} → {pr.targetBranch}
                        </span>
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
              {t("pr.source")}{" "}
              <span style={{ color: "var(--accent)" }}>{repo?.currentBranch || "HEAD"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>
                {t("pr.target")}
              </label>
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
            <button
              onClick={handleAiGenerate}
              disabled={generating}
              title={aiError || t("pr.aiGenerateTitle")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: generating ? "var(--surface-2)" : "var(--surface-0)",
                color: aiError ? "var(--red)" : "var(--text-secondary)",
                fontSize: 11,
                cursor: generating ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                alignSelf: "flex-start",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {generating ? t("pr.generating") : t("pr.aiGenerate")}
            </button>
            {aiError && <div style={{ fontSize: 11, color: "var(--red)" }}>{aiError}</div>}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("pr.titlePlaceholder", { prLabel })}
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
              placeholder={t("pr.descriptionPlaceholder")}
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
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              {t("pr.createAsDraft")}
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button
                className="toolbar-btn"
                onClick={onClose}
                style={{ fontSize: 11, padding: "5px 14px" }}
              >
                {t("dialogs.cancel")}
              </button>
              <button
                className="toolbar-btn"
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                style={{
                  fontSize: 11,
                  padding: "5px 14px",
                  background: "var(--accent)",
                  color: "var(--text-on-color)",
                }}
              >
                {creating ? t("pr.creating") : t("pr.createPrButton", { prLabel })}
              </button>
            </div>
          </div>
        )}

        <DialogError error={error} />
      </div>
    </ModalDialog>
  );
};
