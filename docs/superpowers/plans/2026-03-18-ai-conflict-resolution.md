# AI Conflict Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing AI conflict resolution backend into the MergeConflictDialog UI with a diff preview overlay.

**Architecture:** Single-file change to `MergeConflictDialog.tsx`. Add local React state for AI flow, an inline `computeLineDiff` utility, and an `AiSuggestionOverlay` sub-component. The button calls the existing preload API `window.electronAPI.mcp.suggestConflictResolution(filePath)`.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-18-ai-conflict-resolution-design.md`

---

### Task 1: `computeLineDiff` utility — tests

**Files:**
- Modify: `src/renderer/components/dialogs/MergeConflictDialog.test.tsx`

- [ ] **Step 1: Write failing tests for `computeLineDiff`**

Add a new `describe("computeLineDiff")` block at the bottom of the test file. Import `computeLineDiff` from the component (it will be exported alongside existing helpers).

```typescript
import {
  MergeConflictDialog,
  parseMergeSections,
  resolveAllConflicts,
  buildMergedContent,
  computeLineDiff,
} from "./MergeConflictDialog";

// ... at the bottom of the file:

describe("computeLineDiff", () => {
  it("returns all 'same' for identical texts", () => {
    const result = computeLineDiff("a\nb\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "same", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects added lines", () => {
    const result = computeLineDiff("a\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "added", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects removed lines", () => {
    const result = computeLineDiff("a\nb\nc", "a\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects replaced lines", () => {
    const result = computeLineDiff("a\nold\nc", "a\nnew\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "old" },
      { type: "added", line: "new" },
      { type: "same", line: "c" },
    ]);
  });

  it("handles empty old text", () => {
    const result = computeLineDiff("", "a\nb");
    expect(result).toEqual([
      { type: "added", line: "a" },
      { type: "added", line: "b" },
    ]);
  });

  it("handles empty new text", () => {
    const result = computeLineDiff("a\nb", "");
    expect(result).toEqual([
      { type: "removed", line: "a" },
      { type: "removed", line: "b" },
    ]);
  });

  it("handles multiple insertions and deletions", () => {
    const result = computeLineDiff("a\nb\nc\nd", "a\nc\nd\ne");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "b" },
      { type: "same", line: "c" },
      { type: "same", line: "d" },
      { type: "added", line: "e" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/dialogs/MergeConflictDialog.test.tsx`
Expected: FAIL — `computeLineDiff` is not exported

---

### Task 2: `computeLineDiff` utility — implementation

**Files:**
- Modify: `src/renderer/components/dialogs/MergeConflictDialog.tsx`

- [ ] **Step 3: Implement `computeLineDiff` with LCS algorithm**

Add before the `/* ═══════════════ Styles ═══════════════ */` section:

```typescript
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
```

- [ ] **Step 4: Export `computeLineDiff` from the module**

Update the exports at the bottom of the file:

```typescript
export { parseMergeSections, resolveAllConflicts, buildMergedContent, computeLineDiff };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/dialogs/MergeConflictDialog.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/dialogs/MergeConflictDialog.tsx src/renderer/components/dialogs/MergeConflictDialog.test.tsx
git commit -m "feat: add computeLineDiff LCS utility for AI conflict resolution"
```

---

### Task 3: AI state and "Resolve with AI" button — tests

**Files:**
- Modify: `src/renderer/components/dialogs/MergeConflictDialog.test.tsx`

- [ ] **Step 7: Add mock for `mcp.suggestConflictResolution` in `beforeEach`**

In the existing `beforeEach`, add the `mcp` namespace to the mock `electronAPI`:

```typescript
const suggestConflictResolutionMock = vi.fn().mockResolvedValue("resolved by AI");

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    conflict: {
      list: listMock,
      fileContent: fileContentMock,
      resolve: resolveMock,
      saveMerged: saveMergedMock,
      launchMergeTool: launchMergeToolMock,
    },
    settings: {
      get: settingsGetMock,
    },
    mcp: {
      suggestConflictResolution: suggestConflictResolutionMock,
    },
  };
});
```

- [ ] **Step 8: Write tests for AI button visibility and flow**

Add a new `describe("MergeConflictDialog AI conflict resolution")` block:

```typescript
describe("MergeConflictDialog AI conflict resolution", () => {
  it("does not show Resolve with AI button when AI is not configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "none", aiApiKey: "",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
    });

    expect(screen.queryByText("Resolve with AI")).not.toBeInTheDocument();
  });

  it("shows Resolve with AI button when AI is configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test-key",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resolve with AI")).toBeInTheDocument();
    });
  });

  it("calls suggestConflictResolution and shows overlay on click", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "openai", aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("resolved content by AI");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resolve with AI")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Resolve with AI"));

    await waitFor(() => {
      expect(suggestConflictResolutionMock).toHaveBeenCalledWith("CHANGELOG.md");
    });

    await waitFor(() => {
      expect(screen.getByText("AI Suggestion")).toBeInTheDocument();
      expect(screen.getByText("Apply")).toBeInTheDocument();
      expect(screen.getByText("Dismiss")).toBeInTheDocument();
    });
  });

  it("dismisses overlay without applying changes", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("ai resolved");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));
    await waitFor(() => expect(screen.getByText("AI Suggestion")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
    });
  });

  it("applies AI suggestion to center textarea on Apply", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("clean resolved content");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));
    await waitFor(() => expect(screen.getByText("Apply")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
      // Conflict count should be 0 since "clean resolved content" has no markers
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });

  it("discards stale AI result when file selection changes mid-flight", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    // Make the AI call hang until we resolve it manually
    let resolveAi!: (value: string) => void;
    suggestConflictResolutionMock.mockReturnValue(
      new Promise<string>((resolve) => { resolveAi = resolve; })
    );

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());

    // Start AI resolution for first file (CHANGELOG.md)
    fireEvent.click(screen.getByText("Resolve with AI"));

    // Switch to second file before AI responds
    fireEvent.click(screen.getByText("v.info"));

    // Now resolve the AI promise (stale result for CHANGELOG.md)
    resolveAi("stale suggestion for wrong file");

    // The overlay should NOT appear because we switched files
    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
    });
  });

  it("shows error when AI call fails", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockRejectedValue(new Error("API rate limited"));

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));

    await waitFor(() => {
      expect(screen.getByText("API rate limited")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/dialogs/MergeConflictDialog.test.tsx`
Expected: FAIL — "Resolve with AI" button not found

---

### Task 4: AI state, button, and overlay — implementation

**Files:**
- Modify: `src/renderer/components/dialogs/MergeConflictDialog.tsx`

- [ ] **Step 10: Add AI state variables**

After the existing `const [useInternalEditor, setUseInternalEditor] = useState(false);` line, add:

```typescript
const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
const [aiLoading, setAiLoading] = useState(false);
const [aiConfigured, setAiConfigured] = useState(false);
const aiRequestFileRef = useRef<string | null>(null);
```

- [ ] **Step 11: Read AI config from settings on mount**

In the existing `useEffect` that runs on `open` (the one that calls `settings.get()`), extend the settings read to also check AI config. In the reset block at the top, add `setAiSuggestion(null); setAiLoading(false);`. In the `.then((s) => { ... })` handler, add:

```typescript
const aiSettings = s as unknown as { aiProvider?: string; aiApiKey?: string };
setAiConfigured(
  !!aiSettings.aiProvider && aiSettings.aiProvider !== "none" && !!aiSettings.aiApiKey
);
```

- [ ] **Step 12: Reset AI state on file selection change**

Add a `useEffect` that resets AI state when selectedFile changes. Crucially, invalidate `aiRequestFileRef` so that in-flight AI requests for the old file are discarded when they resolve:

```typescript
useEffect(() => {
  setAiSuggestion(null);
  setAiLoading(false);
  aiRequestFileRef.current = null;
}, [selectedFile]);
```

- [ ] **Step 13: Add `handleResolveWithAi` handler**

After the existing `resolveAllAs` callback:

```typescript
const handleResolveWithAi = useCallback(async () => {
  if (!selectedFile || aiLoading) return;
  setAiLoading(true);
  setError(null);
  aiRequestFileRef.current = selectedFile;
  try {
    const suggestion = await window.electronAPI.mcp.suggestConflictResolution(selectedFile);
    if (aiRequestFileRef.current === selectedFile) {
      setAiSuggestion(suggestion);
    }
  } catch (e: unknown) {
    if (aiRequestFileRef.current === selectedFile) {
      setError(e instanceof Error ? e.message : String(e));
    }
  } finally {
    if (aiRequestFileRef.current === selectedFile) {
      setAiLoading(false);
    }
  }
}, [selectedFile, aiLoading]);
```

- [ ] **Step 14: Add "Resolve with AI" button to toolbar**

In the toolbar `<div>` that contains the quick buttons (the div with `gap: 6`), after the external merge tool button block (after the closing `{hasExternalTool && ( ... )}` block and before the closing `</div>`), add:

```tsx
{aiConfigured && (
  <>
    <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
    <button
      onClick={handleResolveWithAi}
      disabled={aiLoading || resolvedFiles.has(selectedFile!)}
      style={{
        padding: "2px 10px", fontSize: 10, fontWeight: 600,
        border: "1px solid var(--mauve)60", borderRadius: 3,
        cursor: aiLoading || resolvedFiles.has(selectedFile!) ? "not-allowed" : "pointer",
        background: "var(--mauve)15", color: "var(--mauve)",
        opacity: aiLoading || resolvedFiles.has(selectedFile!) ? 0.5 : 1,
        display: "flex", alignItems: "center", gap: 4,
      }}
    >
      {aiLoading ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          Resolving...
        </>
      ) : (
        "Resolve with AI"
      )}
    </button>
  </>
)}
```

Also add the `spin` keyframe to the existing `<style>` block:

```css
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
```

- [ ] **Step 15: Add `AiSuggestionOverlay` component**

Add before the `/* ═══════════════ Styles ═══════════════ */` section (after `computeLineDiff`):

```tsx
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
      {/* Header */}
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

      {/* Diff body */}
      <div style={{
        flex: 1, overflow: "auto", padding: "8px 0",
        background: "var(--surface-0)",
        fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: "20px",
      }}>
        {diffLines.map((d, i) => (
          <div key={i} style={{
            padding: "0 12px 0 8px", minHeight: 20,
            display: "flex",
            background: d.type === "added" ? "rgba(166,227,161,0.1)"
              : d.type === "removed" ? "rgba(243,139,168,0.1)"
              : "transparent",
          }}>
            <span style={{
              width: 40, flexShrink: 0, textAlign: "right", paddingRight: 8,
              color: "var(--text-muted)", fontSize: 11, userSelect: "none",
            }}>
              {i + 1}
            </span>
            <span style={{
              color: d.type === "added" ? "var(--green)"
                : d.type === "removed" ? "var(--red)"
                : "var(--text-primary)",
            }}>
              <span style={{ userSelect: "none", marginRight: 4 }}>
                {d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}
              </span>
              {d.line}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
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
```

- [ ] **Step 16: Render the overlay in the 3-pane container**

The 3-pane container is the `<div>` at line 317 that wraps the 3 textareas. Wrap it with `position: relative` and add the overlay:

Change the div wrapping the 3 textareas from:
```tsx
<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
```
to:
```tsx
<div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
```

And after the 3 textareas (after `</textarea>` for the right pane), before the closing `</div>`, add:

```tsx
{aiSuggestion !== null && selectedFile && (
  <AiSuggestionOverlay
    currentText={getCenterText()}
    suggestion={aiSuggestion}
    filePath={selectedFile}
    onApply={() => { setCenterText(aiSuggestion); setAiSuggestion(null); }}
    onDismiss={() => setAiSuggestion(null)}
  />
)}
```

- [ ] **Step 17: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/dialogs/MergeConflictDialog.test.tsx`
Expected: ALL PASS

- [ ] **Step 18: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 19: Run full test suite**

Run: `npm test`
Expected: ALL tests pass

- [ ] **Step 20: Commit**

```bash
git add src/renderer/components/dialogs/MergeConflictDialog.tsx src/renderer/components/dialogs/MergeConflictDialog.test.tsx
git commit -m "feat: add AI conflict resolution button and diff preview overlay"
```

---

### Task 5: Memory update

- [ ] **Step 21: Update MEMORY.md and claude-mem**

Add entry for `feature_ai_conflict_resolution.md` to MEMORY.md and save observation to claude-mem.
