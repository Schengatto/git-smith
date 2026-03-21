import React, { useState, useEffect } from "react";
import { ModalDialog } from "./ModalDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  hash: string;
  subject: string;
}

export const NotesDialog: React.FC<Props> = ({ open, onClose, hash, subject }) => {
  const [note, setNote] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !hash) return;
    setLoading(true);
    setError("");
    window.electronAPI.notes
      .get(hash)
      .then((n) => {
        setNote(n);
        setOriginalNote(n);
      })
      .catch(() => {
        setNote("");
        setOriginalNote("");
      })
      .finally(() => setLoading(false));
  }, [open, hash]);

  const handleSave = async () => {
    setError("");
    try {
      if (note.trim()) {
        await window.electronAPI.notes.add(hash, note.trim());
      } else if (originalNote) {
        await window.electronAPI.notes.remove(hash);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async () => {
    setError("");
    try {
      await window.electronAPI.notes.remove(hash);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ModalDialog open={open} title="Git Notes" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Note for <span className="mono" style={{ color: "var(--accent)" }}>{hash.slice(0, 7)}</span>{" "}
          <span style={{ color: "var(--text-muted)" }}>{subject}</span>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}>
            Loading...
          </div>
        ) : (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note to this commit..."
            rows={6}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: "inherit",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              resize: "vertical",
            }}
          />
        )}

        {error && <div style={{ fontSize: 11, color: "var(--red)" }}>{error}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
        <div>
          {originalNote && (
            <button
              className="toolbar-btn"
              onClick={handleRemove}
              style={{ fontSize: 11, padding: "4px 12px", color: "var(--red)" }}
            >
              Remove Note
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="toolbar-btn" onClick={onClose} style={{ fontSize: 11, padding: "4px 12px" }}>
            Cancel
          </button>
          <button
            className="toolbar-btn"
            onClick={handleSave}
            style={{ fontSize: 11, padding: "4px 12px", background: "var(--accent)", color: "var(--base)" }}
          >
            Save
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
