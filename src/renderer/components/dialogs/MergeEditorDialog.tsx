import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
}

interface FileVersions {
  base: string | null;
  ours: string | null;
  theirs: string | null;
}

const PANEL_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--text-muted)",
  marginBottom: 4,
  flexShrink: 0,
};

const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  flex: 1,
};

const TEXTAREA_STYLE: React.CSSProperties = {
  flex: 1,
  resize: "none",
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.5,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  outline: "none",
  minHeight: 0,
};

const TOOLBAR_BTN_STYLE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text-secondary)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.12s, color 0.12s",
};

function addLineNumbers(text: string | null): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4, " ")}  ${line}`)
    .join("\n");
}

export const MergeEditorDialog: React.FC<Props> = ({ open, onClose, filePath }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<FileVersions | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !filePath) return;

    setLoading(true);
    setError(null);
    setVersions(null);
    setResult("");

    window.electronAPI.conflict
      .fileContent(filePath)
      .then((data) => {
        setVersions(data);
        setResult(data.ours ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  const handleAcceptOurs = useCallback(() => {
    setResult(versions?.ours ?? "");
  }, [versions]);

  const handleAcceptTheirs = useCallback(() => {
    setResult(versions?.theirs ?? "");
  }, [versions]);

  const handleAcceptBoth = useCallback(() => {
    const ours = versions?.ours ?? "";
    const theirs = versions?.theirs ?? "";
    setResult(ours + "\n" + theirs);
  }, [versions]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await window.electronAPI.conflict.saveMerged(filePath, result);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [filePath, result, onClose]);

  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <ModalDialog
      open={open}
      title={`${t("mergeEditor.threeWayTitle")} — ${fileName}`}
      onClose={onClose}
      width={950}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>
            {t("mergeEditor.quickResolve")}
          </span>
          <button
            style={{
              ...TOOLBAR_BTN_STYLE,
              borderColor: "var(--green)",
              color: "var(--green)",
            }}
            onClick={handleAcceptOurs}
            disabled={loading || !versions}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--green-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-2)";
            }}
          >
            {t("mergeEditor.acceptOurs")}
          </button>
          <button
            style={{
              ...TOOLBAR_BTN_STYLE,
              borderColor: "var(--red)",
              color: "var(--red)",
            }}
            onClick={handleAcceptTheirs}
            disabled={loading || !versions}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--red-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-2)";
            }}
          >
            {t("mergeEditor.acceptTheirs")}
          </button>
          <button
            style={{
              ...TOOLBAR_BTN_STYLE,
              borderColor: "var(--mauve)",
              color: "var(--mauve)",
            }}
            onClick={handleAcceptBoth}
            disabled={loading || !versions}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--mauve-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-2)";
            }}
          >
            {t("mergeEditor.acceptBoth")}
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={handleSave}
            disabled={loading || saving || !versions}
            style={{
              padding: "5px 16px",
              borderRadius: 6,
              border: "none",
              background: loading || saving || !versions ? "var(--surface-3)" : "var(--accent)",
              color: loading || saving || !versions ? "var(--text-muted)" : "var(--text-on-color)",
              fontSize: 12,
              fontWeight: 700,
              cursor: loading || saving || !versions ? "not-allowed" : "pointer",
              transition: "background 0.12s",
            }}
          >
            {saving ? t("mergeEditor.saving") : t("mergeEditor.saveAndMarkResolved")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: 11,
              color: "var(--red)",
              background: "var(--red-dim)",
              borderRadius: 6,
              padding: "6px 10px",
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              minHeight: 200,
            }}
          >
            {t("mergeEditor.loadingFileVersions")}
          </div>
        )}

        {/* 3-panel source view */}
        {!loading && versions && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              flex: "0 0 auto",
              minHeight: 0,
            }}
          >
            {/* Ours */}
            <div style={PANEL_STYLE}>
              <div style={{ ...PANEL_LABEL_STYLE, color: "var(--green)" }}>
                {t("mergeEditor.oursBranch")}
              </div>
              <textarea
                readOnly
                value={addLineNumbers(versions.ours)}
                style={{
                  ...TEXTAREA_STYLE,
                  height: 180,
                  borderColor: "var(--green-dim)",
                  color: "var(--diff-ins-color)",
                  background: "var(--diff-ins-bg)",
                }}
                spellCheck={false}
              />
            </div>

            {/* Base */}
            <div style={PANEL_STYLE}>
              <div style={{ ...PANEL_LABEL_STYLE, color: "var(--accent)" }}>
                {t("mergeEditor.baseAncestor")}
              </div>
              <textarea
                readOnly
                value={addLineNumbers(versions.base)}
                style={{
                  ...TEXTAREA_STYLE,
                  height: 180,
                  borderColor: "var(--accent-dim)",
                }}
                spellCheck={false}
              />
            </div>

            {/* Theirs */}
            <div style={PANEL_STYLE}>
              <div style={{ ...PANEL_LABEL_STYLE, color: "var(--red)" }}>
                {t("mergeEditor.theirsIncoming")}
              </div>
              <textarea
                readOnly
                value={addLineNumbers(versions.theirs)}
                style={{
                  ...TEXTAREA_STYLE,
                  height: 180,
                  borderColor: "var(--red-dim)",
                  color: "var(--diff-del-color)",
                  background: "var(--diff-del-bg)",
                }}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* Result panel */}
        {!loading && versions && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                ...PANEL_LABEL_STYLE,
                color: "var(--yellow)",
                marginBottom: 4,
              }}
            >
              {t("mergeEditor.resultEditable")}
            </div>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              style={{
                ...TEXTAREA_STYLE,
                flex: 1,
                height: 200,
                borderColor: "var(--yellow-dim)",
                resize: "vertical",
              }}
              spellCheck={false}
              placeholder={t("mergeEditor.editPlaceholder")}
            />
          </div>
        )}
      </div>
    </ModalDialog>
  );
};
