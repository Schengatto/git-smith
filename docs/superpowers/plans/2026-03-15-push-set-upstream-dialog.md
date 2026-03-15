# Push Set-Upstream Dialog — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a push fails because the branch has no upstream, detect the error from git output and show a recovery dialog that lets the user select a remote and push with `--set-upstream`.

**Architecture:** Optimistic push → catch git's "has no upstream branch" error → parse remote+branch from git message → open `SetUpstreamDialog`. No pre-flight IPC check needed; git's own error output provides all information. `gitService.push()` gains a `setUpstream` flag and switches to `git.raw()` for reliable arg passthrough.

**Tech Stack:** Electron 41, React 18, TypeScript, simple-git 3.33, Vitest, Zustand, Tailwind/Catppuccin theme (CSS variables), inline styles on components.

**Spec:** `docs/superpowers/specs/2026-03-15-push-set-upstream-dialog-design.md`

---

## Chunk 1: Backend — `gitService.push()` + IPC layer

### Task 1: Unit tests for `gitService.push()`

**Files:**
- Create: `src/main/git/git-service-push.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/git/git-service-push.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.push", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    // Simulate an open repo by setting private fields via cast
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  // Note: git.raw() receives rawArgs = ["push", ...logArgs].
  // The implementation splits logArgs (for logging) from rawArgs (for git.raw()).

  it("pushes normally (no flags)", async () => {
    await service.push("origin", "main", false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "main"]);
  });

  it("pushes with --force", async () => {
    await service.push("origin", "main", true, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--force", "origin", "main"]);
  });

  it("pushes with --set-upstream", async () => {
    await service.push("origin", "main", false, true);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--set-upstream", "origin", "main"]);
  });

  it("pushes with --force and --set-upstream", async () => {
    await service.push("origin", "main", true, true);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--force", "--set-upstream", "origin", "main"]);
  });

  it("omits branch arg when branch is undefined", async () => {
    await service.push("origin", undefined, false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin"]);
  });

  it("defaults remote to 'origin' when undefined", async () => {
    await service.push(undefined, "main", false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "main"]);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run src/main/git/git-service-push.test.ts
```

Expected: all tests FAIL (method uses `git.push()`, not `git.raw()`, and lacks `setUpstream` param).

---

### Task 2: Implement `gitService.push()` changes

**Files:**
- Modify: `src/main/git/git-service.ts` (method `push`, ~line 859)

- [ ] **Step 3: Replace the `push()` method**

Find the existing `push()` method (currently ~line 859) and replace it:

```typescript
async push(remote?: string, branch?: string, force = false, setUpstream = false): Promise<void> {
  const git = this.ensureRepo();
  const r = remote || "origin";
  const flags: string[] = [];
  if (force) flags.push("--force");
  if (setUpstream) flags.push("--set-upstream");
  // logArgs: what the command-log panel shows (no "push" prefix — consistent with other methods)
  const logArgs = [...flags, r, ...(branch ? [branch] : [])];
  // rawArgs: full args for git.raw() which needs the subcommand included
  const rawArgs = ["push", ...logArgs];
  await this.run("git push", logArgs, () => git.raw(rawArgs));
}
```

> `pushTag()` is a separate method — do NOT touch it.

- [ ] **Step 4: Run the push tests — expect green**

```bash
npx vitest run src/main/git/git-service-push.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run the full suite — expect no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/git/git-service-push.test.ts src/main/git/git-service.ts
git commit -m "feat: add setUpstream param to gitService.push() using git.raw()"
```

---

> ⚠️ **Breaking change:** The existing `push()` used `git.push()`. This task replaces it entirely with `git.raw()` to guarantee `--set-upstream` flag passthrough. The mock in Task 1 mocks `raw` (not `push`) — this is intentional and must match.

### Task 3: Update IPC handler and preload

> ⚠️ **Hard prerequisite for Task 4:** `SetUpstreamDialog` calls `remote.push(..., true)` with 4 arguments. That 4th argument is silently dropped until Task 3 lands the `setUpstream` param in the IPC handler and preload. Complete Task 3 fully before starting Task 4.

**Files:**
- Modify: `src/main/ipc/git-remote.ipc.ts` (handler for `IPC.REMOTE.PUSH`, ~line 54)
- Modify: `src/preload/index.ts` (`remote.push` entry, ~line 107)

- [ ] **Step 7: Update IPC handler**

In `src/main/ipc/git-remote.ipc.ts`, replace the `REMOTE.PUSH` handler:

