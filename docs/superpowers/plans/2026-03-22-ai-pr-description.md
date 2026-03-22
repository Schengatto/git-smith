# AI-Assisted PR Description Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered title and body generation to the PrDialog Create tab, with branch dropdown autocomplete and PR template support.

**Architecture:** Main process handles data fetching (commits, diff, template) and AI calls. Renderer sends (sourceBranch, targetBranch) and receives generated text. Existing infrastructure reused: `McpAiClient`, `logRange.compare()`, `diffBranches.compare()`, `PrDialog.tsx`.

**Tech Stack:** TypeScript, Electron IPC, React, Zustand, simple-git, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-03-22-ai-pr-description-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/ipc-channels.ts` | Modify | Add `PR.GET_TEMPLATE`, `MCP.GENERATE_PR_TITLE` |
| `src/main/git/git-service.ts` | Modify | Add `getPrTemplate()` method |
| `src/main/mcp/mcp-client.ts` | Modify | Add `generatePrTitle()`, modify `generatePrDescription()` for template |
| `src/main/ipc/git-pr.ipc.ts` | Modify | Register `GET_TEMPLATE` handler |
| `src/main/ipc/mcp.ipc.ts` | Modify | Add `GENERATE_PR_TITLE` handler, rewrite `GENERATE_PR_DESCRIPTION` handler |
| `src/preload/index.ts` | Modify | Expose `pr.getTemplate()`, `mcp.generatePrTitle()`, update `mcp.generatePrDescription()` |
| `src/renderer/store/mcp-store.ts` | Modify | Add `generatePrTitle()`, update `generatePrDescription()` signature |
| `src/renderer/components/dialogs/PrDialog.tsx` | Modify | Branch dropdown, AI buttons, confirm, loading, errors |
| `src/main/git/git-service-comprehensive.test.ts` | Modify | Tests for `getPrTemplate()` |
| `src/main/mcp/mcp-client.test.ts` | Modify | Tests for `generatePrTitle()`, `generatePrDescription()` with template |
| `src/main/ipc/mcp.ipc.test.ts` | Modify | Tests for new/modified handlers, replace old commitHashes-based test |
| `src/renderer/store/mcp-store.test.ts` | Modify | Update `generatePrDescription` tests for new `(source, target)` signature |
| `src/renderer/components/dialogs/PrDialog.test.tsx` | Modify | Tests for AI buttons, dropdown, confirm dialog |

**Note on breaking change:** `generatePrDescription` changes from `(commitHashes: string[])` to `(source: string, target: string)`. This is safe — no UI component currently calls the old signature directly; only the store and its tests use it.

---

### Task 1: IPC Channels + GitService `getPrTemplate()`

**Files:**
- Modify: `src/shared/ipc-channels.ts:262-267`
- Modify: `src/main/git/git-service.ts` (add method near line 3162)
- Test: `src/main/git/git-service-comprehensive.test.ts`

- [ ] **Step 1: Add IPC channel constants**

In `src/shared/ipc-channels.ts`, add to the `PR` block:

```typescript
PR: {
  LIST: "git:pr:list",
  VIEW: "git:pr:view",
  CREATE: "git:pr:create",
  DETECT_PROVIDER: "git:pr:detect-provider",
  GET_TEMPLATE: "git:pr:get-template",       // NEW
},
```

And add to the `MCP` block:

```typescript
MCP: {
  // Server management
  SERVER_START: "mcp:server:start",
  SERVER_STOP: "mcp:server:stop",
  SERVER_STATUS: "mcp:server:status",
  // AI operations
  GENERATE_COMMIT_MESSAGE: "mcp:ai:generate-commit-message",
  SUGGEST_CONFLICT_RESOLUTION: "mcp:ai:suggest-conflict-resolution",
  GENERATE_PR_DESCRIPTION: "mcp:ai:generate-pr-description",
  GENERATE_PR_TITLE: "mcp:ai:generate-pr-title",  // NEW
  REVIEW_COMMIT: "mcp:ai:review-commit",
},
```

- [ ] **Step 2: Write failing tests for `getPrTemplate()`**

In `src/main/git/git-service-comprehensive.test.ts`, add after the existing PR-related tests:

```typescript
describe("GitService.getPrTemplate", () => {
  it("returns null when no template file exists", async () => {
    const service = makeService();
    mockRaw.mockRejectedValue(new Error("not found"));
    const result = await service.getPrTemplate();
    expect(result).toBeNull();
  });

  it("returns content of first matching template", async () => {
    const service = makeService();
    mockRaw.mockResolvedValueOnce("## Description\n\n## Changes\n");
    const result = await service.getPrTemplate();
    expect(result).toBe("## Description\n\n## Changes\n");
    expect(mockRaw).toHaveBeenCalledWith(["show", "HEAD:.github/pull_request_template.md"]);
  });

  it("skips whitespace-only template files", async () => {
    const service = makeService();
    // First candidate returns only whitespace
    mockRaw.mockResolvedValueOnce("   \n  ");
    // Second candidate returns real content
    mockRaw.mockResolvedValueOnce("## PR Template");
    const result = await service.getPrTemplate();
    expect(result).toBe("## PR Template");
  });

  it("finds template in directory pattern", async () => {
    const service = makeService();
    // All single-file candidates fail
    mockRaw.mockRejectedValueOnce(new Error("not found")); // .github/pull_request_template.md
    mockRaw.mockRejectedValueOnce(new Error("not found")); // .github/PULL_REQUEST_TEMPLATE.md
    // Directory ls-tree succeeds
    mockRaw.mockResolvedValueOnce("feature.md\nbugfix.md\n"); // ls-tree
    mockRaw.mockResolvedValueOnce("## Feature Template"); // show first file
    const result = await service.getPrTemplate();
    expect(result).toBe("## Feature Template");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/main/git/git-service-comprehensive.test.ts -t "getPrTemplate"`
Expected: FAIL — `getPrTemplate` is not a function

- [ ] **Step 4: Implement `getPrTemplate()` in GitService**

Add to `src/main/git/git-service.ts` after `createPr()` (around line 3162):

```typescript
/** Search for a PR template in standard locations (spec order). Returns content or null. */
async getPrTemplate(): Promise<string | null> {
  const git = this.ensureRepo();

  // 1-2. Check .github single-file candidates first
  for (const name of [
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
  ]) {
    try {
      const content = await git.raw(["show", `HEAD:${name}`]);
      if (content.trim()) return content;
    } catch { /* not found */ }
  }

  // 3. Check directory pattern: .github/PULL_REQUEST_TEMPLATE/*.md
  try {
    const lsOutput = await git.raw([
      "ls-tree", "--name-only", "HEAD", ".github/PULL_REQUEST_TEMPLATE/",
    ]);
    const files = lsOutput.trim().split("\n").filter((f) => f.endsWith(".md"));
    if (files.length > 0) {
      const content = await git.raw(["show", `HEAD:${files[0]}`]);
      if (content.trim()) return content;
    }
  } catch { /* directory doesn't exist */ }

  // 4-7. Check remaining single-file candidates
  for (const name of [
    "docs/pull_request_template.md",
    "docs/PULL_REQUEST_TEMPLATE.md",
    "pull_request_template.md",
    "PULL_REQUEST_TEMPLATE.md",
  ]) {
    try {
      const content = await git.raw(["show", `HEAD:${name}`]);
      if (content.trim()) return content;
    } catch { /* not found */ }
  }

  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/git/git-service-comprehensive.test.ts -t "getPrTemplate"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc-channels.ts src/main/git/git-service.ts src/main/git/git-service-comprehensive.test.ts
git commit -m "feat(pr): add IPC channels and getPrTemplate() method"
```

---

### Task 2: MCP Client — `generatePrTitle()` + template support for `generatePrDescription()`

**Files:**
- Modify: `src/main/mcp/mcp-client.ts:61-85`
- Test: `src/main/mcp/mcp-client.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/main/mcp/mcp-client.test.ts`:

```typescript
it("generatePrTitle calls AI with commits and truncated diff", async () => {
  vi.mocked(getSettings).mockReturnValue(mockSettings as never);
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ content: [{ text: "feat: add user auth" }] }),
  });
  vi.stubGlobal("fetch", mockFetch);

  const commits = [
    { abbreviatedHash: "abc1234", subject: "add login", hash: "", body: "", authorName: "", authorEmail: "", authorDate: "", committerDate: "", parentHashes: [], refs: [] },
  ];
  const result = await client.generatePrTitle(commits as never[], "diff content");
  expect(result).toBe("feat: add user auth");

  const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
  expect(body.messages[0].content).toContain("abc1234 add login");
  expect(body.messages[0].content).toContain("max 70 characters");
});

it("generatePrDescription uses template when provided", async () => {
  vi.mocked(getSettings).mockReturnValue(mockSettings as never);
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ content: [{ text: "PR body with template" }] }),
  });
  vi.stubGlobal("fetch", mockFetch);

  const commits = [
    { abbreviatedHash: "def5678", subject: "fix bug", hash: "", body: "", authorName: "", authorEmail: "", authorDate: "", committerDate: "", parentHashes: [], refs: [] },
  ];
  const template = "## What\n\n## Why\n\n## How\n";
  const result = await client.generatePrDescription(commits as never[], "diff", template);
  expect(result).toBe("PR body with template");

  const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
  expect(body.messages[0].content).toContain("Follow this template structure");
  expect(body.messages[0].content).toContain("## What");
});

