import React, { useState } from "react";
import { ModalDialog, DialogActions } from "./ModalDialog";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";

interface Props {
  open: boolean;
  onClose: () => void;
  ref_: string;
  refLabel: string;
}

export const ArchiveDialog: React.FC<Props> = ({ open, onClose, ref_, refLabel }) => {
  const [format, setFormat] = useState<"zip" | "tar.gz">("zip");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleExport = async () => {
    setError("");
    setSuccess("");
    try {
      const dir = await window.electronAPI.repo.browseDirectory("Select output directory");
      if (!dir) return;
      const safeName = refLabel.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const ext = format === "zip" ? ".zip" : ".tar.gz";
      const outputPath = `${dir}/${safeName}${ext}`;
      await runGitOperation("archive", () =>
        window.electronAPI.archive.export(ref_, outputPath, format)
      );
      setSuccess(`Exported to ${outputPath}`);
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ModalDialog open={open} title="Archive / Export" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Export{" "}
          <span className="mono" style={{ color: "var(--accent)" }}>
            {refLabel}
          </span>{" "}
          as archive
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <input type="radio" checked={format === "zip"} onChange={() => setFormat("zip")} />
            ZIP
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <input
              type="radio"
              checked={format === "tar.gz"}
              onChange={() => setFormat("tar.gz")}
            />
            TAR.GZ
          </label>
        </div>
        {error && (
          <div style={{ fontSize: 11, color: "var(--red)", padding: "4px 0" }}>{error}</div>
        )}
        {success && (
          <div style={{ fontSize: 11, color: "var(--green)", padding: "4px 0" }}>{success}</div>
        )}
      </div>
      <DialogActions onCancel={onClose} onConfirm={handleExport} confirmLabel="Export" />
    </ModalDialog>
  );
};
