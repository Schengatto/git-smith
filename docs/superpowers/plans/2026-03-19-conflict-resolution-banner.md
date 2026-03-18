# Conflict Resolution Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent banner to AppShell that shows conflict resolution status for merge/rebase/cherry-pick operations, with resolve/continue/abort actions.

**Architecture:** Extend `GitStatus` with operation detection, add missing backend abort/continue methods with IPC channels, and render a `ConflictBanner` component in AppShell that reads from the Zustand repo-store.

**Tech Stack:** Electron IPC, simple-git, React 18, Zustand, Vitest, inline styles with Catppuccin CSS variables.

**Spec:** `docs/superpowers/specs/2026-03-18-conflict-resolution-banner-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/git-types.ts` | Modify | Add `GitOperation` type, extend `GitStatus` with `operationInProgress` and `rebaseStep` |
| `src/main/git/git-service.ts` | Modify | Extend `getStatus()` detection, add `mergeAbort()`, `mergeContinue()`, `cherryPickAbort()`, `cherryPickContinue()` |
| `src/main/git/git-service-conflict-ops.test.ts` | Create | Tests for new abort/continue methods and extended status detection |
| `src/shared/ipc-channels.ts` | Modify | Add 4 new IPC channels |
| `src/main/ipc/git-branch.ipc.ts` | Modify | Register 4 new IPC handlers |
| `src/preload/index.ts` | Modify | Expose 4 new branch methods |
| `src/renderer/components/layout/ConflictBanner.tsx` | Create | The banner component |
| `src/renderer/components/layout/ConflictBanner.test.tsx` | Create | Tests for the banner |
| `src/renderer/components/layout/AppShell.tsx` | Modify | Render `ConflictBanner` between Toolbar and content |

---

## Task 1: Extend GitStatus types

**Files:**
- Modify: `src/shared/git-types.ts:11-19` (GitStatus interface)

- [ ] **Step 1: Add GitOperation type and extend GitStatus**

In `src/shared/git-types.ts`, add before the GitStatus interface:

```typescript
export type GitOperation = 'merge' | 'rebase' | 'cherry-pick' | null;
```

Add two new fields to the `GitStatus` interface:

```typescript
export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
  /** @deprecated Use operationInProgress === 'merge' instead */
  mergeInProgress: boolean;
  conflicted: ConflictFile[];
  /** Which git operation is currently in progress */
  operationInProgress: GitOperation;
  /** Rebase step progress (only set when operationInProgress === 'rebase') */
  rebaseStep?: { current: number; total: number };
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in `git-service.ts` because `getStatus()` doesn't return the new fields yet. Note them for Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/shared/git-types.ts
git commit -m "feat(types): add GitOperation type and extend GitStatus for conflict banner"
```

---

## Task 2: Extend getStatus() with operation detection

**Files:**
- Modify: `src/main/git/git-service.ts:242-307` (getStatus method)
- Test: `src/main/git/git-service-conflict-ops.test.ts` (create)

- [ ] **Step 1: Write failing tests for operation detection**

