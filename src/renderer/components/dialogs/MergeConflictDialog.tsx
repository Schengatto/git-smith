import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ConflictFile, ConflictFileContent } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after all conflicts are resolved and user clicks Continue */
  onResolved?: () => void;
}

/**
 * A section of file content that is either common (identical in both)
 * or a conflict (different between ours and theirs).
 */
interface MergeSection {
  type: "common" | "conflict";
  /** Lines common to both sides (only for type=common) */
  common?: string[];
  /** Our (local) version lines (only for type=conflict) */
  ours?: string[];
  /** Their (remote) version lines (only for type=conflict) */
  theirs?: string[];
  /** Resolution state: null=unresolved, "ours"/"theirs"/"both"/"custom" */
  resolution: string | null;
  /** Custom merged lines (when resolution is set) */
  resolved?: string[];
}

export const MergeConflictDialog: React.FC<Props> = ({ open, onClose, onResolved }) => {
  const [files, setFiles] = useState<ConflictFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<ConflictFileContent | null>(null);
  const [sections, setSections] = useState<MergeSection[]>([]);
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leftRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  // Sync scroll across 3 panes
  const handleScroll = useCallback((source: "left" | "center" | "right") => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    const sourceEl =
      source === "left" ? leftRef.current :
      source === "center" ? centerRef.current :
      rightRef.current;
    if (!sourceEl) { scrollingRef.current = false; return; }
    const top = sourceEl.scrollTop;
    if (source !== "left" && leftRef.current) leftRef.current.scrollTop = top;
    if (source !== "center" && centerRef.current) centerRef.current.scrollTop = top;
    if (source !== "right" && rightRef.current) rightRef.current.scrollTop = top;
    requestAnimationFrame(() => { scrollingRef.current = false; });
  }, []);

  // Load conflict files when dialog opens
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setSelectedFile(null);
    setContent(null);
    setSections([]);
    setResolvedFiles(new Set());
    setError(null);

    setLoading(true);
    window.electronAPI.conflict
      .list()
      .then((conflictFiles) => {
        setFiles(conflictFiles);
        if (conflictFiles.length > 0) {
          setSelectedFile(conflictFiles[0].path);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile) {
      setContent(null);
      setSections([]);
      return;
    }
    setLoading(true);
    window.electronAPI.conflict
      .fileContent(selectedFile)
      .then((fc) => {
        setContent(fc);
        setSections(parseMergeSections(fc.merged));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [selectedFile]);

  const resolveSection = useCallback((index: number, pick: "ours" | "theirs" | "both") => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[index] };
      s.resolution = pick;
      if (pick === "ours") s.resolved = s.ours ? [...s.ours] : [];
      else if (pick === "theirs") s.resolved = s.theirs ? [...s.theirs] : [];
      else s.resolved = [...(s.ours || []), ...(s.theirs || [])];
      next[index] = s;
      return next;
    });
  }, []);

  const unresolveSection = useCallback((index: number) => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[index] };
      s.resolution = null;
      s.resolved = undefined;
      next[index] = s;
      return next;
    });
  }, []);

  const resolveAllAs = useCallback((pick: "ours" | "theirs") => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.type !== "conflict") return s;
        const resolved = pick === "ours" ? (s.ours ? [...s.ours] : []) : (s.theirs ? [...s.theirs] : []);
        return { ...s, resolution: pick, resolved };
      })
    );
  }, []);

  const unresolvedCount = sections.filter((s) => s.type === "conflict" && !s.resolution).length;
  const totalConflicts = sections.filter((s) => s.type === "conflict").length;
  const allSectionsResolved = unresolvedCount === 0;

  const handleSaveAndResolve = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      // Build final merged content from sections
      const merged = buildMergedContent(sections);
      await window.electronAPI.conflict.saveMerged(selectedFile, merged);
      await window.electronAPI.conflict.resolve(selectedFile);
      setResolvedFiles((prev) => new Set([...prev, selectedFile]));

      // Move to next unresolved file
      const remaining = files.filter(
        (f) => f.path !== selectedFile && !resolvedFiles.has(f.path)
      );
      if (remaining.length > 0) {
        setSelectedFile(remaining[0].path);
      } else {
        setSelectedFile(null);
        setContent(null);
        setSections([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedFile, sections, files, resolvedFiles]);

  const allFilesResolved = files.length > 0 && files.every((f) => resolvedFiles.has(f.path));
  const unresolvedFileCount = files.filter((f) => !resolvedFiles.has(f.path)).length;

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 0.15s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "95vw",
          maxWidth: 1400,
          height: "90vh",
          maxHeight: 850,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modal-in 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Resolve merge conflicts
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {unresolvedFileCount} unresolved {unresolvedFileCount === 1 ? "file" : "files"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* File list sidebar */}
          <div style={{
            width: 200,
            borderRight: "1px solid var(--border-subtle)",
            overflowY: "auto",
            flexShrink: 0,
          }}>
            <div style={{
              padding: "8px 12px",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              Unresolved merge conflicts
            </div>
            {files.map((f) => {
              const isResolved = resolvedFiles.has(f.path);
              const isSelected = f.path === selectedFile;
              return (
                <div
                  key={f.path}
                  onClick={() => !isResolved && setSelectedFile(f.path)}
                  style={{
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: isResolved ? "default" : "pointer",
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                    borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                    opacity: isResolved ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isResolved) e.currentTarget.style.background = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isResolved ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  )}
                  <span className="truncate mono" style={{
                    fontSize: 11,
                    color: isResolved ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: isResolved ? "line-through" : "none",
                  }}>
                    {f.path.split("/").pop()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 3-pane editor area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {selectedFile && content ? (
              <>
                {/* Toolbar with actions */}
                <div style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {selectedFile}
                    </span>
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 3,
                      background: "var(--yellow)20", color: "var(--yellow)", fontWeight: 500,
                    }}>
                      {totalConflicts} {totalConflicts === 1 ? "conflict" : "conflicts"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <QuickBtn label="Accept all LOCAL" color="var(--accent)" onClick={() => resolveAllAs("ours")} />
                    <QuickBtn label="Accept all REMOTE" color="var(--mauve)" onClick={() => resolveAllAs("theirs")} />
                    {allSectionsResolved ? (
                      <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 500 }}>All conflicts resolved</span>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--yellow)" }}>{unresolvedCount} unresolved</span>
                    )}
                  </div>
                </div>

                {/* 3-pane column headers */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ ...paneHeaderStyle, borderRight: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>LOCAL</span>
                    <span style={{ color: "var(--text-muted)" }}>(ours / current)</span>
                  </div>
                  <div style={{ ...paneHeaderStyle, borderRight: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>MERGED</span>
                    <span style={{ color: "var(--text-muted)" }}>(result)</span>
                  </div>
                  <div style={paneHeaderStyle}>
                    <span style={{ color: "var(--mauve)", fontWeight: 600 }}>REMOTE</span>
                    <span style={{ color: "var(--text-muted)" }}>(theirs / incoming)</span>
                  </div>
                </div>

                {/* 3-pane content */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                  {/* LEFT: ours */}
                  <div
                    ref={leftRef}
                    onScroll={() => handleScroll("left")}
                    style={{ ...paneStyle, borderRight: "1px solid var(--border-subtle)" }}
                  >
                    {sections.map((s, i) => (
                      <PaneSection key={i} section={s} side="ours" index={i} onResolve={resolveSection} onUnresolve={unresolveSection} />
                    ))}
                  </div>

                  {/* CENTER: merged */}
                  <div
                    ref={centerRef}
                    onScroll={() => handleScroll("center")}
                    style={{ ...paneStyle, borderRight: "1px solid var(--border-subtle)" }}
                  >
                    {sections.map((s, i) => (
                      <PaneSection key={i} section={s} side="merged" index={i} onResolve={resolveSection} onUnresolve={unresolveSection} />
                    ))}
                  </div>

                  {/* RIGHT: theirs */}
                  <div
                    ref={rightRef}
                    onScroll={() => handleScroll("right")}
                    style={paneStyle}
                  >
                    {sections.map((s, i) => (
                      <PaneSection key={i} section={s} side="theirs" index={i} onResolve={resolveSection} onUnresolve={unresolveSection} />
                    ))}
                  </div>
                </div>

                {/* File action bar */}
                <div style={{
                  padding: "8px 12px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}>
                  {!allSectionsResolved && (
                    <span style={{ fontSize: 11, color: "var(--yellow)", alignSelf: "center", marginRight: "auto" }}>
                      Resolve all conflicts before marking as resolved
                    </span>
                  )}
                  <button
                    onClick={handleSaveAndResolve}
                    disabled={saving || !allSectionsResolved}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none",
                      background: saving || !allSectionsResolved ? "var(--surface-3)" : "var(--green)",
                      color: saving || !allSectionsResolved ? "var(--text-muted)" : "var(--surface-0)",
                      fontSize: 12, fontWeight: 600,
                      cursor: saving || !allSectionsResolved ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Saving..." : "Mark as resolved"}
                  </button>
                </div>
              </>
            ) : loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Loading...
              </div>
            ) : allFilesResolved ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: 14, color: "var(--green)", fontWeight: 600 }}>All conflicts resolved!</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>You can now continue the operation.</span>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                {files.length === 0 ? "No conflicted files found" : "Select a file to resolve"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {resolvedFiles.size} of {files.length} files resolved
          </div>
          {error && (
            <span style={{ fontSize: 11, color: "var(--red)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {error}
            </span>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Close</button>
            {allFilesResolved && onResolved && (
              <button onClick={onResolved} style={primaryBtnStyle}>Continue</button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ───────── Pane Section ───────── */

const PaneSection: React.FC<{
  section: MergeSection;
  side: "ours" | "merged" | "theirs";
  index: number;
  onResolve: (index: number, pick: "ours" | "theirs" | "both") => void;
  onUnresolve: (index: number) => void;
}> = ({ section, side, index, onResolve, onUnresolve }) => {
  if (section.type === "common") {
    // Common lines — identical in all 3 panes
    return (
      <div>
        {(section.common || []).map((line, i) => (
          <CodeLine key={i} text={line} bg="transparent" color="var(--text-primary)" />
        ))}
      </div>
    );
  }

  // Conflict section
  const isResolved = !!section.resolution;
  const oursLines = section.ours || [];
  const theirsLines = section.theirs || [];
  const resolvedLines = section.resolved || [];

  if (side === "ours") {
    return (
      <ConflictBlock
        lines={oursLines}
        bg={isResolved && section.resolution === "ours" ? "var(--green)12" : "var(--accent)08"}
        borderColor="var(--accent)"
        dimmed={isResolved && section.resolution !== "ours" && section.resolution !== "both"}
        actions={!isResolved ? (
          <button onClick={() => onResolve(index, "ours")} style={arrowBtnStyle} title="Use LOCAL version">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <button onClick={() => onUnresolve(index)} style={{ ...arrowBtnStyle, opacity: 0.5 }} title="Undo resolution">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        )}
      />
    );
  }

  if (side === "theirs") {
    return (
      <ConflictBlock
        lines={theirsLines}
        bg={isResolved && section.resolution === "theirs" ? "var(--green)12" : "var(--mauve)08"}
        borderColor="var(--mauve)"
        dimmed={isResolved && section.resolution !== "theirs" && section.resolution !== "both"}
        actions={!isResolved ? (
          <button onClick={() => onResolve(index, "theirs")} style={arrowBtnStyle} title="Use REMOTE version">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mauve)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <button onClick={() => onUnresolve(index)} style={{ ...arrowBtnStyle, opacity: 0.5 }} title="Undo resolution">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        )}
      />
    );
  }

  // Center (merged) pane
  if (isResolved) {
    return (
      <ConflictBlock
        lines={resolvedLines}
        bg="var(--green)10"
        borderColor="var(--green)"
        dimmed={false}
        actions={
          <button onClick={() => onUnresolve(index)} style={{ ...arrowBtnStyle, opacity: 0.6 }} title="Undo resolution">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        }
      />
    );
  }

  // Unresolved center — show placeholder with both button
  const maxLines = Math.max(oursLines.length, theirsLines.length, 1);
  return (
    <div style={{
      borderLeft: "3px solid var(--yellow)",
      background: "var(--yellow)08",
      minHeight: maxLines * 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: "4px 8px",
    }}>
      <span style={{ fontSize: 10, color: "var(--yellow)", fontWeight: 500 }}>Unresolved</span>
      <button
        onClick={() => onResolve(index, "both")}
        style={{
          padding: "2px 8px", fontSize: 10, fontWeight: 600,
          border: "1px solid var(--green)50", borderRadius: 3,
          background: "var(--green)15", color: "var(--green)", cursor: "pointer",
        }}
        title="Use both (LOCAL then REMOTE)"
      >
        Both
      </button>
    </div>
  );
};

/* ───────── Conflict Block ───────── */

const ConflictBlock: React.FC<{
  lines: string[];
  bg: string;
  borderColor: string;
  dimmed: boolean;
  actions?: React.ReactNode;
}> = ({ lines, bg, borderColor, dimmed, actions }) => (
  <div style={{
    borderLeft: `3px solid ${borderColor}`,
    background: bg,
    opacity: dimmed ? 0.35 : 1,
    position: "relative",
    minHeight: 20,
  }}>
    {lines.length === 0 ? (
      <CodeLine text="(empty)" bg="transparent" color="var(--text-muted)" italic />
    ) : (
      lines.map((line, i) => (
        <CodeLine key={i} text={line} bg="transparent" color="var(--text-primary)" />
      ))
    )}
    {actions && (
      <div style={{
        position: "absolute",
        top: 0,
        right: 4,
        display: "flex",
        gap: 2,
        padding: "2px 0",
      }}>
        {actions}
      </div>
    )}
  </div>
);

/* ───────── Code Line ───────── */

const CodeLine: React.FC<{
  text: string;
  bg: string;
  color: string;
  italic?: boolean;
}> = ({ text, bg, color, italic }) => (
  <div style={{
    padding: "0 8px",
    background: bg,
    height: 20,
    lineHeight: "20px",
    fontFamily: "monospace",
    fontSize: 12,
    color,
    whiteSpace: "pre",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontStyle: italic ? "italic" : "normal",
  }}>
    {text || " "}
  </div>
);

/* ───────── Buttons ───────── */

const QuickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "2px 8px", fontSize: 10, fontWeight: 500,
      border: `1px solid ${color}40`, borderRadius: 3,
      cursor: "pointer", background: `${color}10`, color,
    }}
  >
    {label}
  </button>
);

const arrowBtnStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  cursor: "pointer",
  padding: "1px 3px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, border: "none",
  background: "var(--accent)", color: "var(--surface-0)",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 6,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer",
};

const paneHeaderStyle: React.CSSProperties = {
  flex: 1,
  padding: "5px 10px",
  fontSize: 10,
  display: "flex",
  gap: 6,
  alignItems: "center",
  background: "var(--surface-0)",
};

const paneStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
};

/* ───────── Parsing ───────── */

/**
 * Parse a file with conflict markers into MergeSections.
 * Each section is either "common" (same on both sides)
 * or "conflict" (between <<<<<<< and >>>>>>>).
 */
function parseMergeSections(content: string): MergeSection[] {
  const lines = content.split("\n");
  const sections: MergeSection[] = [];
  let commonBuf: string[] = [];

  const flushCommon = () => {
    if (commonBuf.length > 0) {
      sections.push({ type: "common", common: [...commonBuf], resolution: null });
      commonBuf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      flushCommon();

      const oursLines: string[] = [];
      let baseLines: string[] | undefined;
      const theirsLines: string[] = [];
      let phase: "ours" | "base" | "theirs" = "ours";

      i++; // skip <<<<<<< marker
      while (i < lines.length) {
        if (lines[i].startsWith("|||||||")) {
          phase = "base";
          baseLines = [];
          i++;
          continue;
        }
        if (lines[i].startsWith("=======")) {
          phase = "theirs";
          i++;
          continue;
        }
        if (lines[i].startsWith(">>>>>>>")) {
          i++; // skip >>>>>>> marker
          break;
        }
        if (phase === "ours") oursLines.push(lines[i]);
        else if (phase === "base") baseLines!.push(lines[i]);
        else theirsLines.push(lines[i]);
        i++;
      }

      sections.push({
        type: "conflict",
        ours: oursLines,
        theirs: theirsLines,
        resolution: null,
      });
    } else {
      commonBuf.push(lines[i]);
      i++;
    }
  }
  flushCommon();
  return sections;
}

/** Build the final merged file content from resolved sections */
function buildMergedContent(sections: MergeSection[]): string {
  const lines: string[] = [];
  for (const s of sections) {
    if (s.type === "common") {
      lines.push(...(s.common || []));
    } else if (s.resolved) {
      lines.push(...s.resolved);
    } else {
      // Shouldn't happen if all resolved, but fallback to ours
      lines.push(...(s.ours || []));
    }
  }
  return lines.join("\n");
}

/** Resolve all conflict markers, picking ours or theirs (for unit tests) */
function resolveAllConflicts(content: string, pick: "ours" | "theirs"): string {
  const sections = parseMergeSections(content);
  for (const s of sections) {
    if (s.type === "conflict") {
      s.resolution = pick;
      s.resolved = pick === "ours" ? (s.ours || []) : (s.theirs || []);
    }
  }
  return buildMergedContent(sections);
}

// Export for testing
export { parseMergeSections, resolveAllConflicts, buildMergedContent };
export type { MergeSection };