```typescript
ipcMain.handle(
  IPC.REMOTE.PUSH,
  async (
    _event,
    remote?: string,
    branch?: string,
    force?: boolean,
    setUpstream?: boolean
  ) => {
    await gitService.push(remote, branch, force, setUpstream);
  }
);
```

- [ ] **Step 8: Update preload**

In `src/preload/index.ts`, replace the `push` entry in the `remote` object:

```typescript
push: (
  remote?: string,
  branch?: string,
  force?: boolean,
  setUpstream?: boolean
): Promise<void> =>
  ipcRenderer.invoke(IPC.REMOTE.PUSH, remote, branch, force, setUpstream),
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/main/ipc/git-remote.ipc.ts src/preload/index.ts
git commit -m "feat: forward setUpstream param through IPC layer"
```

---

## Chunk 2: Frontend — `SetUpstreamDialog` + Toolbar wiring

### Task 4: `SetUpstreamDialog` component

**Files:**
- Create: `src/renderer/components/dialogs/SetUpstreamDialog.tsx`

The dialog:
- Accepts `open`, `onClose`, `suggestedRemote`, `suggestedBranch`, `force?`
- Reads `repo.currentBranch` from `useRepoStore()` (used only for display — `suggestedBranch` is used for the push call)
- On mount: calls `window.electronAPI.remote.list()`, extracts `.name` from each `RemoteInfo`
- Pre-selects `suggestedRemote`; falls back to first entry if not found
- Empty list or IPC failure → inline error, confirm disabled
- `force=true` → shows force-push warning banner
- Uses `ModalDialog`, `DialogActions`, `DialogError` from `./ModalDialog`

- [ ] **Step 11: Write the component**

Create `src/renderer/components/dialogs/SetUpstreamDialog.tsx`:

```typescript
import React, { useState, useEffect } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface Props {
  open: boolean;
  onClose: () => void;
  suggestedRemote: string;
  suggestedBranch: string;
  force?: boolean;
}

export const SetUpstreamDialog: React.FC<Props> = ({
  open,
  onClose,
  suggestedRemote,
  suggestedBranch,
  force = false,
}) => {
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [remotes, setRemotes] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState(suggestedRemote);
  const [remotesError, setRemotesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRemotesError(null);
    setPushError(null);
    setLoading(false);

    window.electronAPI.remote.list().then((list) => {
      const names = list.map((r) => r.name);
      if (names.length === 0) {
        setRemotesError("No remotes configured. Add a remote first.");
        setRemotes([]);
        return;
      }
      setRemotes(names);
      setSelectedRemote(names.includes(suggestedRemote) ? suggestedRemote : names[0]);
    }).catch(() => {
      setRemotesError("Failed to load remotes.");
      setRemotes([]);
    });
  }, [open, suggestedRemote]);

  const handleConfirm = async () => {
    setLoading(true);
    setPushError(null);
    try {
      await window.electronAPI.remote.push(selectedRemote, suggestedBranch, force, true);
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      setPushError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmDisabled = !!remotesError;

  return (
    <ModalDialog open={open} title="Set Upstream & Push" onClose={onClose} width={460}>
      {/* Branch → Remote row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Branch</div>
        <span className="badge badge-head-current">{suggestedBranch}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Remote</div>
        {remotesError ? (
          <span style={{ fontSize: 11, color: "var(--red)" }}>{remotesError}</span>
        ) : (
          <select
            value={selectedRemote}
            onChange={(e) => setSelectedRemote(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {remotes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </div>

      {/* Force push warning */}
      {force && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            fontSize: 11,
            color: "var(--red)",
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          Force pushing will <strong>overwrite the remote branch history</strong>.
          Any commits pushed by other collaborators that are not in your local branch will be permanently lost.
        </div>
      )}

      <DialogError error={pushError} />

      <DialogActions
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={force ? "Force Push & Set Upstream" : "Push & Set Upstream"}
        confirmColor={force ? "var(--red)" : undefined}
        loading={loading}
        disabled={confirmDisabled}
      />
    </ModalDialog>
  );
};
```

> **`DialogActions` props** (from `ModalDialog.tsx:123`): `disabled?: boolean` disables and grays the confirm button. No changes to `ModalDialog.tsx` needed.

- [ ] **Step 12: Type-check the new component**

