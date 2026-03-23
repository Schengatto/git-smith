import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";
import type { UndoEntry } from "../../../shared/git-types";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useUIStore } from "../../store/ui-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const UndoDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<UndoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);
  const { refreshStatus, refreshInfo } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const showToast = useUIStore((s) => s.showToast);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const history = await window.electronAPI.undo.history(30);
      setEntries(history);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleUndo = async (entry: UndoEntry) => {
    if (!confirm(t("undo.resetConfirm", { description: entry.description }))) return;
    setReverting(entry.index);
    try {
      await window.electronAPI.undo.revert(entry.index);
      showToast(t("undo.revertedTo", { description: entry.description }), "info");
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      await load();
    } catch (err) {
      showToast(t("undo.undoFailed", { error: String(err) }), "error");
    } finally {
      setReverting(null);
    }
  };

  const actionColors: Record<string, string> = {
    commit: "var(--green)",
    checkout: "var(--blue)",
    merge: "var(--mauve)",
    rebase: "var(--peach)",
    reset: "var(--red)",
    pull: "var(--teal)",
    "cherry-pick": "var(--pink)",
  };

  const getActionColor = (action: string): string => {
    for (const [key, color] of Object.entries(actionColors)) {
      if (action.toLowerCase().includes(key)) return color;
    }
    return "var(--text-muted)";
  };

  return (
    <ModalDialog open={open} title={t("undo.title")} onClose={onClose} width={600}>
      <div style={{ padding: "0 16px 16px", maxHeight: "60vh", overflowY: "auto" }}>
        {loading && entries.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {t("dialogs.loading")}
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {t("undo.noReflogEntries")}
          </div>
        )}
        {entries.map((entry, idx) => (
          <div
            key={`${entry.hash}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderBottom: idx < entries.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent)",
                minWidth: 60,
                flexShrink: 0,
              }}
            >
              {entry.hash.slice(0, 7)}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 8,
                background: `color-mix(in srgb, ${getActionColor(entry.action)} 20%, transparent)`,
                color: getActionColor(entry.action),
                flexShrink: 0,
                textTransform: "uppercase",
              }}
            >
              {entry.action.split(":")[0]?.split("(")[0]?.trim() || "?"}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-primary)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.description}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
              {new Date(entry.date).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {idx > 0 && (
              <button
                onClick={() => handleUndo(entry)}
                disabled={reverting !== null}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 10,
                  cursor: reverting !== null ? "wait" : "pointer",
                  flexShrink: 0,
                  opacity: reverting === entry.index ? 0.5 : 1,
                }}
              >
                {reverting === entry.index ? "..." : t("undo.undoButton")}
              </button>
            )}
          </div>
        ))}
      </div>
    </ModalDialog>
  );
};