Create `src/main/git/git-service-conflict-ops.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock simple-git
vi.mock("simple-git", () => ({
  default: vi.fn(() => ({
    status: vi.fn().mockResolvedValue({
      staged: [],
      files: [],
      not_added: [],
      conflicted: [],
    }),
    diff: vi.fn().mockResolvedValue(""),
    raw: vi.fn().mockResolvedValue(""),
  })),
}));

// Mock fs for sentinel file checks
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue(""),
    },
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
  };
});

import { GitService } from "./git-service";

describe("getStatus() operation detection", () => {
  let service: GitService;
  const repoPath = "/fake/repo";

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as { repoPath: string }).repoPath = repoPath;
    const simpleGit = await import("simple-git");
    (service as unknown as { git: unknown }).git = simpleGit.default();
  });

  it("should detect merge in progress", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      p === path.join(repoPath, ".git", "MERGE_HEAD")
    );

    const status = await service.getStatus();

    expect(status.operationInProgress).toBe("merge");
    expect(status.mergeInProgress).toBe(true);
  });

  it("should detect interactive rebase in progress with step info", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      p === path.join(repoPath, ".git", "rebase-merge")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p: string) => {
      if (String(p).includes("msgnum")) return "3\n";
      if (String(p).includes("end")) return "7\n";
      return "";
    });

    const status = await service.getStatus();

    expect(status.operationInProgress).toBe("rebase");
    expect(status.rebaseStep).toEqual({ current: 3, total: 7 });
  });

  it("should detect non-interactive rebase with step info", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      p === path.join(repoPath, ".git", "rebase-apply")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p: string) => {
      if (String(p).includes("next")) return "2\n";
      if (String(p).includes("last")) return "5\n";
      return "";
    });

    const status = await service.getStatus();

    expect(status.operationInProgress).toBe("rebase");
    expect(status.rebaseStep).toEqual({ current: 2, total: 5 });
  });

  it("should detect cherry-pick in progress", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      p === path.join(repoPath, ".git", "CHERRY_PICK_HEAD")
    );

    const status = await service.getStatus();

    expect(status.operationInProgress).toBe("cherry-pick");
  });

  it("should return null when no operation in progress", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const status = await service.getStatus();

    expect(status.operationInProgress).toBeNull();
    expect(status.mergeInProgress).toBe(false);
  });

  it("should detect conflicted files during rebase (not just merge)", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      p === path.join(repoPath, ".git", "rebase-merge")
    );
    // Mock simple-git status to return conflicted files
    const mockGit = (service as unknown as { git: { status: ReturnType<typeof vi.fn> } }).git;
    mockGit.status.mockResolvedValue({
      staged: [],
      files: [],
      not_added: [],
      conflicted: ["file1.ts", "file2.ts"],
    });

    const status = await service.getStatus();

    expect(status.conflicted.length).toBe(2);
    expect(status.operationInProgress).toBe("rebase");
  });
});
```

> **Note:** These tests mock `fs.existsSync` and `simple-git`. The exact mock setup may need adjustment to match how GitService initializes. Adapt the `beforeEach` to properly initialize the service with mocked dependencies. The key assertions are what matters.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/git-service-conflict-ops.test.ts`
Expected: FAIL — `operationInProgress` is not returned by `getStatus()`.

- [ ] **Step 3: Extend getStatus() implementation**

In `src/main/git/git-service.ts`, modify `getStatus()` (around line 275-305):

1. **Remove the `if (mergeInProgress)` guard** on conflicted file detection so conflicts are always detected:

```typescript
// BEFORE (line ~282):
if (mergeInProgress) {
  for (const f of status.conflicted) { ... }
}

// AFTER:
for (const f of status.conflicted) {
  conflicted.push({ path: f, reason: "both-modified" });
}
```

> If the existing code does more detailed conflict reason detection via `git status --porcelain`, keep that logic but remove only the `if (mergeInProgress)` wrapper.

2. **Add operation detection** after the existing `mergeInProgress` check:

```typescript
// Detect operation in progress
const mergeInProgress = this.repoPath
  ? fs.existsSync(path.join(this.repoPath, ".git", "MERGE_HEAD"))
  : false;

const rebaseMerge = this.repoPath && fs.existsSync(path.join(this.repoPath, ".git", "rebase-merge"));
const rebaseApply = this.repoPath && fs.existsSync(path.join(this.repoPath, ".git", "rebase-apply"));
const cherryPickInProgress = this.repoPath
  ? fs.existsSync(path.join(this.repoPath, ".git", "CHERRY_PICK_HEAD"))
  : false;

let operationInProgress: import("../../shared/git-types").GitOperation = null;
let rebaseStep: { current: number; total: number } | undefined;

