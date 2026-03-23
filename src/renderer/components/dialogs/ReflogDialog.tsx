import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";
import { useGraphStore } from "../../store/graph-store";
import type { ReflogEntry } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const actionColor = (action: string): string => {
  if (action.startsWith("commit")) return "var(--green)";
  if (action.startsWith("checkout")) return "var(--accent)";
  if (action.startsWith("merge")) return "var(--mauve)";
  if (action.startsWith("rebase")) return "var(--peach)";
  if (action.startsWith("pull")) return "var(--yellow)";
  if (action.startsWith("reset")) return "var(--red)";
  if (action.startsWith("cherry-pick")) return "var(--peach)";
  if (action.startsWith("revert")) return "var(--red)";
  return "var(--text-muted)";
};

const actionBadgeBg = (action: string): string => {
  if (action.startsWith("commit")) return "var(--green-dim)";
  if (action.startsWith("checkout")) return "var(--accent-dim)";
  if (action.startsWith("merge")) return "var(--mauve-dim)";
  if (action.startsWith("rebase")) return "var(--yellow-dim)";
  if (action.startsWith("pull")) return "var(--yellow-dim)";
  if (action.startsWith("reset")) return "var(--red-dim)";
  if (action.startsWith("cherry-pick")) return "var(--yellow-dim)";
  if (action.startsWith("revert")) return "var(--red-dim)";
  return "var(--surface-3)";
};

export const ReflogDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const { selectCommit } = useGraphStore();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFilter("");
    window.electronAPI.reflog
      .list(200)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = filter.trim()
    ? entries.filter((e) => {
        const q = filter.toLowerCase();
        return (
          e.subject.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.abbreviatedHash.toLowerCase().includes(q) ||
          e.selector.toLowerCase().includes(q)
        );
      })
    : entries;

  const handleNavigate = useCallback(
    (hash: string) => {
      selectCommit(hash);
      onClose();
    },
    [selectCommit, onClose]
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ModalDialog open={open} title={t("reflog.title")} onClose={onClose} width={680}>
      {/* Filter input */}
      <div style={{ marginBottom: 10 }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("reflog.filterPlaceholder")}
          style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 12,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Info */}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {loading
            ? t("dialogs.loading")
            : `${filtered.length} ${filtered.length === 1 ? t("reflog.entry") : t("reflog.entries")}`}
        </span>
        <span>{t("reflog.clickToNavigate")}</span>
      </div>

      {/* Table */}
      <div
        style={{
          maxHeight: 380,
          overflowY: "auto",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
        }}
      >
        {filtered.length === 0 && !loading ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {entries.length === 0 ? t("reflog.noEntriesFound") : t("reflog.noEntriesMatchFilter")}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={`${entry.selector}-${i}`}
              onClick={() => handleNavigate(entry.hash)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                cursor: "pointer",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                fontSize: 12,
                background: "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Selector (HEAD@{n}) */}
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  minWidth: 72,
                  flexShrink: 0,
                }}
              >
                {entry.selector}
              </span>

              {/* Hash */}
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  minWidth: 56,
                  flexShrink: 0,
                }}
              >
                {entry.abbreviatedHash}
              </span>

              {/* Action badge */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 3,
                  color: actionColor(entry.action),
                  background: actionBadgeBg(entry.action),
                  flexShrink: 0,
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.action}
              </span>

              {/* Subject */}
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text-secondary)",
                }}
              >
                {entry.subject}
              </span>

              {/* Date */}
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {formatDate(entry.date)}
              </span>
            </div>
          ))
        )}
      </div>
    </ModalDialog>
  );
};
