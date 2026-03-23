import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import type { CommitInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  targetHash: string;
  targetSubject: string;
}

export const SquashDialog: React.FC<Props> = ({ open, onClose, targetHash, targetSubject }) => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  useEffect(() => {
    if (!open || !targetHash) return;
    setError(null);
    setLoading(false);
    setLoadingPreview(true);

    (async () => {
      try {
        const preview = await window.electronAPI.branch.squashPreview(targetHash);
        setCommits(preview);
        // Build combined message: all commit subjects, newest first
        const combined = preview.map((c) => c.subject).join("\n");
        setMessage(combined);
        requestAnimationFrame(() => textareaRef.current?.focus());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [open, targetHash]);

  const handleSquash = async () => {
    if (!message.trim()) {
      setError(t("squash.messageCannotBeEmpty"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Squash Commits", () =>
        window.electronAPI.branch.squashExecute({
          targetHash,
          message: message.trim(),
        })
      );
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const totalCommits = commits.length + 1; // includes the target commit

  return (
    <ModalDialog open={open} title={t("squash.title")} onClose={onClose} width={560}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("squash.squashCount", { count: totalCommits })}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("squash.fromHeadTo")}{" "}
        <span className="mono" style={{ color: "var(--accent)" }}>
          {targetHash.slice(0, 10)}
        </span>{" "}
        {targetSubject}
      </div>

      {/* Commits list */}
      <div
        style={{
          maxHeight: 160,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: 6,
          marginBottom: 12,
          background: "var(--surface-0)",
        }}
      >
        {loadingPreview ? (
          <div
            style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}
          >
            {t("squash.loadingCommits")}
          </div>
        ) : (
          <>
            {commits.map((c) => (
              <div
                key={c.hash}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 10px",
                  gap: 8,
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: 11,
                }}
              >
                <span className="mono" style={{ color: "var(--accent)", flexShrink: 0 }}>
                  {c.abbreviatedHash}
                </span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.subject}
                </span>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{c.authorName}</span>
              </div>
            ))}
            {/* Target commit (the oldest one, included in squash) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "5px 10px",
                gap: 8,
                fontSize: 11,
              }}
            >
              <span className="mono" style={{ color: "var(--accent)", flexShrink: 0 }}>
                {targetHash.slice(0, 7)}
              </span>
              <span
                style={{
                  color: "var(--text-primary)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {targetSubject}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Combined commit message editor */}
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
        {t("squash.squashedMessage")}
      </div>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          background: "var(--input-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 12,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
      />

      <div style={{ fontSize: 10, color: "var(--peach)", marginTop: 6, marginBottom: 4 }}>
        {t("squash.historyWarning")}
      </div>

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleSquash}
        confirmLabel={t("squash.squashButton")}
        confirmColor="var(--mauve)"
        loading={loading}
      />
    </ModalDialog>
  );
};
