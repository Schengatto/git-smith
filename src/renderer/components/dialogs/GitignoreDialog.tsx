import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog } from "./ModalDialog";
import type { GitignoreTemplate } from "../../../shared/gitignore-templates";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const GitignoreDialog: React.FC<Props> = ({ open, onClose }) => {
  const [content, setContent] = useState("");
  const [ignoredFiles, setIgnoredFiles] = useState<string[]>([]);
  const [templates, setTemplates] = useState<GitignoreTemplate[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  const load = useCallback(async () => {
    try {
      const [text, tpls] = await Promise.all([
        window.electronAPI.gitignore.read(),
        window.electronAPI.gitignore.templates(),
      ]);
      setContent(text);
      setTemplates(tpls);
      setDirty(false);
    } catch {}
  }, []);

  const loadPreview = useCallback(async () => {
    try {
      const files = await window.electronAPI.gitignore.preview();
      setIgnoredFiles(files);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      load();
      loadPreview();
    }
  }, [open, load, loadPreview]);

  const save = async () => {
    setSaving(true);
    try {
      await window.electronAPI.gitignore.write(content);
      setDirty(false);
      await loadPreview();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const addPattern = () => {
    if (!newPattern.trim()) return;
    const line = newPattern.trim();
    const lines = content.split(/\r?\n/);
    if (lines.some((l) => l.trim() === line)) {
      setNewPattern("");
      return;
    }
    const sep = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    setContent(content + sep + line + "\n");
    setNewPattern("");
    setDirty(true);
  };

  const applyTemplate = (tpl: GitignoreTemplate) => {
    const existing = new Set(content.split(/\r?\n/).map((l) => l.trim()));
    const newPatterns = tpl.patterns.filter((p) => !existing.has(p));
    if (newPatterns.length === 0) return;
    const sep = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    const header = `\n# ${tpl.name}\n`;
    setContent(content + sep + header + newPatterns.join("\n") + "\n");
    setDirty(true);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
  });

  return (
    <ModalDialog open={open} title=".gitignore Editor" onClose={onClose} width={640}>
      <div
        style={{
          padding: "0 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: "70vh",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            style={tabStyle(activeTab === "editor")}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button
            style={tabStyle(activeTab === "preview")}
            onClick={() => {
              setActiveTab("preview");
              loadPreview();
            }}
          >
            Ignored Files ({ignoredFiles.length})
          </button>
        </div>

        {activeTab === "editor" && (
          <>
            {/* Add pattern row */}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPattern()}
                placeholder="Add pattern (e.g. *.log, dist/)"
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                onClick={addPattern}
                disabled={!newPattern.trim()}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  opacity: newPattern.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>

            {/* Templates */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Templates
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {templates.map((tpl) => (
                  <button
                    key={tpl.name}
                    onClick={() => applyTemplate(tpl)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface-0)",
                      color: "var(--text-primary)",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                    title={tpl.patterns.join(", ")}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor */}
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              rows={14}
              spellCheck={false}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                fontFamily: "var(--font-mono, monospace)",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.5,
              }}
            />

            {/* Save */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  opacity: dirty && !saving ? 1 : 0.5,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}

        {activeTab === "preview" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: 350,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
            }}
          >
            {ignoredFiles.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                No ignored files found
              </div>
            ) : (
              ignoredFiles.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono, monospace)",
                    borderBottom:
                      i < ignoredFiles.length - 1
                        ? "1px solid var(--border-subtle)"
                        : "none",
                  }}
                >
                  {f}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </ModalDialog>
  );
};