if (mergeInProgress) {
  operationInProgress = "merge";
} else if (rebaseMerge || rebaseApply) {
  operationInProgress = "rebase";
  try {
    if (rebaseMerge) {
      const current = parseInt(fs.readFileSync(path.join(this.repoPath!, ".git", "rebase-merge", "msgnum"), "utf-8").trim(), 10);
      const total = parseInt(fs.readFileSync(path.join(this.repoPath!, ".git", "rebase-merge", "end"), "utf-8").trim(), 10);
      rebaseStep = { current, total };
    } else {
      const current = parseInt(fs.readFileSync(path.join(this.repoPath!, ".git", "rebase-apply", "next"), "utf-8").trim(), 10);
      const total = parseInt(fs.readFileSync(path.join(this.repoPath!, ".git", "rebase-apply", "last"), "utf-8").trim(), 10);
      rebaseStep = { current, total };
    }
  } catch {
    // Step info files may not exist; that's fine
  }
} else if (cherryPickInProgress) {
  operationInProgress = "cherry-pick";
}
```

3. **Add new fields to the return object:**

```typescript
return {
  staged,
  unstaged,
  untracked: status.not_added,
  mergeInProgress,
  conflicted,
  operationInProgress,
  rebaseStep,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/git-service-conflict-ops.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass (369+).

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/git/git-service.ts src/main/git/git-service-conflict-ops.test.ts
git commit -m "feat(git): extend getStatus with operation detection and fix conflict gating"
```

---

## Task 3: Add backend abort/continue methods

**Files:**
- Modify: `src/main/git/git-service.ts` (add 4 methods near existing rebaseAbort at line ~790)
- Test: `src/main/git/git-service-conflict-ops.test.ts` (extend)

- [ ] **Step 1: Write failing tests for new methods**

Add to `src/main/git/git-service-conflict-ops.test.ts`:

```typescript
describe("abort/continue methods", () => {
  it("should call git merge --abort", async () => {
    const mockGit = (service as unknown as { git: { raw: ReturnType<typeof vi.fn> } }).git;
    mockGit.raw.mockResolvedValue("");

    await service.mergeAbort();

    expect(mockGit.raw).toHaveBeenCalledWith(["merge", "--abort"]);
  });

  it("should call git commit for mergeContinue (reads MERGE_MSG)", async () => {
    const mockGit = (service as unknown as { git: { commit: ReturnType<typeof vi.fn> } }).git;
    mockGit.commit.mockResolvedValue({});
    vi.mocked(fs.readFileSync).mockReturnValue("Merge branch 'feature'\n");

    await service.mergeContinue();

    // Should commit with the merge message
    expect(mockGit.commit).toHaveBeenCalled();
  });

  it("should call git cherry-pick --abort", async () => {
    const mockGit = (service as unknown as { git: { raw: ReturnType<typeof vi.fn> } }).git;
    mockGit.raw.mockResolvedValue("");

    await service.cherryPickAbort();

    expect(mockGit.raw).toHaveBeenCalledWith(["cherry-pick", "--abort"]);
  });

  it("should call git cherry-pick --continue", async () => {
    const mockGit = (service as unknown as { git: { raw: ReturnType<typeof vi.fn> } }).git;
    mockGit.raw.mockResolvedValue("");

    await service.cherryPickContinue();

    expect(mockGit.raw).toHaveBeenCalledWith(["cherry-pick", "--continue"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/git-service-conflict-ops.test.ts`
Expected: FAIL — methods don't exist.

- [ ] **Step 3: Implement the 4 new methods**

Add to `src/main/git/git-service.ts` near the existing `rebaseAbort()` method (~line 790):

```typescript
async mergeAbort(): Promise<void> {
  const git = this.ensureRepo();
  await this.run("git merge", ["--abort"], () => git.raw(["merge", "--abort"]));
}

async mergeContinue(): Promise<void> {
  const git = this.ensureRepo();
  // Read the auto-generated merge message
  const mergeMsgPath = path.join(this.repoPath!, ".git", "MERGE_MSG");
  let message = "Merge commit";
  try {
    message = fs.readFileSync(mergeMsgPath, "utf-8").trim();
  } catch {
    // Fallback to default message
  }
  await this.run("git commit", [message], () => git.commit(message));
}

async cherryPickAbort(): Promise<void> {
  const git = this.ensureRepo();
  await this.run("git cherry-pick", ["--abort"], () =>
    git.raw(["cherry-pick", "--abort"])
  );
}

async cherryPickContinue(): Promise<void> {
  const git = this.ensureRepo();
  await this.run("git cherry-pick", ["--continue"], () =>
    git.raw(["cherry-pick", "--continue"])
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/git-service-conflict-ops.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/git/git-service.ts src/main/git/git-service-conflict-ops.test.ts
git commit -m "feat(git): add mergeAbort, mergeContinue, cherryPickAbort, cherryPickContinue methods"
```

---

## Task 4: Add IPC channels, handlers, and preload exposure

**Files:**
- Modify: `src/shared/ipc-channels.ts:46-68` (BRANCH section)
- Modify: `src/main/ipc/git-branch.ipc.ts` (add 4 handlers)
- Modify: `src/preload/index.ts:111-156` (branch section)

- [ ] **Step 1: Add IPC channels**

In `src/shared/ipc-channels.ts`, add to the `BRANCH` object (after the existing `CHERRY_PICK` line):

```typescript
MERGE_ABORT: "git:branch:merge-abort",
MERGE_CONTINUE: "git:branch:merge-continue",
CHERRY_PICK_ABORT: "git:branch:cherry-pick-abort",
CHERRY_PICK_CONTINUE: "git:branch:cherry-pick-continue",
```

- [ ] **Step 2: Register IPC handlers**

In `src/main/ipc/git-branch.ipc.ts`, add after the existing cherry-pick handler:

```typescript
ipcMain.handle(IPC.BRANCH.MERGE_ABORT, async () => {
  await gitService.mergeAbort();
});

ipcMain.handle(IPC.BRANCH.MERGE_CONTINUE, async () => {
  await gitService.mergeContinue();
});

ipcMain.handle(IPC.BRANCH.CHERRY_PICK_ABORT, async () => {
  await gitService.cherryPickAbort();
});

ipcMain.handle(IPC.BRANCH.CHERRY_PICK_CONTINUE, async () => {
  await gitService.cherryPickContinue();
});
```

- [ ] **Step 3: Expose in preload**

In `src/preload/index.ts`, add to the `branch` section:

```typescript
mergeAbort: (): Promise<void> =>
  ipcRenderer.invoke(IPC.BRANCH.MERGE_ABORT),
mergeContinue: (): Promise<void> =>
  ipcRenderer.invoke(IPC.BRANCH.MERGE_CONTINUE),
cherryPickAbort: (): Promise<void> =>
  ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK_ABORT),
cherryPickContinue: (): Promise<void> =>
  ipcRenderer.invoke(IPC.BRANCH.CHERRY_PICK_CONTINUE),
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc-channels.ts src/main/ipc/git-branch.ipc.ts src/preload/index.ts
git commit -m "feat(ipc): add merge/cherry-pick abort and continue IPC channels"
```

---

## Task 5: ConflictBanner component with tests

**Files:**
- Create: `src/renderer/components/layout/ConflictBanner.test.tsx`
- Create: `src/renderer/components/layout/ConflictBanner.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/layout/ConflictBanner.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConflictBanner } from "./ConflictBanner";
import type { GitStatus } from "../../../shared/git-types";

// Mock electronAPI
const mockElectronAPI = {
  branch: {
    mergeAbort: vi.fn().mockResolvedValue(undefined),
    mergeContinue: vi.fn().mockResolvedValue(undefined),
    rebaseAbort: vi.fn().mockResolvedValue(undefined),
    rebaseContinue: vi.fn().mockResolvedValue(undefined),
    rebaseSkip: vi.fn().mockResolvedValue(undefined),
    cherryPickAbort: vi.fn().mockResolvedValue(undefined),
    cherryPickContinue: vi.fn().mockResolvedValue(undefined),
  },
};

vi.stubGlobal("window", {
  ...window,
  electronAPI: mockElectronAPI,
});

// Mock openDialogWindow
vi.mock("../../utils/open-dialog", () => ({
  openDialogWindow: vi.fn(),
}));

// Mock repo-store
const mockRefreshStatus = vi.fn();
const mockRefreshInfo = vi.fn();
vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(vi.fn(), {
    getState: () => ({ refreshStatus: mockRefreshStatus, refreshInfo: mockRefreshInfo }),
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(vi.fn(), {
    getState: () => ({ loadGraph: vi.fn() }),
  }),
}));

function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    staged: [],
    unstaged: [],
    untracked: [],
    mergeInProgress: false,
    conflicted: [],
    operationInProgress: null,
    ...overrides,
  };
}

describe("ConflictBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when no operation in progress", () => {
    const { container } = render(
      <ConflictBanner status={makeStatus()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render merge conflict banner with count", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/Merge in progress/)).toBeTruthy();
    expect(screen.getByText(/0\/2 conflicts resolved/)).toBeTruthy();
    expect(screen.getByText("Resolve Conflicts")).toBeTruthy();
    expect(screen.getByText("Abort Merge")).toBeTruthy();
  });

  it("should render rebase banner with step info", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 3, total: 7 },
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );
    expect(screen.getByText(/Rebase in progress \(step 3\/7\)/)).toBeTruthy();
    expect(screen.getByText("Skip Commit")).toBeTruthy();
  });

  it("should render cherry-pick banner", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "cherry-pick",
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );
    expect(screen.getByText(/Cherry-pick in progress/)).toBeTruthy();
    expect(screen.getByText("Abort Cherry-pick")).toBeTruthy();
  });

  it("should show green state when all conflicts resolved", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [],
        })}
      />
    );
    expect(screen.getByText(/All conflicts resolved/)).toBeTruthy();
    expect(screen.getByText("Continue Merge")).toBeTruthy();
  });

  it("should call mergeAbort on abort click with confirmation", () => {
    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );

    fireEvent.click(screen.getByText("Abort Merge"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockElectronAPI.branch.mergeAbort).toHaveBeenCalled();
  });

  it("should not abort when confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );

    fireEvent.click(screen.getByText("Abort Merge"));
    expect(mockElectronAPI.branch.mergeAbort).not.toHaveBeenCalled();
  });

  it("should reset progress counter when rebase step changes", () => {
    const { rerender } = render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 1, total: 3 },
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/0\/2 conflicts resolved/)).toBeTruthy();

    // Resolve one conflict
    rerender(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 1, total: 3 },
          conflicted: [{ path: "b.ts", reason: "both-modified" }],
        })}
      />
    );
    expect(screen.getByText(/1\/2 conflicts resolved/)).toBeTruthy();

    // Move to next rebase step — total should reset
    rerender(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 2, total: 3 },
          conflicted: [
            { path: "c.ts", reason: "both-modified" },
            { path: "d.ts", reason: "both-modified" },
            { path: "e.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/0\/3 conflicts resolved/)).toBeTruthy();
  });

  it("should call mergeContinue on continue click", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [],
        })}
      />
    );

    fireEvent.click(screen.getByText("Continue Merge"));
    expect(mockElectronAPI.branch.mergeContinue).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/layout/ConflictBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ConflictBanner component**