it("generatePrDescription uses default format without template", async () => {
  vi.mocked(getSettings).mockReturnValue(mockSettings as never);
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ content: [{ text: "PR body default" }] }),
  });
  vi.stubGlobal("fetch", mockFetch);

  const commits = [
    { abbreviatedHash: "ghi9012", subject: "refactor", hash: "", body: "", authorName: "", authorEmail: "", authorDate: "", committerDate: "", parentHashes: [], refs: [] },
  ];
  const result = await client.generatePrDescription(commits as never[], "diff");
  expect(result).toBe("PR body default");

  const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
  expect(body.messages[0].content).toContain("## Summary");
  expect(body.messages[0].content).not.toContain("Follow this template");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/mcp/mcp-client.test.ts`
Expected: FAIL — `generatePrTitle` is not a function, `generatePrDescription` signature mismatch

- [ ] **Step 3: Implement changes in `mcp-client.ts`**

Add `generatePrTitle()` method after `generateCommitMessage()` (around line 30):

```typescript
/**
 * Generate a concise PR title from commits and diff.
 */
async generatePrTitle(commits: CommitInfo[], diff: string): Promise<string> {
  const commitLog = commits
    .map((c) => `- ${c.abbreviatedHash} ${c.subject}`)
    .join("\n");

  const prompt = `You are a PR title generator. Generate a concise pull request title (max 70 characters) in conventional commit style (e.g. "feat: add user authentication").

Commits:
${commitLog}

Diff summary (truncated):
${diff.slice(0, 4000)}

Return ONLY the title, no quotes, no explanation.`;

  return this.callAi(prompt);
}
```

Modify `generatePrDescription()` to accept optional template (line 61):

```typescript
/**
 * Generate a PR description from commits and diff, optionally following a template.
 */
