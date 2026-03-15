# Push Set-Upstream Dialog — Design Spec

**Date:** 2026-03-15
**Status:** Approved (revised)

---

## Problem

When pushing a branch with no remote tracking counterpart, git rejects the push:

```
fatal: The current branch feat/mvp has no upstream branch.
To push the current branch and set the remote as upstream, use

    git push --set-upstream origin feat/mvp
```

The app currently surfaces this as a raw error string. The desired UX: detect this specific error, parse the suggested remedy from git's own output, and show a dialog asking the user if they want to proceed with `--set-upstream`.

---

## Approach: Optimistic Push + Error Interception

Push runs normally. If git returns a "no upstream" error, the app parses it and shows a recovery dialog. This is superior to pre-checking because:

- No extra IPC round-trip (no `branch.list()` call before every push)
- Git's own error output contains the exact remote and branch to use — no guessing
- Handles all edge cases uniformly (detached HEAD, missing tracking, IPC race conditions)
- Works identically for normal push and force push

---

## Error Parsing

The sentinel string to detect: `"has no upstream branch"` in the error message (present in all git versions).

Git also embeds the suggested command in the error:

```
git push --set-upstream origin feat/mvp
```

Parse remote and branch from this line with a regex:

```typescript
const match = errorMessage.match(/git push --set-upstream (\S+) (\S+)/);
// match[1] = remote (e.g. "origin")
// match[2] = branch (e.g. "feat/mvp")
```

If the regex does not match (unusual git version / locale), fall back to `remote = "origin"` and `branch = repo.currentBranch`.

---

## Data Flow

```
User clicks Push (or Force Push confirms)
  → await window.electronAPI.remote.push(remote?, branch?, force?)
  → on success: await Promise.all([refreshInfo(), refreshStatus(), loadGraph()])

  → on error:
      if error contains "has no upstream branch":
        parse suggestedRemote and suggestedBranch from error
        setSetUpstreamError({ suggestedRemote, suggestedBranch, force })
        (do NOT show raw error — suppress it)
      else:
        show raw error as today (toast / inline error)

SetUpstreamDialog open:
  → on mount: await window.electronAPI.remote.list() → RemoteInfo[].map(r => r.name)
      success + non-empty → populate select, pre-select suggestedRemote (or "origin", or first)
      success + empty OR failure → inline error, confirm disabled
  → user may change remote from select
  → on confirm:
      await window.electronAPI.remote.push(selectedRemote, suggestedBranch, force ?? false, true)
      success → await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]); onClose()
      failure → DialogError inside dialog (dialog stays open)
  → on cancel: onClose(), no push
```

---

## Toolbar State Machine

New state:
```typescript
const [setUpstreamError, setSetUpstreamError] = useState<{
  suggestedRemote: string;
  suggestedBranch: string;
  force: boolean;
} | null>(null);
```

Push handler (normal):
```typescript
onClick: async () => {
  try {
    await window.electronAPI.remote.push();
    await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("has no upstream branch")) {
      const match = msg.match(/git push --set-upstream (\S+) (\S+)/);
      setSetUpstreamError({
        suggestedRemote: match?.[1] ?? "origin",
        suggestedBranch: match?.[2] ?? (repo?.currentBranch ?? ""),
        force: false,
      });
    } else {
      // pre-existing error handling
    }
  }
}
```

Force Push: same pattern — `force: true` in the error state. The force-confirm dialog fires first (existing behaviour), then the push attempt, then the same error interception.

Existing states (`forcePushConfirm`) remain unchanged. `setUpstreamError` is mutually exclusive with the normal push error path.

The existing `ForcePushConfirmDialog` stays inline in `Toolbar.tsx` — no extraction.

---

## Components

### New: `SetUpstreamDialog.tsx`

Location: `src/renderer/components/dialogs/SetUpstreamDialog.tsx`

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  suggestedRemote: string;
  suggestedBranch: string;
  force?: boolean;
}
```

- On mount: calls `window.electronAPI.remote.list()`:
  - success + non-empty → populate select, pre-select `suggestedRemote` (fallback: first entry)
  - success + empty OR failure → inline error, confirm disabled
- `force=true` variant: shows force-push warning banner (same text as existing `Toolbar.tsx` ~line 573–574)
- Confirm button label: `"Push & Set Upstream"` (red if force, accent otherwise)
- On confirm: `remote.push(selectedRemote, suggestedBranch, force ?? false, true)`

UI layout:
```
Title: "Set Upstream & Push"

