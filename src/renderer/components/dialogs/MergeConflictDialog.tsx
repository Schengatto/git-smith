import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ConflictFile, ConflictFileContent } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onResolved?: () => void;
  mode?: "overlay" | "window";
}

interface MergeToolSettings {
  mergeToolName: string;
  mergeToolPath: string;
  mergeToolArgs: string;
}

/** Internal section model with resolution state */
interface ParsedSection {
  id: number;
  type: "common" | "conflict";
  common?: string[];
  ours?: string[];
  theirs?: string[];
  resolution: "unresolved" | "ours" | "theirs" | "both" | "custom";
  resolvedLines?: string[];
}

export const MergeConflictDialog: React.FC<Props> = ({ open, onClose, onResolved, mode = "overlay" }) => {
  const [files, setFiles] = useState<ConflictFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<ConflictFileContent | null>(null);
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section-based conflict model
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [editingConflictId, setEditingConflictId] = useState<number | null>(null);

  // External merge tool
  const [mergeTool, setMergeTool] = useState<MergeToolSettings>({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" });
  const [launchingTool, setLaunchingTool] = useState(false);
  const [useInternalEditor, setUseInternalEditor] = useState(false);

  // AI
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestion: string; baseText: string } | null>(null);
  const aiRequestFileRef = useRef<string | null>(null);

  // Refs
  const conflictRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Derived ---
  const conflictSections = useMemo(() => sections.filter(s => s.type === "conflict"), [sections]);
  const unresolvedCount = useMemo(() => conflictSections.filter(s => s.resolution === "unresolved").length, [conflictSections]);
  const hasExternalTool = mergeTool.mergeToolName !== "" && mergeTool.mergeToolPath !== "";
  const allFilesResolved = files.length > 0 && files.every(f => resolvedFiles.has(f.path));
  const unresolvedFileCount = files.filter(f => !resolvedFiles.has(f.path)).length;

  // --- Line numbers per column ---
  const lineNumbers = useMemo(() => {
    let leftLine = 1, rightLine = 1, centerLine = 1;
    return sections.map(s => {
      const entry = { leftStart: leftLine, rightStart: rightLine, centerStart: centerLine };
      if (s.type === "common") {
        const n = (s.common || []).length;
        leftLine += n; rightLine += n; centerLine += n;
      } else {
        leftLine += (s.ours || []).length;
        rightLine += (s.theirs || []).length;
        if (s.resolution !== "unresolved") {
          centerLine += (s.resolvedLines || []).length;
        } else {
          centerLine += (s.ours || []).length + (s.theirs || []).length + 3;
        }
      }
      return entry;
    });
  }, [sections]);

  // ═══════════════ Effects ═══════════════

  useEffect(() => {
    if (!open) return;
    setFiles([]); setSelectedFile(null); setContent(null); setSections([]);
    setResolvedFiles(new Set()); setError(null); setLoading(true);
    setLaunchingTool(false); setUseInternalEditor(false);
    setAiSuggestion(null); setAiLoading(false); setEditingConflictId(null);
    window.electronAPI.settings.get().then((s) => {
      const settings = s as unknown as MergeToolSettings;
      setMergeTool({
        mergeToolName: settings.mergeToolName || "",
        mergeToolPath: settings.mergeToolPath || "",
        mergeToolArgs: settings.mergeToolArgs || "",
      });
      const aiSettings = s as unknown as { aiProvider?: string; aiApiKey?: string };
      setAiConfigured(!!aiSettings.aiProvider && aiSettings.aiProvider !== "none" && !!aiSettings.aiApiKey);
    }).catch(() => {});
    window.electronAPI.conflict.list()
      .then((cf) => { setFiles(cf); if (cf.length > 0) setSelectedFile(cf[0].path); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    setAiSuggestion(null); setAiLoading(false);
    aiRequestFileRef.current = null; setEditingConflictId(null);
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) { setContent(null); setSections([]); return; }
    if (hasExternalTool && !useInternalEditor) {
      handleLaunchExternalTool(selectedFile);
      return;
    }
    setLoading(true);
    window.electronAPI.conflict.fileContent(selectedFile)
      .then((fc) => {
        setContent(fc);
        const parsed = parseMergeSections(fc.merged || "");
        setSections(parsed.map((s, i) => ({
          id: i, type: s.type, common: s.common, ours: s.ours, theirs: s.theirs,
          resolution: "unresolved" as const, resolvedLines: undefined,
        })));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, useInternalEditor]);

  // ═══════════════ Handlers ═══════════════

  const resolveConflict = useCallback((id: number, pick: "ours" | "theirs" | "both") => {
    setSections(prev => prev.map(s => {
      if (s.id !== id || s.type !== "conflict") return s;
      let resolvedLines: string[];
      if (pick === "ours") resolvedLines = [...(s.ours || [])];
      else if (pick === "theirs") resolvedLines = [...(s.theirs || [])];
      else resolvedLines = [...(s.ours || []), ...(s.theirs || [])];
      return { ...s, resolution: pick, resolvedLines };
    }));
    setEditingConflictId(null);
  }, []);

  const unresolveConflict = useCallback((id: number) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, resolution: "unresolved" as const, resolvedLines: undefined } : s
    ));
  }, []);

  const resolveAllAs = useCallback((pick: "ours" | "theirs") => {
    setSections(prev => prev.map(s => {
      if (s.type !== "conflict" || s.resolution !== "unresolved") return s;
      return { ...s, resolution: pick, resolvedLines: pick === "ours" ? [...(s.ours || [])] : [...(s.theirs || [])] };
    }));
  }, []);

  const saveCustomEdit = useCallback((id: number, text: string) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, resolution: "custom" as const, resolvedLines: text.split("\n") } : s
    ));
    setEditingConflictId(null);
  }, []);

  const handleSaveAndResolve = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true); setError(null);
    try {
      const finalContent = buildFinalContent(sections);
      await window.electronAPI.conflict.saveMerged(selectedFile, finalContent);
      await window.electronAPI.conflict.resolve(selectedFile);
      setResolvedFiles(prev => new Set([...prev, selectedFile]));
      const remaining = files.filter(f => f.path !== selectedFile && !resolvedFiles.has(f.path));
      if (remaining.length > 0) setSelectedFile(remaining[0].path);
      else { setSelectedFile(null); setContent(null); setSections([]); }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }, [selectedFile, sections, files, resolvedFiles]);

  const handleLaunchExternalTool = useCallback(async (fileToResolve?: string) => {
    const target = fileToResolve || selectedFile;
    if (!target || !hasExternalTool) return;
    setLaunchingTool(true); setError(null);
    try {
      const result = await window.electronAPI.conflict.launchMergeTool(
        target, mergeTool.mergeToolPath, mergeTool.mergeToolArgs
      );
      const fc = await window.electronAPI.conflict.fileContent(target);
      setContent(fc);
      const parsed = parseMergeSections(fc.merged || "");
      setSections(parsed.map((s, i) => ({
        id: i, type: s.type, common: s.common, ours: s.ours, theirs: s.theirs,
        resolution: "unresolved" as const, resolvedLines: undefined,
      })));
      if (result.exitCode === 0 && countConflictMarkers(fc.merged) === 0) {
        await window.electronAPI.conflict.resolve(target);
        setResolvedFiles(prev => new Set([...prev, target]));
        const remaining = files.filter(f => f.path !== target && !resolvedFiles.has(f.path));
        if (remaining.length > 0) setSelectedFile(remaining[0].path);
        else { setSelectedFile(null); setContent(null); setSections([]); }
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLaunchingTool(false); }
  }, [selectedFile, hasExternalTool, mergeTool, files, resolvedFiles]);

  const handleResolveWithAi = useCallback(async () => {
    if (!selectedFile || aiLoading) return;
    setAiLoading(true); setError(null);
    aiRequestFileRef.current = selectedFile;
    try {
      const suggestion = await window.electronAPI.mcp.suggestConflictResolution(selectedFile);
      if (aiRequestFileRef.current === selectedFile) {
        setAiSuggestion({ suggestion, baseText: buildFinalContent(sections) });
      }
    } catch (e: unknown) {
      if (aiRequestFileRef.current === selectedFile) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (aiRequestFileRef.current === selectedFile) setAiLoading(false);
    }
  }, [selectedFile, aiLoading, sections]);

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    const resolutions = extractAiResolutions(sections, aiSuggestion.suggestion);
    const hasResolutions = conflictSections.some(s => resolutions.has(s.id));
    if (hasResolutions) {
      setSections(prev => prev.map(s => {
        if (s.type !== "conflict") return s;
        const resolved = resolutions.get(s.id);
        if (resolved !== undefined) return { ...s, resolution: "custom" as const, resolvedLines: resolved };
        return s;
      }));
    } else {
      // Fallback: re-parse from AI text (AI fully rewrote the file)
      const reparsed = parseMergeSections(aiSuggestion.suggestion);
      setSections(reparsed.map((s, i) => ({
        id: i, type: s.type, common: s.common, ours: s.ours, theirs: s.theirs,
        resolution: "unresolved" as const, resolvedLines: undefined,
      })));
    }
    setAiSuggestion(null);
  }, [aiSuggestion, sections, conflictSections]);

  const scrollToConflict = useCallback((direction: "next" | "prev") => {
    const unresolved = conflictSections.filter(s => s.resolution === "unresolved");
    if (unresolved.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerMid = containerRect.top + containerRect.height / 2;
    let currentIdx = -1;
    for (let i = 0; i < unresolved.length; i++) {
      const el = conflictRefs.current.get(unresolved[i].id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= containerMid && rect.bottom >= containerMid) { currentIdx = i; break; }
      }
    }
    const targetIdx = direction === "next"
      ? (currentIdx < unresolved.length - 1 ? currentIdx + 1 : 0)
      : (currentIdx > 0 ? currentIdx - 1 : unresolved.length - 1);
    conflictRefs.current.get(unresolved[targetIdx].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [conflictSections]);

  const scrollToConflictById = useCallback((id: number) => {
    conflictRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // ═══════════════ Render ═══════════════

  if (!open) return null;

  const outerStyle: React.CSSProperties = mode === "window"
    ? { width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-0)" }
    : backdropStyle;
  const innerStyle: React.CSSProperties = mode === "window"
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : dialogStyle;

  return (
    <div style={outerStyle} onClick={mode === "overlay" ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}>
      <div style={innerStyle}>
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
            {selectedFile && launchingTool ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Waiting for {mergeToolDisplayName(mergeTool)}...</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedFile}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Resolve the conflict in the external tool, then save and close it.</span>
                <button onClick={() => { setLaunchingTool(false); setUseInternalEditor(true); }}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", marginTop: 8 }}>
                  Use internal editor instead
                </button>
              </div>
            ) : selectedFile && content && sections.length > 0 ? (
              <>
                {/* Toolbar */}
                <div style={toolbarStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedFile}</span>
                    {unresolvedCount > 0 ? (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--yellow)20", color: "var(--yellow)", fontWeight: 500 }}>
                        {unresolvedCount} {unresolvedCount === 1 ? "conflict" : "conflicts"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--green)20", color: "var(--green)", fontWeight: 500 }}>
                        No conflicts remaining
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {/* Conflict navigation badges */}
                    {conflictSections.length > 0 && (
                      <div style={{ display: "flex", gap: 2, alignItems: "center", marginRight: 4 }}>
                        {conflictSections.map((s, i) => (
                          <button key={s.id} onClick={() => scrollToConflictById(s.id)}
                            title={`Conflict ${i + 1}${s.resolution !== "unresolved" ? " (resolved)" : ""}`}
                            style={{
                              width: 18, height: 18, fontSize: 9, fontWeight: 600,
                              border: `1px solid ${s.resolution === "unresolved" ? "var(--yellow)" : "var(--green)"}60`,
                              borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              background: s.resolution === "unresolved" ? "var(--yellow)15" : "var(--green)15",
                              color: s.resolution === "unresolved" ? "var(--yellow)" : "var(--green)",
                            }}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    <NavBtn label="Prev conflict" icon="up" onClick={() => scrollToConflict("prev")} disabled={unresolvedCount === 0} />
                    <NavBtn label="Next conflict" icon="down" onClick={() => scrollToConflict("next")} disabled={unresolvedCount === 0} />
                    <span style={separatorStyle} />
                    <QuickBtn label="Accept all LOCAL" color="var(--accent)" onClick={() => resolveAllAs("ours")} />
                    <QuickBtn label="Accept all REMOTE" color="var(--mauve)" onClick={() => resolveAllAs("theirs")} />
                    {hasExternalTool && (
                      <>
                        <span style={separatorStyle} />
                        <button onClick={() => handleLaunchExternalTool()}
                          style={{ padding: "2px 10px", fontSize: 10, fontWeight: 600, border: "1px solid var(--green)60", borderRadius: 3, cursor: "pointer", background: "var(--green)15", color: "var(--green)" }}>
                          Open in {mergeToolDisplayName(mergeTool)}
                        </button>
                      </>
                    )}
                    {aiConfigured && (
                      <>
                        <span style={separatorStyle} />
                        <button onClick={handleResolveWithAi} disabled={aiLoading || resolvedFiles.has(selectedFile!)}
                          style={{
                            padding: "2px 10px", fontSize: 10, fontWeight: 600,
                            border: "1px solid var(--mauve)60", borderRadius: 3,
                            cursor: aiLoading || resolvedFiles.has(selectedFile!) ? "not-allowed" : "pointer",
                            background: "var(--mauve)15", color: "var(--mauve)",
                            opacity: aiLoading || resolvedFiles.has(selectedFile!) ? 0.5 : 1,
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                          {aiLoading ? (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                              </svg>
                              Resolving...
                            </>
                          ) : "Resolve with AI"}
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

                {/* Section-based 3-column view */}
                <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                  <div ref={scrollContainerRef} style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
                    {sections.map((section, sectionIdx) => {
                      const ln = lineNumbers[sectionIdx];

                      if (section.type === "common") {
                        return (
                          <div key={section.id} style={{ display: "flex" }}>
                            <div style={{ flex: 1, borderRight: "1px solid var(--border-subtle)" }}>
                              {(section.common || []).map((line, i) => (
                                <LineRow key={i} lineNum={ln.leftStart + i} text={line} />
                              ))}
                            </div>
                            <div style={{ flex: 1 }}>
                              {(section.common || []).map((line, i) => (
                                <LineRow key={i} lineNum={ln.centerStart + i} text={line} />
                              ))}
                            </div>
                            <div style={{ flex: 1, borderLeft: "1px solid var(--border-subtle)" }}>
                              {(section.common || []).map((line, i) => (
                                <LineRow key={i} lineNum={ln.rightStart + i} text={line} />
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // ── Conflict section ──
                      const isResolved = section.resolution !== "unresolved";
                      const isEditing = editingConflictId === section.id;

                      return (
                        <div key={section.id}
                          ref={el => { conflictRefs.current.set(section.id, el); }}
                          data-testid={`conflict-section-${section.id}`}
                          style={{ display: "flex", borderTop: `2px solid ${isResolved ? "var(--green)" : "var(--yellow)"}40`, borderBottom: `2px solid ${isResolved ? "var(--green)" : "var(--yellow)"}40` }}>
                          {/* Left: ours */}
                          <div style={{ flex: 1, borderRight: "1px solid var(--border-subtle)", background: isResolved ? "var(--green)06" : "var(--accent)06" }}>
                            {(section.ours || []).map((line, i) => (
                              <LineRow key={i} lineNum={ln.leftStart + i} text={line} bg={isResolved ? "var(--green)10" : "var(--accent)12"} />
                            ))}
                            {(section.ours || []).length === 0 && <EmptyLine />}
                          </div>

                          {/* Center: resolution area */}
                          <div style={{ flex: 1, background: isResolved ? "var(--green)04" : "var(--surface-1)" }}>
                            {isEditing ? (
                              <ConflictEditor
                                initialText={section.resolvedLines ? section.resolvedLines.join("\n") : [...(section.ours || []), ...(section.theirs || [])].join("\n")}
                                onSave={(text) => saveCustomEdit(section.id, text)}
                                onCancel={() => setEditingConflictId(null)}
                              />
                            ) : isResolved ? (
                              <div>
                                <div style={resolvedHeaderStyle}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--green)" }}>
                                    ✓ Resolved ({section.resolution})
                                  </span>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => setEditingConflictId(section.id)}
                                      style={{ ...tinyBtnStyle, color: "var(--text-muted)" }} title="Edit resolution">Edit</button>
                                    <button onClick={() => unresolveConflict(section.id)}
                                      style={{ ...tinyBtnStyle, color: "var(--text-muted)" }} title="Undo resolution">↩ Undo</button>
                                  </div>
                                </div>
                                {(section.resolvedLines || []).map((line, i) => (
                                  <LineRow key={i} lineNum={ln.centerStart + i} text={line} bg="var(--green)08" />
                                ))}
                                {(section.resolvedLines || []).length === 0 && <EmptyLine label="(empty — both sides removed)" />}
                              </div>
                            ) : (
                              <div>
                                {/* Per-conflict action bar */}
                                <div style={conflictActionBarStyle}>
                                  <ConflictPickBtn label="Accept Current" color="var(--accent)" onClick={() => resolveConflict(section.id, "ours")} />
                                  <ConflictPickBtn label="Accept Incoming" color="var(--mauve)" onClick={() => resolveConflict(section.id, "theirs")} />
                                  <ConflictPickBtn label="Accept Both" color="var(--green)" onClick={() => resolveConflict(section.id, "both")} />
                                  <button onClick={() => setEditingConflictId(section.id)}
                                    style={{ ...conflictPickBtnBase, border: "1px solid var(--text-muted)40", color: "var(--text-secondary)" }}>
                                    Edit
                                  </button>
                                  {aiConfigured && (
                                    <button onClick={handleResolveWithAi} disabled={aiLoading}
                                      style={{ ...conflictPickBtnBase, border: "1px solid var(--mauve)40", color: "var(--mauve)", opacity: aiLoading ? 0.5 : 1 }}>
                                      AI
                                    </button>
                                  )}
                                </div>
                                {/* Ours preview */}
                                <div style={{ borderBottom: "2px solid var(--border-subtle)", borderLeft: "3px solid var(--accent)", background: "var(--accent)10" }}>
                                  <div style={sectionLabelStyle("var(--accent)")}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>CURRENT</span>
                                    <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>(ours)</span>
                                  </div>
                                  {(section.ours || []).map((line, i) => (
                                    <LineRow key={i} text={line} bg="var(--accent)12" />
                                  ))}
                                  {(section.ours || []).length === 0 && <EmptyLine />}
                                </div>
                                {/* Theirs preview */}
                                <div style={{ borderLeft: "3px solid var(--mauve)", background: "var(--mauve)10" }}>
                                  <div style={sectionLabelStyle("var(--mauve)")}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>INCOMING</span>
                                    <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>(theirs)</span>
                                  </div>
                                  {(section.theirs || []).map((line, i) => (
                                    <LineRow key={i} text={line} bg="var(--mauve)12" />
                                  ))}
                                  {(section.theirs || []).length === 0 && <EmptyLine />}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: theirs */}
                          <div style={{ flex: 1, borderLeft: "1px solid var(--border-subtle)", background: isResolved ? "var(--green)06" : "var(--mauve)06" }}>
                            {(section.theirs || []).map((line, i) => (
                              <LineRow key={i} lineNum={ln.rightStart + i} text={line} bg={isResolved ? "var(--green)10" : "var(--mauve)12"} />
                            ))}
                            {(section.theirs || []).length === 0 && <EmptyLine />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI suggestion overlay */}
                  {aiSuggestion !== null && selectedFile && (
                    <AiSuggestionOverlay
                      currentText={aiSuggestion.baseText}
                      suggestion={aiSuggestion.suggestion}
                      filePath={selectedFile}
                      onApply={applyAiSuggestion}
                      onDismiss={() => setAiSuggestion(null)}
                    />
                  )}
                </div>

                {/* File action bar */}
                <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
                  {unresolvedCount > 0 && (
                    <span style={{ fontSize: 11, color: "var(--yellow)", alignSelf: "center", marginRight: "auto" }}>
                      Resolve all conflicts, then mark as resolved
                    </span>
                  )}
                  <button onClick={() => {
                    const rebuilt = buildFinalContent(sections);
                    const reparsed = parseMergeSections(rebuilt);
                    setSections(reparsed.map((s, i) => ({
                      id: i, type: s.type, common: s.common, ours: s.ours, theirs: s.theirs,
                      resolution: "unresolved" as const, resolvedLines: undefined,
                    })));
                  }}
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

const LineRow: React.FC<{ lineNum?: number; text: string; bg?: string }> = React.memo(({ lineNum, text, bg }) => (
  <div style={{ display: "flex", minHeight: 20, lineHeight: "20px", background: bg || "transparent", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
    <span style={{ width: 40, flexShrink: 0, textAlign: "right", paddingRight: 8, color: "var(--text-muted)", fontSize: 11, userSelect: "none", opacity: 0.6 }}>
      {lineNum ?? ""}
    </span>
    <span style={{ flex: 1, whiteSpace: "pre", overflowX: "auto", paddingRight: 8, color: "var(--text-primary)" }}>{text}</span>
  </div>
));

const EmptyLine: React.FC<{ label?: string }> = ({ label }) => (
  <div style={{ minHeight: 20, lineHeight: "20px", paddingLeft: 48, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", opacity: 0.5 }}>
    {label || "(empty)"}
  </div>
);

const ConflictPickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} style={{ ...conflictPickBtnBase, border: `1px solid ${color}50`, background: `${color}10`, color }}>{label}</button>
);

const ConflictEditor: React.FC<{
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}> = ({ initialText, onSave, onCancel }) => {
  const [text, setText] = useState(initialText);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>Custom edit</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onCancel} style={{ ...conflictPickBtnBase, color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={() => onSave(text)} style={{ ...conflictPickBtnBase, color: "var(--green)", border: "1px solid var(--green)60" }}>Done</button>
        </div>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} rows={Math.max(3, text.split("\n").length + 1)}
        style={{
          width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: "20px",
          padding: "4px 8px 4px 48px", margin: 0, background: "var(--surface-1)", color: "var(--text-primary)",
          border: "none", outline: "2px solid var(--accent)40", resize: "vertical", whiteSpace: "pre", overflowWrap: "normal", boxSizing: "border-box",
        }}
      />
    </div>
  );
};

const NavBtn: React.FC<{ label: string; icon: "up" | "down"; onClick: () => void; disabled: boolean }> = ({ label, icon, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
    style={{ background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 3, cursor: disabled ? "default" : "pointer", padding: "2px 4px", display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {icon === "up" ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  </button>
);

const QuickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button onClick={onClick} style={{ padding: "2px 8px", fontSize: 10, fontWeight: 500, border: `1px solid ${color}40`, borderRadius: 3, cursor: "pointer", background: `${color}10`, color }}>{label}</button>
);

const CenteredMsg: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>{text}</div>
);

/* ═══════════════ AI Suggestion Overlay ═══════════════ */

const AiSuggestionOverlay: React.FC<{
  currentText: string;
  suggestion: string;
  filePath: string;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ currentText, suggestion, filePath, onApply, onDismiss }) => {
  const diffLines = useMemo(() => computeLineDiff(currentText, suggestion), [currentText, suggestion]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 10,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", flexDirection: "column",
      animation: "fade-in 0.15s ease-out",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--surface-1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mauve)" }}>AI Suggestion</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{filePath}</span>
        </div>
      </div>
      <div style={{
        flex: 1, overflow: "auto", padding: "8px 0",
        background: "var(--surface-0)",
        fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: "20px",
      }}>
        {diffLines.map((d, i) => (
          <div key={i} style={{
            padding: "0 12px 0 8px", minHeight: 20, display: "flex",
            background: d.type === "added" ? "rgba(166,227,161,0.1)" : d.type === "removed" ? "rgba(243,139,168,0.1)" : "transparent",
          }}>
            <span style={{ width: 40, flexShrink: 0, textAlign: "right", paddingRight: 8, color: "var(--text-muted)", fontSize: 11, userSelect: "none" }}>{i + 1}</span>
            <span style={{ color: d.type === "added" ? "var(--green)" : d.type === "removed" ? "var(--red)" : "var(--text-primary)" }}>
              <span style={{ userSelect: "none", marginRight: 4 }}>{d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}</span>
              {d.line}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        padding: "10px 16px", borderTop: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "flex-end", gap: 8,
        background: "var(--surface-1)",
      }}>
        <button onClick={onDismiss} style={secondaryBtnStyle}>Dismiss</button>
        <button onClick={onApply} style={{ ...primaryBtnStyle, background: "var(--mauve)" }}>Apply</button>
      </div>
    </div>
  );
};

/* ═══════════════ Helpers ═══════════════ */

function mergeToolDisplayName(tool: MergeToolSettings): string {
  if (!tool.mergeToolName || tool.mergeToolName === "custom") return "external tool";
  return tool.mergeToolName;
}

function countConflictMarkers(text: string): number {
  let count = 0, idx = 0;
  while ((idx = text.indexOf("<<<<<<<", idx)) !== -1) { count++; idx += 7; }
  return count;
}

/* ═══════════════ Conflict Parsing ═══════════════ */

interface MergeSection {
  type: "common" | "conflict";
  common?: string[];
  ours?: string[];
  theirs?: string[];
  resolution: string | null;
  resolved?: string[];
}

function parseMergeSections(content: string): MergeSection[] {
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

/** Build final merged text from UI section state */
function buildFinalContent(sections: ParsedSection[]): string {
  const lines: string[] = [];
  for (const s of sections) {
    if (s.type === "common") {
      lines.push(...(s.common || []));
    } else if (s.resolution === "unresolved") {
      lines.push("<<<<<<< HEAD");
      lines.push(...(s.ours || []));
      lines.push("=======");
      lines.push(...(s.theirs || []));
      lines.push(">>>>>>> incoming");
    } else {
      lines.push(...(s.resolvedLines || []));
    }
  }
  return lines.join("\n");
}

/** Extract per-conflict AI resolutions using common sections as anchors */
function extractAiResolutions(originalSections: ParsedSection[], aiText: string): Map<number, string[]> {
  const result = new Map<number, string[]>();
  const aiLines = aiText.split("\n");
  let aiIdx = 0;

  for (let sIdx = 0; sIdx < originalSections.length; sIdx++) {
    const section = originalSections[sIdx];
    if (section.type === "common") {
      const commonLines = section.common || [];
      for (let c = 0; c < commonLines.length && aiIdx < aiLines.length; c++) {
        aiIdx++;
      }
    } else {
      // Find next common section's first line as boundary
      let boundaryLine: string | undefined;
      for (let nIdx = sIdx + 1; nIdx < originalSections.length; nIdx++) {
        if (originalSections[nIdx].type === "common" && (originalSections[nIdx].common || []).length > 0) {
          boundaryLine = (originalSections[nIdx].common || [])[0];
          break;
        }
      }
      const resolved: string[] = [];
      while (aiIdx < aiLines.length) {
        if (boundaryLine !== undefined && aiLines[aiIdx] === boundaryLine) break;
        resolved.push(aiLines[aiIdx]);
        aiIdx++;
      }
      result.set(section.id, resolved);
    }
  }
  return result;
}

/* ═══════════════ Raw text conflict resolution (backward compat) ═══════════════ */

interface ConflictPosition {
  startOffset: number;
  endOffset: number;
  oursContent: string;
  theirsContent: string;
}

function parseConflictPositions(text: string): ConflictPosition[] {
  const results: ConflictPosition[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const startIdx = text.indexOf("<<<<<<<", searchFrom);
    if (startIdx === -1) break;
    const sepIdx = text.indexOf("=======", startIdx);
    if (sepIdx === -1) break;
    const endMarkerIdx = text.indexOf(">>>>>>>", sepIdx);
    if (endMarkerIdx === -1) break;
    const endOfLine = text.indexOf("\n", endMarkerIdx);
    const endOffset = endOfLine === -1 ? text.length : endOfLine + 1;
    const oursStartOffset = text.indexOf("\n", startIdx);
    if (oursStartOffset === -1) break;
    const baseMarkerIdx = text.indexOf("|||||||", startIdx);
    const oursEndOffset = (baseMarkerIdx !== -1 && baseMarkerIdx < sepIdx) ? baseMarkerIdx : sepIdx;
    let oursContent = text.substring(oursStartOffset + 1, oursEndOffset);
    if (oursContent.endsWith("\n")) oursContent = oursContent.slice(0, -1);
    const theirsStartOffset = text.indexOf("\n", sepIdx);
    if (theirsStartOffset === -1) break;
    let theirsContent = text.substring(theirsStartOffset + 1, endMarkerIdx);
    if (theirsContent.endsWith("\n")) theirsContent = theirsContent.slice(0, -1);
    results.push({ startOffset: startIdx, endOffset, oursContent, theirsContent });
    searchFrom = endOffset;
  }
  return results;
}

function resolveAllConflicts(text: string, pick: "ours" | "theirs"): string {
  const conflicts = parseConflictPositions(text);
  let result = text;
  for (let i = conflicts.length - 1; i >= 0; i--) {
    const c = conflicts[i];
    let replacement = pick === "ours" ? c.oursContent : c.theirsContent;
    if (replacement && c.endOffset < text.length) replacement += "\n";
    result = result.substring(0, c.startOffset) + replacement + result.substring(c.endOffset);
  }
  return result;
}

/* ═══════════════ Line Diff (LCS) ═══════════════ */

interface DiffLine {
  type: "same" | "added" | "removed";
  line: string;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.replace(/\n$/, "").split("\n") : [];
  const newLines = newText ? newText.replace(/\n$/, "").split("\n") : [];
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "same", line: oldLines[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", line: newLines[j - 1] }); j--;
    } else {
      result.push({ type: "removed", line: oldLines[i - 1] }); i--;
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

const separatorStyle: React.CSSProperties = {
  width: 1, height: 16, background: "var(--border)", margin: "0 2px", display: "inline-block",
};

const conflictPickBtnBase: React.CSSProperties = {
  padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 3, cursor: "pointer", background: "transparent",
};

const conflictActionBarStyle: React.CSSProperties = {
  padding: "4px 8px", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
  background: "var(--yellow)08", borderBottom: "1px solid var(--yellow)20",
};

const resolvedHeaderStyle: React.CSSProperties = {
  padding: "2px 8px", display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "var(--green)10", borderBottom: "1px solid var(--green)20",
};

const tinyBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", fontSize: 10, padding: "1px 4px",
};

const sectionLabelStyle = (color: string): React.CSSProperties => ({
  padding: "3px 8px", display: "flex", alignItems: "center", color,
  background: `${color}15`, borderBottom: `1px solid ${color}25`,
});

export { parseMergeSections, resolveAllConflicts, buildMergedContent, computeLineDiff };
export type { MergeSection };