async generatePrDescription(
  commits: CommitInfo[],
  diff: string,
  template?: string | null
): Promise<string> {
  const commitLog = commits
    .map((c) => `- ${c.abbreviatedHash} ${c.subject}`)
    .join("\n");

  const formatInstruction = template
    ? `Follow this template structure:\n${template}`
    : `Use this format:
## Summary
<1-3 bullet points>

## Changes
<detailed list of changes>

## Test plan
<suggested testing steps>`;

  const prompt = `You are a PR description generator. Generate a clear, structured PR description.

${formatInstruction}

Commits:
${commitLog}

Diff summary (truncated):
${diff.slice(0, 6000)}

Return ONLY the description body, no title.`;

  return this.callAi(prompt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/mcp/mcp-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/mcp/mcp-client.ts src/main/mcp/mcp-client.test.ts
git commit -m "feat(pr): add generatePrTitle() and template support in generatePrDescription()"
```

---

### Task 3: IPC Handlers — Register `GENERATE_PR_TITLE` + rewrite `GENERATE_PR_DESCRIPTION`

**Files:**
- Modify: `src/main/ipc/git-pr.ipc.ts`
- Modify: `src/main/ipc/mcp.ipc.ts:53-72`
- Test: `src/main/ipc/mcp.ipc.test.ts`

- [ ] **Step 1: Write failing tests**

Add mocks for new git-service methods in `src/main/ipc/mcp.ipc.test.ts` mock setup (around line 7):

```typescript
const mockLogRange = vi.fn();
const mockDiffBranches = vi.fn();
const mockGetPrTemplate = vi.fn();
```

Add these to the `gitService` mock object (around line 17):

```typescript
logRange: (...args: unknown[]) => mockLogRange(...args),
diffBranches: (...args: unknown[]) => mockDiffBranches(...args),
getPrTemplate: (...args: unknown[]) => mockGetPrTemplate(...args),
```

Add a mock for `generatePrTitle` in the `McpAiClient` mock class (around line 48):

```typescript
generatePrTitle(...args: unknown[]) {
  return mockGeneratePrTitle(...args);
}
```

And define the mock (around line 43):

```typescript
const mockGeneratePrTitle = vi.fn();
```

Add tests:

```typescript
it("registers GENERATE_PR_TITLE channel", () => {
  const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
  expect(channels).toContain(IPC.MCP.GENERATE_PR_TITLE);
});

it("MCP.GENERATE_PR_TITLE resolves commits/diff and calls AI", async () => {
  const commits = [{ abbreviatedHash: "abc", subject: "feat" }];
  const diffResult = { files: [], stats: { additions: 10, deletions: 5, filesChanged: 2 } };
  mockLogRange.mockResolvedValueOnce(commits);
  mockDiffBranches.mockResolvedValueOnce(diffResult);
  mockGeneratePrTitle.mockResolvedValueOnce("feat: new feature");

  const handler = getHandler(IPC.MCP.GENERATE_PR_TITLE);
  const result = await handler({}, "feature-branch", "main");

  expect(mockLogRange).toHaveBeenCalledWith("main", "feature-branch");
  expect(mockDiffBranches).toHaveBeenCalledWith("main", "feature-branch");
  expect(mockGeneratePrTitle).toHaveBeenCalledWith(commits, expect.any(String));
  expect(result).toBe("feat: new feature");
});

it("MCP.GENERATE_PR_TITLE returns empty when no commits", async () => {
  mockLogRange.mockResolvedValueOnce([]);
  mockDiffBranches.mockResolvedValueOnce({ files: [], stats: { additions: 0, deletions: 0, filesChanged: 0 } });

  const handler = getHandler(IPC.MCP.GENERATE_PR_TITLE);
  const result = await handler({}, "feature-branch", "main");

  expect(result).toBe("");
  expect(mockGeneratePrTitle).not.toHaveBeenCalled();
});

it("MCP.GENERATE_PR_DESCRIPTION (branch-based) resolves commits/diff/template and calls AI", async () => {
  const commits = [{ abbreviatedHash: "def", subject: "fix bug" }];
  const diffResult = { files: [], stats: { additions: 3, deletions: 1, filesChanged: 1 } };
  mockLogRange.mockResolvedValueOnce(commits);
  mockDiffBranches.mockResolvedValueOnce(diffResult);
  mockGetPrTemplate.mockResolvedValueOnce("## What\n## Why\n");
  mockGeneratePrDescription.mockResolvedValueOnce("PR body");

  const handler = getHandler(IPC.MCP.GENERATE_PR_DESCRIPTION);
  const result = await handler({}, "fix-branch", "main");

  expect(mockLogRange).toHaveBeenCalledWith("main", "fix-branch");
  expect(mockGetPrTemplate).toHaveBeenCalled();
  expect(mockGeneratePrDescription).toHaveBeenCalledWith(commits, expect.any(String), "## What\n## Why\n");
  expect(result).toBe("PR body");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/ipc/mcp.ipc.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement handler changes**

In `src/main/ipc/mcp.ipc.ts`, replace the `GENERATE_PR_DESCRIPTION` handler (lines 53-72) and add `GENERATE_PR_TITLE`:

```typescript
ipcMain.handle(
  IPC.MCP.GENERATE_PR_TITLE,
  async (_event, sourceBranch: string, targetBranch: string) => {
    const commits = await gitService.logRange(targetBranch, sourceBranch);
    if (commits.length === 0) return "";
    const diffResult = await gitService.diffBranches(targetBranch, sourceBranch);
    const diffSummary = diffResult.files
      .map((f) => `${f.status}: ${f.path} (+${f.additions}/-${f.deletions})`)
      .join("\n");
    return aiClient.generatePrTitle(commits, diffSummary);
  }
);

ipcMain.handle(
  IPC.MCP.GENERATE_PR_DESCRIPTION,
  async (_event, sourceBranch: string, targetBranch: string) => {
    const commits = await gitService.logRange(targetBranch, sourceBranch);
    if (commits.length === 0) return "";
    const diffResult = await gitService.diffBranches(targetBranch, sourceBranch);
    const diffSummary = diffResult.files
      .map((f) => `${f.status}: ${f.path} (+${f.additions}/-${f.deletions})`)
      .join("\n");
    const template = await gitService.getPrTemplate();
    return aiClient.generatePrDescription(commits, diffSummary, template);
  }
);
```

In `src/main/ipc/git-pr.ipc.ts`, add handler for `GET_TEMPLATE`:

```typescript
ipcMain.handle(IPC.PR.GET_TEMPLATE, async () => {
  return gitService.getPrTemplate();
});
```

- [ ] **Step 4: Update existing tests**

Update the "registers all MCP channels" test to include the new channel:

```typescript
expect(channels).toContain(IPC.MCP.GENERATE_PR_TITLE);
```

**IMPORTANT:** Remove the old test `"MCP.GENERATE_PR_DESCRIPTION with single commit calls getCommitDiff"` (lines 151-163 in the current file). It tests the old `commitHashes` signature which is replaced by the new branch-based handler. The new test `"MCP.GENERATE_PR_DESCRIPTION (branch-based)"` added in Step 1 replaces it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/ipc/mcp.ipc.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/mcp.ipc.ts src/main/ipc/mcp.ipc.test.ts src/main/ipc/git-pr.ipc.ts
git commit -m "feat(pr): add IPC handlers for AI title generation and branch-based PR description"
```

---

### Task 4: Preload API + Zustand Store

**Files:**
- Modify: `src/preload/index.ts:452-465` (mcp section) and `530-541` (pr section)
- Modify: `src/renderer/store/mcp-store.ts`

- [ ] **Step 1: Update preload `mcp` section**

In `src/preload/index.ts`, update the `mcp` block (around line 452):

```typescript
mcp: {
  serverStart: (): Promise<void> => ipcRenderer.invoke(IPC.MCP.SERVER_START),
  serverStop: (): Promise<void> => ipcRenderer.invoke(IPC.MCP.SERVER_STOP),
  serverStatus: (): Promise<{ running: boolean; repoPath: string | null }> =>
    ipcRenderer.invoke(IPC.MCP.SERVER_STATUS),
  generateCommitMessage: (): Promise<string> =>
    ipcRenderer.invoke(IPC.MCP.GENERATE_COMMIT_MESSAGE),
  suggestConflictResolution: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.MCP.SUGGEST_CONFLICT_RESOLUTION, filePath),
  generatePrTitle: (sourceBranch: string, targetBranch: string): Promise<string> =>
    ipcRenderer.invoke(IPC.MCP.GENERATE_PR_TITLE, sourceBranch, targetBranch),
  generatePrDescription: (sourceBranch: string, targetBranch: string): Promise<string> =>
    ipcRenderer.invoke(IPC.MCP.GENERATE_PR_DESCRIPTION, sourceBranch, targetBranch),
  reviewCommit: (hash: string): Promise<string> =>
    ipcRenderer.invoke(IPC.MCP.REVIEW_COMMIT, hash),
},
```

- [ ] **Step 2: Update preload `pr` section**

Add `getTemplate` to the `pr` block (around line 530):

```typescript
pr: {
  detectProvider: (): Promise<{
    provider: string;
    owner: string;
    repo: string;
    baseUrl: string;
  }> => ipcRenderer.invoke(IPC.PR.DETECT_PROVIDER),
  list: (): Promise<PrInfo[]> => ipcRenderer.invoke(IPC.PR.LIST),
  view: (number: number): Promise<string> => ipcRenderer.invoke(IPC.PR.VIEW, number),
  create: (options: PrCreateOptions): Promise<string> =>
    ipcRenderer.invoke(IPC.PR.CREATE, options),
  getTemplate: (): Promise<string | null> => ipcRenderer.invoke(IPC.PR.GET_TEMPLATE),
},
```

- [ ] **Step 3: Update mcp-store.ts**

In `src/renderer/store/mcp-store.ts`, update the interface and implementation:

Add to interface (around line 3):
```typescript
lastPrTitle: string | null;
```

Add to interface actions (around line 19):
```typescript
generatePrTitle: (source: string, target: string) => Promise<string>;
generatePrDescription: (source: string, target: string) => Promise<string>;
```

Update initial state (around line 28):
```typescript
lastPrTitle: null,
```

Replace `generatePrDescription` and add `generatePrTitle` in the store:

```typescript
generatePrTitle: async (source: string, target: string) => {
  set({ generating: true, error: null });
  try {
    const result = await window.electronAPI.mcp.generatePrTitle(source, target);
    set({ generating: false, lastPrTitle: result });
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    set({ generating: false, error: msg });
    throw err;
  }
},

generatePrDescription: async (source: string, target: string) => {
  set({ generating: true, error: null });
  try {
    const result = await window.electronAPI.mcp.generatePrDescription(source, target);
    set({ generating: false, lastPrDescription: result });
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    set({ generating: false, error: msg });
    throw err;
  }
},
```

- [ ] **Step 4: Update mcp-store.test.ts for new signature**

In `src/renderer/store/mcp-store.test.ts`, update the `generatePrDescription` tests (lines 165-197) to use the new `(source, target)` signature:

Replace all calls like `generatePrDescription(["abc", "def"])` with `generatePrDescription("feature-branch", "main")`.
Replace assertions like `expect(mockGeneratePrDescription).toHaveBeenCalledWith(["a1", "b2", "c3"])` with `expect(mockGeneratePrDescription).toHaveBeenCalledWith("feature-branch", "main")`.

Also add tests for the new `generatePrTitle` action:

```typescript
describe("generatePrTitle", () => {
  it("returns the title from the API", async () => {
    mockGeneratePrTitle.mockResolvedValue("feat: add auth");
    const result = await useMcpStore.getState().generatePrTitle("feat-branch", "main");
    expect(result).toBe("feat: add auth");
  });

  it("stores the title in lastPrTitle", async () => {
    mockGeneratePrTitle.mockResolvedValue("fix: resolve bug");
    await useMcpStore.getState().generatePrTitle("fix-branch", "main");
    expect(useMcpStore.getState().lastPrTitle).toBe("fix: resolve bug");
  });

  it("sets error on failure", async () => {
    mockGeneratePrTitle.mockRejectedValue(new Error("API error"));
    await expect(
      useMcpStore.getState().generatePrTitle("branch", "main")
    ).rejects.toThrow("API error");
    expect(useMcpStore.getState().error).toBe("API error");
  });
});
```

Note: add `mockGeneratePrTitle` mock and wire it in the mock setup for `window.electronAPI.mcp`.

- [ ] **Step 5: Run TypeScript type check and store tests**

Run: `npx tsc --noEmit && npx vitest run src/renderer/store/mcp-store.test.ts`
Expected: PASS (0 errors)

- [ ] **Step 6: Commit**

```bash
git add src/preload/index.ts src/renderer/store/mcp-store.ts src/renderer/store/mcp-store.test.ts
git commit -m "feat(pr): wire preload API and Zustand store for AI PR generation"
```

---

### Task 5: PrDialog UI — Branch Dropdown + AI Buttons

**Files:**
- Modify: `src/renderer/components/dialogs/PrDialog.tsx`
- Test: `src/renderer/components/dialogs/PrDialog.test.tsx`

- [ ] **Step 1: Write failing tests for new UI elements**

Add to `src/renderer/components/dialogs/PrDialog.test.tsx`. First update the mock setup to include new APIs:

```typescript
const mockGeneratePrTitle = vi.fn();
const mockGeneratePrDescription = vi.fn();
const mockGetSettings = vi.fn();
const mockBranchList = vi.fn();

// In beforeEach, update electronAPI:
(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
  pr: {
    detectProvider: mockDetectProvider,
    list: mockListPrs,
    view: mockViewPr,
    create: mockCreatePr,
    getTemplate: vi.fn().mockResolvedValue(null),
  },
  repo: {
    openExternal: mockOpenExternal,
  },
  mcp: {
    generatePrTitle: mockGeneratePrTitle,
    generatePrDescription: mockGeneratePrDescription,
  },
  settings: {
    get: mockGetSettings,
  },
  branch: {
    list: mockBranchList,
  },
};
```

Add tests:

```typescript
it("shows AI buttons when AI provider is configured", async () => {
  mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "u", repo: "r", baseUrl: "" });
  mockListPrs.mockResolvedValueOnce([]);
  mockGetSettings.mockResolvedValueOnce({ aiProvider: "anthropic" });
  mockBranchList.mockResolvedValueOnce([
    { name: "main", current: false, remote: false },
    { name: "develop", current: false, remote: false },
  ]);
  render(<PrDialog {...defaultProps} />);

  await waitFor(() => screen.getByText("Create New"));
  fireEvent.click(screen.getByText("Create New"));

  await waitFor(() => {
    expect(screen.getAllByText("AI").length).toBeGreaterThanOrEqual(2);
  });
});

it("hides AI buttons when AI provider is none", async () => {
  mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "u", repo: "r", baseUrl: "" });
  mockListPrs.mockResolvedValueOnce([]);
  mockGetSettings.mockResolvedValueOnce({ aiProvider: "none" });
  mockBranchList.mockResolvedValueOnce([]);
  render(<PrDialog {...defaultProps} />);

  await waitFor(() => screen.getByText("Create New"));
  fireEvent.click(screen.getByText("Create New"));

  await waitFor(() => {
    expect(screen.queryAllByText("AI").length).toBe(0);
  });
});

