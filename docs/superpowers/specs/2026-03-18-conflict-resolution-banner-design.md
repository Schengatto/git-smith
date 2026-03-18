# Conflict Resolution Banner

**Date:** 2026-03-18
**Status:** Approved

## Overview

A persistent banner in the main AppShell window that informs users when merge conflicts exist from an in-progress git operation (merge, rebase, cherry-pick). The banner shows conflict resolution progress, offers actions to resolve/continue/abort, and transitions from a red/warning state to a green/success state when all conflicts are resolved.

## Motivation

Currently, conflict state is only visible inside the CommitDialog (red banner) and RebaseDialog. If the user is looking at the commit graph or other panels, there is no indication that unresolved conflicts exist. This leads to confusion about why operations can't proceed.

## Design

### 1. State Detection (git-service.ts)

Extend `getStatus()` to detect which operation is in progress and rebase step info:

```typescript
// In GitStatus (git-types.ts)
type GitOperation = 'merge' | 'rebase' | 'cherry-pick' | null;

interface GitStatus {
  // ...existing fields...
  operationInProgress: GitOperation;
  rebaseStep?: { current: number; total: number };
}
```

Detection logic in `getStatus()`:
- `MERGE_HEAD` exists → `'merge'`
- `rebase-merge/` or `rebase-apply/` exists → `'rebase'`
  - Step progress: read `rebase-merge/msgnum` + `rebase-merge/end` for interactive rebases, or `rebase-apply/next` + `rebase-apply/last` for non-interactive rebases
- `CHERRY_PICK_HEAD` exists → `'cherry-pick'`
- None → `null`

**Critical fix:** The current `getStatus()` only populates `conflicted[]` when `mergeInProgress` is true. This guard must be removed so that conflicted files are detected for all operation types (merge, rebase, cherry-pick). The `status.conflicted` array from simple-git reflects unmerged entries regardless of operation type.

**Backward compatibility:** The existing `mergeInProgress` boolean field on `GitStatus` is kept for backward compatibility with CommitDialog. It is derived from `operationInProgress === 'merge'`.

### 2. Missing Backend Methods (git-service.ts)

Add methods that don't exist yet:

| Method | Git command | Notes |
|--------|------------|-------|
| `mergeAbort()` | `git merge --abort` | New |
| `mergeContinue()` | `git commit` (reads `.git/MERGE_MSG`) | New — completes the merge by committing with the auto-generated merge message |
| `cherryPickAbort()` | `git cherry-pick --abort` | New |
| `cherryPickContinue()` | `git cherry-pick --continue` | New |

Existing: `rebaseAbort()`, `rebaseContinue()`.

New IPC channel for merge continue:

```typescript
MERGE_CONTINUE: "git:branch:merge-continue",
```

### 3. New IPC Channels (ipc-channels.ts)

```typescript
MERGE_ABORT: "git:branch:merge-abort",
CHERRY_PICK_ABORT: "git:branch:cherry-pick-abort",
CHERRY_PICK_CONTINUE: "git:branch:cherry-pick-continue",
```

Handlers registered in `git-branch.ipc.ts`, exposed in `preload/index.ts`.

### 4. ConflictBanner Component

**Location:** `src/renderer/components/layout/ConflictBanner.tsx`
**Rendered in:** AppShell.tsx, between `<Toolbar />` and the main Dockview content area.
**Visibility:** When `status.operationInProgress !== null`. The red/green sub-state is determined by `status.conflicted.length`.

#### Two Visual States

**A. Conflicts Present (red/warning background):**
- Warning icon + context-aware text:
  - Merge: "Merge in progress — 2/5 conflicts resolved"
  - Rebase: "Rebase in progress (step 3/7) — 1/3 conflicts resolved"
  - Cherry-pick: "Cherry-pick in progress — 0/2 conflicts resolved"
- "Resolve Conflicts" button → opens MergeConflictDialog
- "Abort [Operation]" button → confirmation dialog then abort

**B. All Resolved (green/success background):**
- Check icon + "All conflicts resolved"
- "Continue [Operation]" button (prominent) → executes continue for the operation
- "Abort" button still available

#### Progress Tracking

The total conflict count is captured in a `useRef` when the banner first appears (or when the count increases). The "resolved" count is `total - current conflicted count`.

**Rebase step resets:** For multi-step rebases, the conflict set can change when moving to the next step (after `rebase --continue`). The total ref resets whenever `rebaseStep.current` changes, since a new step brings a new set of conflicts.

#### Action Variants by Operation

| Operation   | Resolve            | Continue                                       | Abort              | Extra                                        |
| ----------- | ------------------ | ---------------------------------------------- | ------------------ | -------------------------------------------- |
| Merge       | Resolve Conflicts  | Continue Merge (commits with `.git/MERGE_MSG`) | Abort Merge        | —                                            |
| Rebase      | Resolve Conflicts  | Continue Rebase                                | Abort Rebase       | Skip Commit (uses existing `rebaseSkip()`)   |
| Cherry-pick | Resolve Conflicts  | Continue Cherry-pick                           | Abort Cherry-pick  | —                                            |

#### Error Handling

If abort/continue operations fail (e.g., unstaged resolved files, conflicts in next rebase step), the error is shown via the existing `GitOperationLogDialog` which captures real-time git output. The banner remains in its current state and refreshes after the operation log closes.

#### Styling

Inline styles consistent with existing CommitDialog conflict banner. Catppuccin theme CSS variables (`--red`, `--green`, `--text-primary`). `flexShrink: 0` to prevent layout compression.

### 5. Integration Flow

```
1. User triggers merge/rebase/cherry-pick → conflicts occur
2. refreshStatus() runs automatically (post-operation event)
3. getStatus() returns operationInProgress + conflicted[]
4. ConflictBanner renders in AppShell (red state)
5. User clicks "Resolve Conflicts" → MergeConflictDialog opens
6. After each resolution → refreshStatus() → counter updates
7. conflicted.length === 0 → banner transitions to green
8. User clicks "Continue" → app runs continue command
9. refreshStatus() → operationInProgress = null → banner disappears
```

**Abort flow:**
- User clicks "Abort" → confirmation dialog
- Confirmed → execute abort → refreshStatus() → banner disappears

### 6. Coexistence with CommitDialog Banner

The existing CommitDialog conflict banner remains unchanged. It serves users who open the commit dialog directly. ConflictBanner in AppShell is the primary, always-visible entry point. No conflict between the two.

### 7. Testing

- **ConflictBanner.test.tsx:** Render with/without conflicts, verify text for each operation type, verify green transition when conflicts=0, click handler mocks for resolve/abort/continue buttons, confirmation dialog for abort.
- **git-service tests:** Unit tests for `mergeAbort()`, `cherryPickAbort()`, `cherryPickContinue()`, and the extended `getStatus()` operation detection.
