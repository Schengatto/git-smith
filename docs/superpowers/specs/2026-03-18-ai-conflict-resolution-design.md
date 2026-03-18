# AI Conflict Resolution in MergeConflictDialog

**Date**: 2026-03-18
**Status**: Approved

## Summary

Add an "Resolve with AI" button to the MergeConflictDialog that sends the conflicted file to the configured AI provider and displays the suggested resolution in a diff overlay for user review before applying.

## Context

The backend infrastructure for AI conflict resolution already exists:
- `McpAiClient.suggestConflictResolution()` in `src/main/mcp/mcp-client.ts`
- IPC channel `mcp:ai:suggest-conflict-resolution` registered in `src/main/ipc/mcp.ipc.ts`
- Preload API `window.electronAPI.mcp.suggestConflictResolution(filePath)` in `src/preload/index.ts`
- Zustand action in `src/renderer/store/mcp-store.ts`

Only the UI integration in `MergeConflictDialog.tsx` is missing.

## Design

### 1. "Resolve with AI" Button

Located in the MergeConflictDialog toolbar, alongside "Accept all LOCAL" / "Accept all REMOTE" buttons.

- Visible only when AI is configured (`aiProvider !== "none"` and `aiApiKey` present)
- Disabled during loading, when no file is selected, or when the file is already resolved
- Shows spinner and "Resolving..." text during AI call
- AI configuration check performed at dialog mount by reading settings (already fetched for merge tool config)

### 2. Diff Preview Overlay

When the AI returns a result, an overlay appears over the 3 merge panes (not over the file list sidebar).

**Positioning**: The 3-pane container gets `position: relative`. The overlay is an absolutely-positioned child with `inset: 0` inside it.

**Layout**:
- **Header**: "AI Suggestion" label with file path shown for clarity
- **Body**: Line-by-line diff view comparing current merged content vs AI suggestion
  - Removed lines: red-tinted background
  - Added lines: green-tinted background
  - Unchanged lines: neutral background
  - Monospace font, line numbers, scrollable
- **Footer**: "Apply" (accent color) and "Dismiss" (neutral) buttons
- **Apply**: replaces center textarea content with AI suggestion, recalculates conflict count, closes overlay
- **Dismiss**: closes overlay without changes

Overlay styled with semi-transparent backdrop and blur, consistent with existing dialog styling.

Note: applying the AI suggestion does not auto-mark the file as resolved. The user must still explicitly click "Mark as resolved", consistent with manual editing behavior.

### 3. State Management

New React local state (consistent with existing dialog pattern — no Zustand for dialog-local state):

- `aiSuggestion: string | null` — AI-suggested text
- `aiLoading: boolean` — loading spinner state
- `aiConfigured: boolean` — whether AI is configured
- `aiRequestFile: string | null` — tracks which file the in-flight AI request is for

**Flow**:
1. Click "Resolve with AI" → `aiLoading = true`, `aiRequestFile = selectedFile`
2. Call `window.electronAPI.mcp.suggestConflictResolution(selectedFile)` directly. The `selectedFile` is a relative path from `ConflictFile.path`, which is the same format already used by `conflict.fileContent()` and `conflict.resolve()` — compatible with the backend.
3. Success → if `aiRequestFile === selectedFile` (still viewing same file), set `aiSuggestion = result` and show overlay. Otherwise discard stale result.
4. "Apply" → `setCenterText(aiSuggestion)`, close overlay
5. "Dismiss" → `aiSuggestion = null`
6. Error → display in existing error banner via `setError(...)`, `aiLoading = false`

**File selection change**: when `selectedFile` changes, reset `aiSuggestion = null` and `aiLoading = false`. Stale in-flight results are discarded via the `aiRequestFile` guard.

### 4. Diff Computation

Inline utility function `computeLineDiff(oldText, newText)`:
- Line-by-line comparison returning `{ type: 'same' | 'added' | 'removed', line: string }[]`
- Uses LCS (Longest Common Subsequence) algorithm for accurate minimal diffs. A naive line-by-line comparison would show entire blocks as removed+added when lines are inserted/deleted, making the preview unusable.
- No external dependencies — the LCS implementation is straightforward for line-level granularity
- Only consumer is the overlay in this component

### 5. Edge Cases

**AI returns content with conflict markers**: The `setCenterText()` helper already calls `countConflictMarkers()`. If the AI suggestion still contains markers, the conflict count badge will be non-zero after applying, and the user cannot mark the file as resolved until they manually fix remaining markers. No special handling needed — the existing UX handles this naturally.

**Large files / token truncation**: The AI client uses `max_tokens: 1024` which may truncate large files. This is a known backend limitation outside this spec's scope. If the AI returns truncated content, the diff preview will make it obvious to the user (the diff will show content being removed at the end of the file), and they can dismiss.

## Files Modified

- `src/renderer/components/dialogs/MergeConflictDialog.tsx` — only file modified

## Files NOT Modified

- No changes to IPC channels, preload, backend, git-service, or Zustand store
- No new dependencies

## Testing

- Unit tests for `computeLineDiff` function (LCS correctness, insertions, deletions, mixed changes)
- Unit tests for button visibility based on AI configuration
- Unit tests for overlay show/hide flow (apply and dismiss)
- Unit test for stale result discard on file selection change