it("shows confirm dialog when overwriting non-empty title", async () => {
  mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "u", repo: "r", baseUrl: "" });
  mockListPrs.mockResolvedValueOnce([]);
  mockGetSettings.mockResolvedValueOnce({ aiProvider: "anthropic" });
  mockBranchList.mockResolvedValueOnce([
    { name: "main", current: false, remote: false },
  ]);
  // Mock window.confirm
  vi.spyOn(window, "confirm").mockReturnValue(false);

  render(<PrDialog {...defaultProps} />);
  await waitFor(() => screen.getByText("Create New"));
  fireEvent.click(screen.getByText("Create New"));
  await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));

  // Type something in title
  fireEvent.change(screen.getByPlaceholderText("Pull Request title..."), {
    target: { value: "existing title" },
  });

  // Click AI button for title
  const aiButtons = screen.getAllByText("AI");
  fireEvent.click(aiButtons[0]!);

  expect(window.confirm).toHaveBeenCalled();
  expect(mockGeneratePrTitle).not.toHaveBeenCalled();
});

it("shows empty result message when AI returns empty string", async () => {
  mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "u", repo: "r", baseUrl: "" });
  mockListPrs.mockResolvedValueOnce([]);
  mockGetSettings.mockResolvedValueOnce({ aiProvider: "anthropic" });
  mockBranchList.mockResolvedValueOnce([
    { name: "main", current: false, remote: false },
  ]);
  mockGeneratePrTitle.mockResolvedValueOnce("");

  render(<PrDialog {...defaultProps} />);
  await waitFor(() => screen.getByText("Create New"));
  fireEvent.click(screen.getByText("Create New"));
  await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));

  const aiButtons = screen.getAllByText("AI");
  await act(async () => {
    fireEvent.click(aiButtons[0]!);
  });

  await waitFor(() => {
    expect(screen.getByText(/No changes found/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/dialogs/PrDialog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PrDialog changes**

Replace `src/renderer/components/dialogs/PrDialog.tsx` with the updated version. Key changes:

1. **Add imports and state:**
```typescript
import type { BranchInfo } from "../../../shared/git-types";

// Inside component, add state:
const [branches, setBranches] = useState<BranchInfo[]>([]);
const [branchFilter, setBranchFilter] = useState("");
const [aiProvider, setAiProvider] = useState<string>("none");
const [generatingTitle, setGeneratingTitle] = useState(false);
const [generatingBody, setGeneratingBody] = useState(false);
```

2. **Load branches and settings on open:**
```typescript
// Inside loadData(), add:
const [providerInfo, prList, settings, branchList] = await Promise.all([
  window.electronAPI.pr.detectProvider(),
  window.electronAPI.pr.list(),
  window.electronAPI.settings.get(),
  window.electronAPI.branch.list(),
]);
setAiProvider(settings.aiProvider || "none");
setBranches(branchList);
```

3. **Branch dropdown component** (replace the target branch input):
```typescript
// Deduplicated branch names for dropdown
const branchNames = [...new Set(
  branches
    .map((b) => b.remote ? b.name.replace(/^origin\//, "") : b.name)
    .filter((n) => n !== "HEAD")
)];
const filteredBranches = branchNames.filter((b) =>
  b.toLowerCase().includes(branchFilter.toLowerCase())
);
```

Render a filterable dropdown: input with onChange filtering + dropdown list.

4. **AI buttons:**
```typescript
const sourceBranch = repo?.currentBranch || "HEAD";
const aiEnabled = aiProvider !== "none" && sourceBranch !== targetBranch;

const handleGenerateTitle = async () => {
  if (title.trim() && !window.confirm("Overwrite current title?")) return;
  setGeneratingTitle(true);
  setError(null);
  try {
    const result = await window.electronAPI.mcp.generatePrTitle(sourceBranch, targetBranch);
    if (!result) {
      setError("No changes found between branches");
    } else {
      setTitle(result);
    }
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setGeneratingTitle(false);
  }
};

const handleGenerateBody = async () => {
  if (body.trim() && !window.confirm("Overwrite current body?")) return;
  setGeneratingBody(true);
  setError(null);
  try {
    const result = await window.electronAPI.mcp.generatePrDescription(sourceBranch, targetBranch);
    if (!result) {
      setError("No changes found between branches");
    } else {
      setBody(result);
    }
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setGeneratingBody(false);
  }
};
```

5. **Render AI buttons** next to title and body fields:
```typescript
{aiEnabled && (
  <button
    className="toolbar-btn"
    onClick={handleGenerateTitle}
    disabled={generatingTitle || generatingBody}
    style={{ fontSize: 10, padding: "3px 8px", flexShrink: 0 }}
    title="Generate title with AI"
  >
    {generatingTitle ? "..." : "AI"}
  </button>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/dialogs/PrDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: all 162+ files pass, 0 errors

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/dialogs/PrDialog.tsx src/renderer/components/dialogs/PrDialog.test.tsx
git commit -m "feat(pr): add AI title/body generation buttons and branch dropdown to PrDialog"
```

---

### Task 6: Final Verification + Cleanup

**Files:** All modified files

- [ ] **Step 1: Run full quality check**

Run: `npm run quality`
Expected: tsc pass, eslint pass (only a11y warnings), all tests pass

- [ ] **Step 2: Verify ESLint**

Run: `npx eslint src/`
Expected: 0 errors (only existing a11y warnings)

- [ ] **Step 3: Verify manually** (optional)

Run `npm start`, open a repo, go to GitHub menu > Pull Requests > Create New tab:
- Verify branch dropdown shows all branches with filter
- Verify AI buttons appear when provider is configured
- Verify AI buttons hidden when provider is "none"
- Click AI title button → generates title
- Click AI body button → generates body (with template if exists)
- Test confirm dialog when fields are non-empty

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for AI PR description feature"
```