Create `src/renderer/components/layout/ConflictBanner.tsx`:

```typescript
import React, { useRef, useEffect } from "react";
import type { GitStatus, GitOperation } from "../../../shared/git-types";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { openDialogWindow } from "../../utils/open-dialog";
// ^ Verify this import path matches the actual codebase utility

interface ConflictBannerProps {
  status: GitStatus;
}

const operationLabels: Record<Exclude<GitOperation, null>, string> = {
  merge: "Merge",
  rebase: "Rebase",
  "cherry-pick": "Cherry-pick",
};

export function ConflictBanner({ status }: ConflictBannerProps) {
  const { operationInProgress, conflicted, rebaseStep } = status;
  const totalRef = useRef(0);
  const lastRebaseStep = useRef<number | undefined>(undefined);

  // Track total conflicts (reset on rebase step change)
  useEffect(() => {
    if (!operationInProgress) {
      totalRef.current = 0;
      return;
    }
    // Reset total when rebase step changes
    if (rebaseStep?.current !== lastRebaseStep.current) {
      totalRef.current = 0;
      lastRebaseStep.current = rebaseStep?.current;
    }
    if (conflicted.length > totalRef.current) {
      totalRef.current = conflicted.length;
    }
  }, [operationInProgress, conflicted.length, rebaseStep?.current]);

  if (!operationInProgress) return null;

  const allResolved = conflicted.length === 0;
  const total = totalRef.current;
  const resolved = total - conflicted.length;
  const label = operationLabels[operationInProgress];

  const refreshAfterAction = async () => {
    await useRepoStore.getState().refreshStatus();
    await useRepoStore.getState().refreshInfo();
    useGraphStore.getState().loadGraph();
  };

  const handleResolve = () => {
    // Uses openDialogWindow() from src/renderer/utils/open-dialog.ts
    // Adapt to match the actual utility function signature in the codebase
    openDialogWindow({ dialog: "MergeConflictDialog" });
  };

  const handleAbort = async () => {
    if (!window.confirm(`Are you sure you want to abort this ${label.toLowerCase()}?`)) return;
    try {
      if (operationInProgress === "merge") await window.electronAPI.branch.mergeAbort();
      else if (operationInProgress === "rebase") await window.electronAPI.branch.rebaseAbort();
      else if (operationInProgress === "cherry-pick") await window.electronAPI.branch.cherryPickAbort();
      await refreshAfterAction();
    } catch (err) {
      console.error(`Failed to abort ${label}:`, err);
    }
  };

  const handleContinue = async () => {
    try {
      if (operationInProgress === "merge") await window.electronAPI.branch.mergeContinue();
      else if (operationInProgress === "rebase") await window.electronAPI.branch.rebaseContinue();
      else if (operationInProgress === "cherry-pick") await window.electronAPI.branch.cherryPickContinue();
      await refreshAfterAction();
    } catch (err) {
      console.error(`Failed to continue ${label}:`, err);
    }
  };

  const handleSkip = async () => {
    try {
      await window.electronAPI.branch.rebaseSkip();
      await refreshAfterAction();
    } catch (err) {
      console.error("Failed to skip commit:", err);
    }
  };

  // Build status text
  let statusText = `${label} in progress`;
  if (operationInProgress === "rebase" && rebaseStep) {
    statusText += ` (step ${rebaseStep.current}/${rebaseStep.total})`;
  }
  if (!allResolved && total > 0) {
    statusText += ` — ${resolved}/${total} conflicts resolved`;
  }

  const bgColor = allResolved
    ? "rgba(var(--green-rgb, 80, 200, 120), 0.12)"
    : "rgba(var(--red-rgb, 210, 80, 80), 0.12)";
  const borderColor = allResolved ? "var(--green)" : "var(--red)";
  const accentColor = allResolved ? "var(--green)" : "var(--red)";

  const buttonStyle: React.CSSProperties = {
    padding: "4px 12px",
    fontSize: 12,
    borderRadius: 4,
    border: `1px solid ${accentColor}`,
    background: "transparent",
    color: accentColor,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: accentColor,
    color: "var(--base)",
    fontWeight: 600,
  };

  return (
    <div
      style={{
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}
    >
      {/* Icon */}
      {allResolved ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}

      {/* Status text */}
      <span
        style={{
          fontSize: 12,
          color: accentColor,
          fontWeight: 600,
          flex: 1,
        }}
      >
        {allResolved ? "All conflicts resolved" : statusText}
      </span>

      {/* Action buttons */}
      {allResolved ? (
        <>
          <button style={primaryButtonStyle} onClick={handleContinue}>
            Continue {label}
          </button>
          <button style={buttonStyle} onClick={handleAbort}>
            Abort
          </button>
        </>
      ) : (
        <>
          <button style={primaryButtonStyle} onClick={handleResolve}>
            Resolve Conflicts
          </button>
          {operationInProgress === "rebase" && (
            <button style={buttonStyle} onClick={handleSkip}>
              Skip Commit
            </button>
          )}
          <button style={buttonStyle} onClick={handleAbort}>
            Abort {label}
          </button>
        </>
      )}
    </div>
  );
}
```