Branch: [badge: feat/mvp]   Remote: [select: origin ▼]

[force warning — only if force=true]

[Cancel]   [Push & Set Upstream]
```

### Modified: `Toolbar.tsx`

- Add `setUpstreamError` state
- Wrap existing push handlers in try/catch with error interception
- Add post-push refresh to normal push success path (currently fire-and-forget)
- Render:
```tsx
<SetUpstreamDialog
  open={!!setUpstreamError}
  onClose={() => setSetUpstreamError(null)}
  suggestedRemote={setUpstreamError?.suggestedRemote ?? "origin"}
  suggestedBranch={setUpstreamError?.suggestedBranch ?? ""}
  force={setUpstreamError?.force}
/>
```

### Modified: `gitService.push()`

```typescript
async push(
  remote?: string,
  branch?: string,
  force = false,
  setUpstream = false
): Promise<void> {
  const git = this.ensureRepo();
  const r = remote || "origin";
  const flags: string[] = [];
  if (force) flags.push("--force");
  if (setUpstream) flags.push("--set-upstream");

  // Use git.raw() for reliable flag passthrough (same pattern as cherry-pick).
  const args = ["push", ...flags, r, ...(branch ? [branch] : [])];
  await this.run("git push", [...flags, r, branch || ""], () => git.raw(args));
}
```

`pushTag()` is separate and unchanged.

### Modified: `src/preload/index.ts`

```typescript
push: (
  remote?: string,
  branch?: string,
  force?: boolean,
  setUpstream?: boolean
): Promise<void> =>
  ipcRenderer.invoke(IPC.REMOTE.PUSH, remote, branch, force, setUpstream),
```

### Modified: `src/main/ipc/git-remote.ipc.ts`

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

No changes to `ipc-channels.ts`.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Push succeeds | Refresh info+status+graph; no dialog |
| "no upstream branch" error | Parse remote+branch from git message; open `SetUpstreamDialog` |
| Error message unparseable (locale/version) | Fallback to `"origin"` + `repo.currentBranch` |
| No remotes configured | `remote.list()` returns empty → inline error, confirm disabled |
| `remote.list()` throws | Same as empty → inline error, confirm disabled |
| suggestedRemote not in list | Pre-select first entry instead |
| Other push errors | Shown as raw error (existing behaviour, out of scope) |
| Force + no upstream | Force confirm dialog first, then push attempt, then error interception with `force=true` |
| User cancels dialog | No push; `setUpstreamError` reset to null |
| Set-upstream push succeeds | Refresh + close dialog |
| Set-upstream push fails | `DialogError` inside dialog; stays open |

---

## Files Changed

| File | Change |
|---|---|
| `src/renderer/components/dialogs/SetUpstreamDialog.tsx` | **New** |
| `src/renderer/components/layout/Toolbar.tsx` | `setUpstreamError` state, try/catch push handlers, dialog render, normal push refresh |
| `src/main/git/git-service.ts` | Add `setUpstream` param, switch to `git.raw()`. `pushTag()` unchanged. |
| `src/preload/index.ts` | Add `setUpstream` param |
| `src/main/ipc/git-remote.ipc.ts` | Add `setUpstream` param |

No new IPC channels.

---

## Testing

### `gitService.push()` — unit

Mock `git.raw`, assert args:

| Call | Expected raw args |
|---|---|
| `push("origin","main",false,true)` | `["push","--set-upstream","origin","main"]` |
| `push("origin","main",true,true)` | `["push","--force","--set-upstream","origin","main"]` |
| `push("origin","main",false,false)` | `["push","origin","main"]` |
| `push("origin","main",true,false)` | `["push","--force","origin","main"]` |

### IPC handler — unit

Mock `gitService.push`. Invoke handler with `setUpstream=true`. Assert forwarded correctly.

### `SetUpstreamDialog` — component

Mock store: `currentBranch="feat/mvp"`. Mock `remote.list()` and `remote.push()`.

| Scenario | Setup | Assertion |
|---|---|---|
| Empty remote list | `remote.list()` returns `[]` | Confirm disabled, error shown |
| `remote.list()` throws | rejects | Confirm disabled, error shown |
| suggestedRemote in list | list has `"origin"` | `"origin"` pre-selected |
| suggestedRemote absent | list has `["upstream"]` only | first entry pre-selected |
| Confirm (force=false) | select="origin" | `remote.push("origin","feat/mvp",false,true)` |
| Confirm (force=true) | select="origin" | `remote.push("origin","feat/mvp",true,true)` |

All existing push tests unchanged.
