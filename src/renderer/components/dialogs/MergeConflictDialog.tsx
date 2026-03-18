import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ConflictFile, ConflictFileContent } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

/**
 * Meld-style 3-pane merge dialog.
 *
 * Left  = LOCAL  (ours)   — full file, read-only textarea
 * Center = MERGED (result) — full file, editable textarea (starts with conflict markers)
 * Right = REMOTE (theirs) — full file, read-only textarea
 *
 * Gutters between panes have arrow buttons to copy the LOCAL/REMOTE version
 * of each conflict into the center editor.
 */
interface MergeToolSettings {
  mergeToolName: string;
  mergeToolPath: string;
  mergeToolArgs: string;
}

export const MergeConflictDialog: React.FC<Props> = ({ open, onClose, onResolved }) => {
  const [files, setFiles] = useState<ConflictFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<ConflictFileContent | null>(null);
  const [oursText, setOursText] = useState("");
  const [theirsText, setTheirsText] = useState("");
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only track conflict count for UI badges — not the full parsed conflicts
  const [conflictCount, setConflictCount] = useState(0);
  const [mergeTool, setMergeTool] = useState<MergeToolSettings>({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" });
  const [launchingTool, setLaunchingTool] = useState(false);
  const [useInternalEditor, setUseInternalEditor] = useState(false);

  const leftRef = useRef<HTMLTextAreaElement>(null);
  const centerRef = useRef<HTMLTextAreaElement>(null);
  const rightRef = useRef<HTMLTextAreaElement>(null);
  const scrollingRef = useRef(false);
  // Shadow copy for environments where ref.value may not persist (e.g. jsdom)
  const centerTextRef = useRef("");

  /** Read center textarea value directly from DOM — no React state */
  const getCenterText = useCallback(() => centerRef.current?.value || centerTextRef.current, []);

  /** Write to center textarea directly — no React re-render */
  const setCenterText = useCallback((text: string) => {
    centerTextRef.current = text;
    if (centerRef.current) centerRef.current.value = text;
    setConflictCount(countConflictMarkers(text));
  }, []);

  // Sync scroll across 3 textareas (proportional)
  const handleScroll = useCallback((source: "left" | "center" | "right") => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    const refs = { left: leftRef.current, center: centerRef.current, right: rightRef.current };
    const src = refs[source];
    if (!src) { scrollingRef.current = false; return; }
    const pct = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
    for (const [k, el] of Object.entries(refs)) {
      if (k !== source && el) {
        el.scrollTop = pct * (el.scrollHeight - el.clientHeight || 1);
      }
    }
    requestAnimationFrame(() => { scrollingRef.current = false; });
  }, []);

  // Load files on open
  useEffect(() => {
    if (!open) return;
    setFiles([]); setSelectedFile(null); setContent(null);
    setOursText(""); setTheirsText("");
    setResolvedFiles(new Set()); setError(null); setConflictCount(0);
    setLoading(true); setLaunchingTool(false); setUseInternalEditor(false);
    window.electronAPI.settings.get().then((s) => {
      const settings = s as unknown as MergeToolSettings;
      setMergeTool({
        mergeToolName: settings.mergeToolName || "",
        mergeToolPath: settings.mergeToolPath || "",
        mergeToolArgs: settings.mergeToolArgs || "",
      });
    }).catch(() => { /* use defaults */ });
    window.electronAPI.conflict.list()
      .then((cf) => { setFiles(cf); if (cf.length > 0) setSelectedFile(cf[0].path); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  // Load file content — set textarea values directly via refs
  // When external tool is configured and not using internal editor, auto-launch it
  useEffect(() => {
    if (!selectedFile) { setContent(null); return; }
    if (hasExternalTool && !useInternalEditor) {
      // Auto-launch external tool — no need to load content into textareas
      handleLaunchExternalTool(selectedFile);
      return;
    }
    setLoading(true);
    window.electronAPI.conflict.fileContent(selectedFile)
      .then((fc) => {
        setContent(fc);
        setOursText(fc.ours || "");
        setTheirsText(fc.theirs || "");
        setCenterText(fc.merged || "");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, useInternalEditor]);

  // Resolve one conflict by index — operates directly on textarea DOM value
  const resolveConflict = useCallback((idx: number, pick: "ours" | "theirs" | "both" | "none") => {
    const prev = getCenterText();
    const c = parseConflictPositions(prev);
    if (idx >= c.length) return;
    const target = c[idx];
    let replacement: string;
    if (pick === "ours") replacement = target.oursContent;
    else if (pick === "theirs") replacement = target.theirsContent;
    else if (pick === "both") replacement = target.oursContent + (target.oursContent && target.theirsContent ? "\n" : "") + target.theirsContent;
    else replacement = "";
    if (replacement && target.endOffset < prev.length) replacement += "\n";
    setCenterText(prev.substring(0, target.startOffset) + replacement + prev.substring(target.endOffset));
  }, [getCenterText, setCenterText]);

  const resolveAllAs = useCallback((pick: "ours" | "theirs") => {
    setCenterText(resolveAllConflicts(getCenterText(), pick));
  }, [getCenterText, setCenterText]);

  // Navigate to next/prev conflict in center textarea
  const scrollToConflict = useCallback((direction: "next" | "prev") => {
    const ta = centerRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const cs = parseConflictPositions(ta.value);
    if (cs.length === 0) return;
    let target: ConflictPosition | undefined;
    if (direction === "next") {
      target = cs.find((c) => c.startOffset > cursorPos) || cs[0];
    } else {
      for (let i = cs.length - 1; i >= 0; i--) {
        if (cs[i].startOffset < cursorPos) { target = cs[i]; break; }
      }
      if (!target) target = cs[cs.length - 1];
    }
    if (target) {
      ta.focus();
      ta.setSelectionRange(target.startOffset, target.startOffset);
      const linesBefore = ta.value.substring(0, target.startOffset).split("\n").length;
      const lineH = ta.scrollHeight / (ta.value.split("\n").length || 1);
      ta.scrollTop = Math.max(0, (linesBefore - 3) * lineH);
      handleScroll("center");
    }
  }, [handleScroll]);

  const handleSaveAndResolve = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true); setError(null);
    try {
      await window.electronAPI.conflict.saveMerged(selectedFile, getCenterText());
      await window.electronAPI.conflict.resolve(selectedFile);
      setResolvedFiles((prev) => new Set([...prev, selectedFile]));
      const remaining = files.filter((f) => f.path !== selectedFile && !resolvedFiles.has(f.path));
      if (remaining.length > 0) setSelectedFile(remaining[0].path);
      else { setSelectedFile(null); setContent(null); }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }, [selectedFile, getCenterText, files, resolvedFiles]);

  const hasExternalTool = mergeTool.mergeToolName !== "" && mergeTool.mergeToolPath !== "";

  const handleLaunchExternalTool = useCallback(async (fileToResolve?: string) => {
    const target = fileToResolve || selectedFile;
    if (!target || !hasExternalTool) return;
    setLaunchingTool(true); setError(null);
    try {
      const result = await window.electronAPI.conflict.launchMergeTool(
        target, mergeTool.mergeToolPath, mergeTool.mergeToolArgs
      );
      // Reload file content after tool exits
      const fc = await window.electronAPI.conflict.fileContent(target);
      setContent(fc);
      setOursText(fc.ours || "");
      setTheirsText(fc.theirs || "");
      setCenterText(fc.merged || "");
      // Auto-resolve if no conflict markers remain and tool exited successfully
      if (result.exitCode === 0 && countConflictMarkers(fc.merged) === 0) {
        await window.electronAPI.conflict.resolve(target);
        setResolvedFiles((prev) => new Set([...prev, target]));
        const remaining = files.filter((f) => f.path !== target && !resolvedFiles.has(f.path));
        if (remaining.length > 0) {
          setSelectedFile(remaining[0].path);
        } else {
          setSelectedFile(null); setContent(null);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunchingTool(false);
    }
  }, [selectedFile, hasExternalTool, mergeTool, setCenterText, files, resolvedFiles]);

  const allFilesResolved = files.length > 0 && files.every((f) => resolvedFiles.has(f.path));
  const unresolvedFileCount = files.filter((f) => !resolvedFiles.has(f.path)).length;
  const hasConflictMarkers = conflictCount > 0;

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialogStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Resolve merge conflicts</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{unresolvedFileCount} unresolved {unresolvedFileCount === 1 ? "file" : "files"}</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* File list sidebar */}
          <FileList files={files} selectedFile={selectedFile} resolvedFiles={resolvedFiles} onSelect={setSelectedFile} />

          {/* Editor area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* External tool waiting state */}
            {selectedFile && launchingTool ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Waiting for {mergeToolDisplayName(mergeTool)}...
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedFile}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Resolve the conflict in the external tool, then save and close it.
                </span>
                <button
                  onClick={() => { setLaunchingTool(false); setUseInternalEditor(true); }}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", marginTop: 8 }}
                >
                  Use internal editor instead
                </button>
              </div>
            ) : selectedFile && content ? (
              <>
                {/* Toolbar */}
                <div style={toolbarStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedFile}</span>
                    {hasConflictMarkers ? (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--yellow)20", color: "var(--yellow)", fontWeight: 500 }}>
                        {conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--green)20", color: "var(--green)", fontWeight: 500 }}>
                        No conflicts remaining
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <NavBtn label="Prev conflict" icon="up" onClick={() => scrollToConflict("prev")} disabled={!hasConflictMarkers} />
                    <NavBtn label="Next conflict" icon="down" onClick={() => scrollToConflict("next")} disabled={!hasConflictMarkers} />
                    <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                    <QuickBtn label="Accept all LOCAL" color="var(--accent)" onClick={() => resolveAllAs("ours")} />
                    <QuickBtn label="Accept all REMOTE" color="var(--mauve)" onClick={() => resolveAllAs("theirs")} />
                    {hasExternalTool && (
                      <>
                        <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                        <button
                          onClick={() => handleLaunchExternalTool()}
                          style={{
                            padding: "2px 10px", fontSize: 10, fontWeight: 600,
                            border: "1px solid var(--green)60", borderRadius: 3, cursor: "pointer",
                            background: "var(--green)15", color: "var(--green)",
                          }}
                        >
                          Open in {mergeToolDisplayName(mergeTool)}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Column headers */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                  <div style={{ ...colHeaderStyle, borderRight: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>LOCAL</span>
                    <span style={{ color: "var(--text-muted)" }}>(ours)</span>
                  </div>
                  <div style={colHeaderStyle}>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>MERGED</span>
                    <span style={{ color: "var(--text-muted)" }}>(result)</span>
                  </div>
                  <div style={{ ...colHeaderStyle, borderLeft: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--mauve)", fontWeight: 600 }}>REMOTE</span>
                    <span style={{ color: "var(--text-muted)" }}>(theirs)</span>
                  </div>
                </div>

                {/* 3 textareas — center is uncontrolled for performance */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                  <textarea
                    ref={leftRef}
                    value={oursText}
                    readOnly
                    spellCheck={false}
                    onScroll={() => handleScroll("left")}
                    style={{ ...editorStyle, borderRight: "1px solid var(--border-subtle)", background: "var(--surface-0)" }}
                  />
                  <textarea
                    ref={centerRef}
                    defaultValue=""
                    spellCheck={false}
                    onScroll={() => handleScroll("center")}
                    style={editorStyle}
                  />
                  <textarea
                    ref={rightRef}
                    value={theirsText}
                    readOnly
                    spellCheck={false}
                    onScroll={() => handleScroll("right")}
                    style={{ ...editorStyle, borderLeft: "1px solid var(--border-subtle)", background: "var(--surface-0)" }}
                  />
                </div>

                {/* Conflict action bar — resolve first remaining conflict */}
                {hasConflictMarkers && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontSize: 11 }}>
                    <span style={{ color: "var(--yellow)", fontWeight: 600 }}>Resolve next:</span>
                    <PickBtn label="Use LOCAL →" color="var(--accent)" onClick={() => resolveConflict(0, "ours")} />
                    <PickBtn label="← Use REMOTE" color="var(--mauve)" onClick={() => resolveConflict(0, "theirs")} />
                    <PickBtn label="Both" color="var(--green)" onClick={() => resolveConflict(0, "both")} />
                    <PickBtn label="None" color="var(--red)" onClick={() => resolveConflict(0, "none")} />
                    <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>
                      {conflictCount} remaining — or edit the MERGED text directly
                    </span>
                  </div>
                )}

                {/* File action bar */}
                <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
                  {hasConflictMarkers && <span style={{ fontSize: 11, color: "var(--yellow)", alignSelf: "center", marginRight: "auto" }}>Resolve all conflicts or edit markers manually, then mark as resolved</span>}
                  <button onClick={() => setConflictCount(countConflictMarkers(getCenterText()))}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    Recheck conflicts
                  </button>
                  <button onClick={handleSaveAndResolve} disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: saving ? "var(--surface-3)" : "var(--green)", color: saving ? "var(--text-muted)" : "var(--surface-0)", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving..." : "Mark as resolved"}
                  </button>
                </div>
              </>
            ) : loading ? (
              <CenteredMsg text="Loading..." />
            ) : allFilesResolved ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span style={{ fontSize: 14, color: "var(--green)", fontWeight: 600 }}>All conflicts resolved!</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>You can now continue the operation.</span>
              </div>
            ) : (
              <CenteredMsg text={files.length === 0 ? "No conflicted files found" : "Select a file to resolve"} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{resolvedFiles.size} of {files.length} files resolved</div>
          {error && <span style={{ fontSize: 11, color: "var(--red)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error}</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Close</button>
            {allFilesResolved && onResolved && <button onClick={onResolved} style={primaryBtnStyle}>Continue</button>}
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

/* ═══════════════ File List Sidebar ═══════════════ */

const FileList: React.FC<{
  files: ConflictFile[];
  selectedFile: string | null;
  resolvedFiles: Set<string>;
  onSelect: (path: string) => void;
}> = React.memo(({ files, selectedFile, resolvedFiles, onSelect }) => (
  <div style={{ width: 200, borderRight: "1px solid var(--border-subtle)", overflowY: "auto", flexShrink: 0 }}>
    <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-subtle)" }}>
      Unresolved merge conflicts
    </div>
    {files.map((f) => {
      const done = resolvedFiles.has(f.path), sel = f.path === selectedFile;
      return (
        <div key={f.path} onClick={() => !done && onSelect(f.path)}
          style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, cursor: done ? "default" : "pointer", background: sel ? "var(--accent-dim)" : "transparent", borderLeft: sel ? "2px solid var(--accent)" : "2px solid transparent", opacity: done ? 0.5 : 1 }}
          onMouseEnter={(e) => { if (!sel && !done) e.currentTarget.style.background = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
          {done
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
          <span className="truncate mono" style={{ fontSize: 11, color: done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: done ? "line-through" : "none" }}>
            {f.path.split("/").pop()}
          </span>
        </div>
      );
    })}
  </div>
));

/* ═══════════════ Small Components ═══════════════ */

const CenteredMsg: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>{text}</div>
);

const QuickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} style={{ padding: "2px 8px", fontSize: 10, fontWeight: 500, border: `1px solid ${color}40`, borderRadius: 3, cursor: "pointer", background: `${color}10`, color }}>{label}</button>
);

const PickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} style={{ padding: "2px 6px", fontSize: 10, fontWeight: 600, border: `1px solid ${color}50`, borderRadius: 3, background: `${color}15`, color, cursor: "pointer" }}>{label}</button>
);

const NavBtn: React.FC<{ label: string; icon: "up" | "down"; onClick: () => void; disabled: boolean }> = ({ label, icon, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
    style={{ background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 3, cursor: disabled ? "default" : "pointer", padding: "2px 4px", display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {icon === "up" ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  </button>
);

/* ═══════════════ Helpers ═══════════════ */

function mergeToolDisplayName(tool: MergeToolSettings): string {
  if (!tool.mergeToolName || tool.mergeToolName === "custom") return "external tool";
  return tool.mergeToolName;
}

/* ═══════════════ Conflict Parsing ═══════════════ */

interface ConflictPosition {
  /** Byte offset of <<<<<<< in the string */
  startOffset: number;
  /** Byte offset right after >>>>>>> line (including newline) */
  endOffset: number;
  /** Our (LOCAL) content between <<<<<<< and ======= */
  oursContent: string;
  /** Their (REMOTE) content between ======= and >>>>>>> */
  theirsContent: string;
}

/** Find all conflict marker positions in a string */
/** Fast count of <<<<<<< markers — no parsing, just count */
function countConflictMarkers(text: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf("<<<<<<<", idx)) !== -1) { count++; idx += 7; }
  return count;
}

function parseConflictPositions(text: string): ConflictPosition[] {
  const results: ConflictPosition[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const startIdx = text.indexOf("<<<<<<<", searchFrom);
    if (startIdx === -1) break;

    // Find the ======= separator (skip optional ||||||| base section)
    const sepIdx = text.indexOf("=======", startIdx);
    if (sepIdx === -1) break;

    // Find >>>>>>>
    const endMarkerIdx = text.indexOf(">>>>>>>", sepIdx);
    if (endMarkerIdx === -1) break;

    // Find end of >>>>>>> line
    const endOfLine = text.indexOf("\n", endMarkerIdx);
    const endOffset = endOfLine === -1 ? text.length : endOfLine + 1;

    // Find end of <<<<<<< line
    const oursStartOffset = text.indexOf("\n", startIdx);
    if (oursStartOffset === -1) break;

    // Handle optional ||||||| base section: ours goes from after <<<<<<< to ||||||| or =======
    const baseMarkerIdx = text.indexOf("|||||||", startIdx);
    const oursEndOffset = (baseMarkerIdx !== -1 && baseMarkerIdx < sepIdx) ? baseMarkerIdx : sepIdx;

    // Ours content: between <<<<<<< line and ======= (or |||||||)
    let oursContent = text.substring(oursStartOffset + 1, oursEndOffset);
    // Remove trailing newline before =======
    if (oursContent.endsWith("\n")) oursContent = oursContent.slice(0, -1);

    // Theirs content: between ======= line and >>>>>>>
    const theirsStartOffset = text.indexOf("\n", sepIdx);
    if (theirsStartOffset === -1) break;
    let theirsContent = text.substring(theirsStartOffset + 1, endMarkerIdx);
    if (theirsContent.endsWith("\n")) theirsContent = theirsContent.slice(0, -1);

    results.push({ startOffset: startIdx, endOffset, oursContent, theirsContent });
    searchFrom = endOffset;
  }

  return results;
}

/** Resolve all conflicts at once, picking ours or theirs */
function resolveAllConflicts(text: string, pick: "ours" | "theirs"): string {
  // Process from end to start so offsets remain valid
  const conflicts = parseConflictPositions(text);
  let result = text;
  for (let i = conflicts.length - 1; i >= 0; i--) {
    const c = conflicts[i];
    let replacement = pick === "ours" ? c.oursContent : c.theirsContent;
    // Preserve newline: the endOffset includes the \n after >>>>>>>
    // so the replacement needs a trailing \n if there's content after it
    if (replacement && c.endOffset < text.length) replacement += "\n";
    result = result.substring(0, c.startOffset) + replacement + result.substring(c.endOffset);
  }
  return result;
}

// Keep the old name for test compatibility
function parseMergeSections(content: string) {
  // Used by tests — delegate to the simpler section parser
  const lines = content.split("\n");
  const sections: MergeSection[] = [];
  let buf: string[] = [];
  const flush = () => { if (buf.length > 0) { sections.push({ type: "common", common: [...buf], resolution: null }); buf = []; } };
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      flush();
      const ours: string[] = [], theirs: string[] = [];
      let phase: "ours" | "base" | "theirs" = "ours";
      i++;
      while (i < lines.length) {
        if (lines[i].startsWith("|||||||")) { phase = "base"; i++; continue; }
        if (lines[i].startsWith("=======")) { phase = "theirs"; i++; continue; }
        if (lines[i].startsWith(">>>>>>>")) { i++; break; }
        if (phase === "ours") ours.push(lines[i]);
        else if (phase === "theirs") theirs.push(lines[i]);
        i++;
      }
      sections.push({ type: "conflict", ours, theirs, resolution: null });
    } else { buf.push(lines[i]); i++; }
  }
  flush();
  return sections;
}

function buildMergedContent(sections: MergeSection[]): string {
  const out: string[] = [];
  for (const s of sections) {
    if (s.type === "common") out.push(...(s.common || []));
    else if (s.resolved) out.push(...s.resolved);
    else out.push(...(s.ours || []));
  }
  return out.join("\n");
}

interface MergeSection {
  type: "common" | "conflict";
  common?: string[];
  ours?: string[];
  theirs?: string[];
  resolution: string | null;
  resolved?: string[];
}

/* ═══════════════ Line Diff (LCS) ═══════════════ */

interface DiffLine {
  type: "same" | "added" | "removed";
  line: string;
}

/** LCS-based line diff — returns minimal edit sequence */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText === "" ? [] : oldText.split("\n");
  const newLines = newText === "" ? [] : newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "same", line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", line: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "removed", line: oldLines[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

/* ═══════════════ Styles ═══════════════ */

const backdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
  animation: "fade-in 0.15s ease-out",
};

const dialogStyle: React.CSSProperties = {
  width: "95vw", maxWidth: 1400, height: "90vh", maxHeight: 850,
  borderRadius: 12, background: "var(--surface-1)",
  border: "1px solid var(--border)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
  display: "flex", flexDirection: "column", overflow: "hidden",
  animation: "modal-in 0.2s ease-out",
};

const headerStyle: React.CSSProperties = {
  padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)",
  cursor: "pointer", padding: 4, borderRadius: 4, display: "flex",
};

const toolbarStyle: React.CSSProperties = {
  padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0,
};

const colHeaderStyle: React.CSSProperties = {
  flex: 1, padding: "5px 10px", fontSize: 10,
  display: "flex", gap: 6, alignItems: "center", background: "var(--surface-0)",
};

const editorStyle: React.CSSProperties = {
  flex: 1, width: 0, // flex child
  fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: "20px",
  padding: "4px 8px", margin: 0,
  background: "var(--surface-1)", color: "var(--text-primary)",
  border: "none", outline: "none", resize: "none",
  whiteSpace: "pre", overflowWrap: "normal",
  overflowX: "auto", overflowY: "auto",
};

const footerStyle: React.CSSProperties = {
  padding: "10px 16px", borderTop: "1px solid var(--border-subtle)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 6, border: "none",
  background: "var(--accent)", color: "var(--surface-0)",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)",
  background: "transparent", color: "var(--text-secondary)",
  fontSize: 12, fontWeight: 500, cursor: "pointer",
};

export { parseMergeSections, resolveAllConflicts, buildMergedContent, computeLineDiff };
export type { MergeSection };
