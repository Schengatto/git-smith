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
- `rebase-merge/` or `rebase-apply/` exists → `'rebase'` (read `msgnum`/`end` for step progress)
- `CHERRY_PICK_HEAD` exists → `'cherry-pick'`
- None → `null`

### 2. Missing Backend Methods (git-service.ts)

Add methods that don't exist yet:

| Method | Git command | Notes |
|--------|------------|-------|
| `mergeAbort()` | `git merge --abort` | New |
| `cherryPickAbort()` | `git cherry-pick --abort` | New |
| `cherryPickContinue()` | `git cherry-pick --continue` | New |

Existing: `rebaseAbort()`, `rebaseContinue()`.

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
**Visibility:** When `status.operationInProgress !== null` AND (`status.conflicted.length > 0` OR operation just completed resolution).

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