> **Note on dialog opening:** The component uses `openDialogWindow()` from `src/renderer/utils/open-dialog.ts`. Verify the import path and function signature match the actual codebase utility (check how MergeConflictDialog is opened in CommitDialog).

> **Note on error handling:** The `catch` blocks use `console.error` as a fallback. In practice, the backend `this.run()` method routes git output to `GitOperationLogDialog` automatically. If an abort/continue fails, the user sees the error in the operation log dialog. The `catch` here prevents unhandled promise rejections and triggers a refresh to keep the banner in sync.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/layout/ConflictBanner.test.tsx`
Expected: PASS (or adjust mocks as needed)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/layout/ConflictBanner.tsx src/renderer/components/layout/ConflictBanner.test.tsx
git commit -m "feat(ui): add ConflictBanner component with tests"
```

---

## Task 6: Wire ConflictBanner into AppShell

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx:1-29` (imports) and `304-340` (JSX)

- [ ] **Step 1: Import ConflictBanner in AppShell**

Add import in `src/renderer/components/layout/AppShell.tsx`:

```typescript
import { ConflictBanner } from "./ConflictBanner";
```

- [ ] **Step 2: Read status from store and render banner**

In the AppShell component, read status from the repo store (it may already be available via an existing `useRepoStore` call — check the component). Then render `ConflictBanner` between `<Toolbar />` and the main `<div className="flex-1 overflow-hidden">`:

```tsx
{repo && <Toolbar />}
{repo && status && <ConflictBanner status={status} />}
<div className="flex-1 overflow-hidden">
```

If `status` is not already destructured from the store, add it:

```typescript
const status = useRepoStore((s) => s.status);
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Manual smoke test**

Run: `npm start`
Verify: Open a repo, trigger a merge conflict (e.g., `git merge` a branch with conflicts). The banner should appear between the toolbar and the graph. Resolve conflicts and verify the green transition.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx
git commit -m "feat(ui): wire ConflictBanner into AppShell layout"
```
