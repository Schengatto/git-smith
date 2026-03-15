import React, { useState, useEffect, useRef, useCallback } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FolderIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

type Phase = "idle" | "scanning" | "done";

export const ScanDialog: React.FC<Props> = ({ open, onClose }) => {
  const { loadRecentRepos } = useRepoStore();
  const [rootPath, setRootPath] = useState("");
  const [maxDepth, setMaxDepth] = useState(4);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentDir, setCurrentDir] = useState("");
  const [foundRepos, setFoundRepos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRootPath("");
      setMaxDepth(4);
      setPhase("idle");
      setCurrentDir("");
      setFoundRepos([]);
      setError(null);
    }
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [open]);

  const handleBrowse = async () => {
    const dir = await window.electronAPI.repo.browseDirectory("Select directory to scan");
    if (dir) setRootPath(dir);
  };

  const handleScan = useCallback(async () => {
    if (!rootPath.trim()) return;
    setPhase("scanning");
    setError(null);
    setFoundRepos([]);
    setCurrentDir("");

    // Subscribe to progress events
    const unsub = window.electronAPI.on.scanProgress((progress) => {
      setCurrentDir(progress.currentDir);
      setFoundRepos(progress.found);
      if (progress.phase === "done") {
        setPhase("done");
      }
    });
    cleanupRef.current = unsub;

    try {
      await window.electronAPI.repo.scanForRepos(rootPath.trim(), maxDepth);
      await loadRecentRepos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    } finally {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  }, [rootPath, maxDepth, loadRecentRepos]);

  const handleClose = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    onClose();
  };

  const truncatePath = (p: string, maxLen = 60) => {
    if (p.length <= maxLen) return p;
    return "..." + p.slice(p.length - maxLen + 3);
  };

  return (
    <ModalDialog open={open} title="Scan for Repositories" onClose={handleClose} width={560}>
      {/* Root path */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          minWidth: 100,
          flexShrink: 0,
        }}>
          Scan from
        </label>
        <input
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          placeholder="C:/Projects"
          disabled={phase === "scanning"}
          autoFocus
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            minWidth: 0,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          onClick={handleBrowse}
          disabled={phase === "scanning"}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: phase === "scanning" ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (phase !== "scanning") e.currentTarget.style.background = "var(--surface-3)"; }}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        >
          Browse
        </button>
      </div>

      {/* Max depth */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          minWidth: 100,
          flexShrink: 0,
        }}>
          Max depth
        </label>
        <input
          type="number"
          value={maxDepth}
          onChange={(e) => setMaxDepth(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
          min={1}
          max={10}
          disabled={phase === "scanning"}
          style={{
            width: 70,
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          levels of subdirectories
        </span>
      </div>

      {/* Progress / scanning state */}
      {phase === "scanning" && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 6,
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          marginBottom: 12,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--accent)",
            marginBottom: 6,
          }}>
            <div style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
            Scanning... ({foundRepos.length} found)
          </div>
          <div style={{
            fontSize: 11,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {truncatePath(currentDir)}
          </div>
        </div>
      )}

      {/* Results */}
      {phase === "done" && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 6,
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          marginBottom: 12,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: foundRepos.length > 0 ? "var(--green)" : "var(--text-muted)",
            marginBottom: foundRepos.length > 0 ? 8 : 0,
            fontWeight: 600,
          }}>
            {foundRepos.length > 0 ? (
              <>
                <CheckIcon />
                {foundRepos.length} new {foundRepos.length === 1 ? "repository" : "repositories"} found and imported
              </>
            ) : (
              "No new repositories found in this directory"
            )}
          </div>
          {foundRepos.length > 0 && (
            <div style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}>
              {foundRepos.map((repo) => {
                const name = repo.replace(/\\/g, "/").split("/").pop() || repo;
                return (
                  <div
                    key={repo}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 6px",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    <FolderIcon size={13} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{name}</div>
                      <div style={{
                        color: "var(--text-muted)",
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {repo}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <DialogError error={error} />

      {phase === "done" ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            onClick={handleClose}
            style={{
              padding: "7px 18px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent)",
              color: "var(--surface-0)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      ) : (
        <DialogActions
          onCancel={handleClose}
          onConfirm={handleScan}
          confirmLabel="Scan"
          disabled={!rootPath.trim()}
          loading={phase === "scanning"}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ModalDialog>
  );
};
