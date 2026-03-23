import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogError } from "./ModalDialog";
import type { GitHookInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const COMMON_HOOKS = [
  "pre-commit",
  "commit-msg",
  "pre-push",
  "prepare-commit-msg",
  "post-commit",
  "post-merge",
  "pre-rebase",
];

export const HooksDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingHook, setTogglingHook] = useState<string | null>(null);
  const [deletingHook, setDeletingHook] = useState<string | null>(null);

  const loadHooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.hooks.list();
      setHooks(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedHook(null);
      setEditContent("");
      setError(null);
      loadHooks();
    }
  }, [open]);

  const visibleHooks = hooks.filter(
    (h) => h.content.trim() !== "" || COMMON_HOOKS.includes(h.name)
  );

  const handleSelectHook = (hook: GitHookInfo) => {
    setSelectedHook(hook.name);
    setEditContent(hook.content);
    setError(null);
  };

  const handleToggle = async (name: string) => {
    setTogglingHook(name);
    setError(null);
    try {
      await window.electronAPI.hooks.toggle(name);
      await loadHooks();
      if (selectedHook === name) {
        const updated = await window.electronAPI.hooks.list();
        const hook = updated.find((h) => h.name === name);
        if (hook) setEditContent(hook.content);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTogglingHook(null);
    }
  };

  const handleSave = async () => {
    if (!selectedHook) return;
    setSaving(true);
    setError(null);
    try {
      await window.electronAPI.hooks.write(selectedHook, editContent);
      await loadHooks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(t("hooks.deleteHookConfirm", { name }))) return;
    setDeletingHook(name);
    setError(null);
    try {
      await window.electronAPI.hooks.delete(name);
      if (selectedHook === name) {
        setSelectedHook(null);
        setEditContent("");
      }
      await loadHooks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingHook(null);
    }
  };

  const selectedHookInfo = hooks.find((h) => h.name === selectedHook) ?? null;
  const hasContent = (hook: GitHookInfo) => hook.content.trim() !== "";

  return (
    <ModalDialog open={open} title={t("hooks.title")} onClose={onClose} width={700}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, minHeight: 320 }}>
          {/* Hook list */}
          <div
            style={{
              width: 180,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: 6,
              overflowY: "auto",
            }}
          >
            {loading ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  padding: 8,
                  textAlign: "center",
                }}
              >
                {t("dialogs.loading")}
              </div>
            ) : visibleHooks.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  padding: 8,
                  textAlign: "center",
                }}
              >
                {t("hooks.noHooks")}
              </div>
            ) : (
              visibleHooks.map((hook) => {
                const isSelected = selectedHook === hook.name;
                const active = hook.active;
                const hasCnt = hasContent(hook);
                return (
                  <button
                    key={hook.name}
                    onClick={() => handleSelectHook(hook)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "5px 8px",
                      borderRadius: 4,
                      border: "none",
                      background: isSelected ? "var(--accent)" : "transparent",
                      color: isSelected
                        ? "var(--text-on-color)"
                        : hasCnt
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {/* Status dot */}
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: !hasCnt
                          ? "var(--border)"
                          : active
                            ? "var(--green)"
                            : "var(--text-muted)",
                        opacity: !hasCnt ? 0.4 : 1,
                      }}
                    />
                    {hook.name}
                  </button>
                );
              })
            )}
          </div>

          {/* Editor panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedHook && selectedHookInfo ? (
              <>
                {/* Hook header bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: "var(--surface-0)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                  }}
                >
                  {/* Active status indicator */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: hasContent(selectedHookInfo)
                        ? selectedHookInfo.active
                          ? "var(--green)"
                          : "var(--text-muted)"
                        : "var(--border)",
                      opacity: hasContent(selectedHookInfo) ? 1 : 0.4,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: "monospace",
                    }}
                  >
                    {selectedHook}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: hasContent(selectedHookInfo)
                        ? selectedHookInfo.active
                          ? "var(--green)"
                          : "var(--text-muted)"
                        : "var(--border)",
                      fontWeight: 500,
                      marginRight: 4,
                    }}
                  >
                    {hasContent(selectedHookInfo)
                      ? selectedHookInfo.active
                        ? t("hooks.active")
                        : t("hooks.inactive")
                      : t("hooks.noContent")}
                  </span>

                  {/* Toggle button */}
                  <button
                    onClick={() => handleToggle(selectedHook)}
                    disabled={togglingHook === selectedHook || !hasContent(selectedHookInfo)}
                    title={
                      !hasContent(selectedHookInfo)
                        ? t("hooks.saveContentFirst")
                        : selectedHookInfo.active
                          ? t("hooks.disableHook")
                          : t("hooks.enableHook")
                    }
                    style={{
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: !hasContent(selectedHookInfo)
                        ? "var(--text-muted)"
                        : selectedHookInfo.active
                          ? "var(--red)"
                          : "var(--green)",
                      cursor: !hasContent(selectedHookInfo) ? "not-allowed" : "pointer",
                      opacity: !hasContent(selectedHookInfo) ? 0.5 : 1,
                    }}
                  >
                    {togglingHook === selectedHook
                      ? "..."
                      : selectedHookInfo.active
                        ? t("hooks.disable")
                        : t("hooks.enable")}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(selectedHook)}
                    disabled={deletingHook === selectedHook || !hasContent(selectedHookInfo)}
                    title={t("hooks.deleteHook")}
                    style={{
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: !hasContent(selectedHookInfo) ? "var(--text-muted)" : "var(--red)",
                      cursor: !hasContent(selectedHookInfo) ? "not-allowed" : "pointer",
                      opacity: !hasContent(selectedHookInfo) ? 0.5 : 1,
                    }}
                  >
                    {deletingHook === selectedHook ? "..." : t("dialogs.delete")}
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  spellCheck={false}
                  placeholder={`#!/bin/sh\n# ${selectedHook} hook`}
                  style={{
                    flex: 1,
                    minHeight: 220,
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-0)",
                    color: "var(--text-primary)",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />

                {/* Save row */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "6px 18px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "none",
                      background: saving ? "var(--surface-3)" : "var(--accent)",
                      color: saving ? "var(--text-muted)" : "var(--text-on-color)",
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? t("hooks.saving") : t("dialogs.save")}
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  border: "1px dashed var(--border)",
                  borderRadius: 6,
                  padding: 16,
                }}
              >
                {t("hooks.selectHookPrompt")}
              </div>
            )}
          </div>
        </div>

        <DialogError error={error} />

        {/* Close footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: "7px 18px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {t("dialogs.close")}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