- [ ] **Step 13: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add src/renderer/components/dialogs/SetUpstreamDialog.tsx src/renderer/components/dialogs/ModalDialog.tsx
git commit -m "feat: add SetUpstreamDialog component"
```

---

### Task 5: Wire `SetUpstreamDialog` into `Toolbar.tsx`

**Files:**
- Modify: `src/renderer/components/layout/Toolbar.tsx`

Changes needed:
1. Import `SetUpstreamDialog`
2. Add `setUpstreamError` state
3. Wrap push handlers in try/catch with error interception
4. Add post-push refresh to the normal push success path (currently fire-and-forget)
5. Update Force Push confirm handler to also intercept the upstream error
6. Render `<SetUpstreamDialog>`

- [ ] **Step 15: Add import and state**

At the top of `Toolbar.tsx`, add the import:

```typescript
import { SetUpstreamDialog } from "../dialogs/SetUpstreamDialog";
```

Inside the `Toolbar` component, add state (near the `forcePushConfirm` state):

```typescript
const [setUpstreamError, setSetUpstreamError] = useState<{
  suggestedRemote: string;
  suggestedBranch: string;
  force: boolean;
} | null>(null);
```

Helper to parse the upstream error:

```typescript
const handlePushError = (err: unknown, force: boolean): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("has no upstream branch")) {
    const match = msg.match(/git push --set-upstream (\S+) (\S+)/);
    setSetUpstreamError({
      suggestedRemote: match?.[1] ?? "origin",
      suggestedBranch: match?.[2] ?? (repo?.currentBranch ?? ""),
      force,
    });
    return true; // handled
  }
  return false; // not handled — caller should surface raw error
};
```

- [ ] **Step 16: Update the normal Push handler**

Find the existing `pushItems` array in `Toolbar.tsx` (around line 311). Replace the `onClick` for the normal "Push" entry. The current implementation fire-and-forgets; this version adds try/catch **and** the missing post-push refresh:

```typescript
onClick: async () => {
  try {
    await window.electronAPI.remote.push();
    await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]); // refresh graph+status on success
  } catch (err) {
    handlePushError(err, false);
    // If not an upstream error, the raw error is currently swallowed (pre-existing behaviour).
  }
},
```

- [ ] **Step 17: Update the Force Push confirm handler**

The `ForcePushConfirmDialog`'s `onConfirm` callback (around line 482) currently does:

```typescript
onConfirm={async () => {
  await window.electronAPI.remote.push(undefined, undefined, true);
  setForcePushConfirm(false);
}}
```

Replace it. Note: `finally` always executes — even after a `return` in `catch`. This is intentional: `setForcePushConfirm(false)` runs unconditionally so the force dialog always closes, regardless of outcome.

```typescript
onConfirm={async () => {
  try {
    await window.electronAPI.remote.push(undefined, undefined, true);
    await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
  } catch (err) {
    handlePushError(err, true);
    // Whether upstream error or not, the force dialog closes (handled by finally below).
  } finally {
    setForcePushConfirm(false); // always close the force-confirm dialog
  }
  // If handlePushError set setUpstreamError, SetUpstreamDialog will open after this.
}}
```

- [ ] **Step 18: Render `SetUpstreamDialog`**

After the existing `<ForcePushConfirmDialog ... />` (around line 485), add:

```typescript
<SetUpstreamDialog
  open={!!setUpstreamError}
  onClose={() => setSetUpstreamError(null)}
  suggestedRemote={setUpstreamError?.suggestedRemote ?? "origin"}
  suggestedBranch={setUpstreamError?.suggestedBranch ?? ""}
  force={setUpstreamError?.force}
/>
```

- [ ] **Step 19: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 20: Run the full test suite**

```bash
npm test
```

Expected: all 48+ tests pass.

- [ ] **Step 21: Commit**

```bash
git add src/renderer/components/layout/Toolbar.tsx
git commit -m "feat: intercept upstream push error and open SetUpstreamDialog"
```

---

## Chunk 3: Manual smoke test checklist

Before calling this done, verify manually in dev mode (`npm start`):

- [ ] **Normal push on branch with upstream** → pushes silently, graph refreshes. No dialog.
- [ ] **Normal push on branch without upstream** → push fails → `SetUpstreamDialog` opens with correct branch name and `origin` pre-selected.
- [ ] **Select a different remote** in the dialog → push uses the selected remote.
- [ ] **Cancel dialog** → nothing pushed, dialog closes.
- [ ] **Confirm** → push succeeds, dialog closes, graph/status refreshes.
- [ ] **Force push on branch with upstream** → existing `ForcePushConfirmDialog` as before.
- [ ] **Force push on branch without upstream** → `ForcePushConfirmDialog` opens → confirm → `SetUpstreamDialog` opens with force warning → confirm → push with `--force --set-upstream`.
- [ ] **Repo with no remotes** → dialog shows inline error, confirm disabled.
- [ ] **Commit**

```bash
git add -p   # only if any fixups from smoke test
git commit -m "fix: upstream dialog smoke test fixes" # only if needed
```
