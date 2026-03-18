# Changelog Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate Changelog..." context menu entry on commit graph rows that opens a child window showing commits grouped by conventional commit type.

**Architecture:** Backend-parsed approach — main process fetches `git log`, parses conventional commit prefixes, returns structured `ChangelogData`. Renderer displays grouped entries. Uses existing child window infrastructure (`openDialogWindow`, `DialogRouter`).

**Tech Stack:** Electron IPC, simple-git, React, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-changelog-dialog-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/ipc-channels.ts` | Modify | Add CHANGELOG channel constants |
| `src/shared/git-types.ts` | Modify | Add ChangelogEntry, ChangelogGroup, ChangelogData types |
| `src/shared/dialog-types.ts` | Modify | Add ChangelogDialog to DialogName + DIALOG_CONFIGS |
| `src/main/git/changelog-parser.ts` | Create | Parse conventional commit subjects into grouped ChangelogData |
| `src/main/git/changelog-parser.test.ts` | Create | Unit tests for parser |
| `src/main/git/git-service.ts` | Modify | Add getTagsBefore() and getChangelogCommits() |
| `src/main/ipc/changelog.ipc.ts` | Create | IPC handlers for TAGS_BEFORE and GENERATE |
| `src/main/ipc/index.ts` | Modify | Register changelog handlers |
| `src/preload/index.ts` | Modify | Expose changelog.getTagsBefore() and changelog.generate() |
| `src/renderer/components/dialogs/ChangelogDialog.tsx` | Create | Dialog UI component |
| `src/renderer/components/DialogRouter.tsx` | Modify | Add ChangelogDialog case |
| `src/renderer/components/graph/CommitGraphPanel.tsx` | Modify | Add context menu entry |

---

### Task 1: Shared Types & IPC Channels

**Files:**
- Modify: `src/shared/ipc-channels.ts:195-199`
- Modify: `src/shared/git-types.ts:251-252`
- Modify: `src/shared/dialog-types.ts:1-6,16-22`

- [ ] **Step 1: Add CHANGELOG IPC channels**

In `src/shared/ipc-channels.ts`, before the closing `} as const;` on line 199, add:

```typescript
  CHANGELOG: {
    TAGS_BEFORE: "git:changelog:tags-before",
    GENERATE: "git:changelog:generate",
  },
```

Insert after the STATS block (line 198), before the `} as const;` (line 199).

- [ ] **Step 2: Add changelog types to git-types.ts**

Append to end of `src/shared/git-types.ts` (after line 251):

```typescript

// Changelog
export interface ChangelogEntry {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  description: string;
  type: string;
  scope?: string;
  breaking: boolean;
  authorName: string;
  authorDate: string;
}

export interface ChangelogGroup {
  label: string;
  color: string;
  entries: ChangelogEntry[];
}

export interface ChangelogData {
  from: string;
  to: string;
  groups: ChangelogGroup[];
  totalCommits: number;
  authors: string[];
}
```

- [ ] **Step 3: Add ChangelogDialog to dialog-types.ts**

In `src/shared/dialog-types.ts`, add `"ChangelogDialog"` to the `DialogName` union (line 5):

```typescript
export type DialogName =
  | "MergeConflictDialog"
  | "CommitInfoWindow"
  | "StashDialog"
  | "SettingsDialog"
  | "InteractiveRebaseDialog"
  | "ChangelogDialog";
```

Add config entry to `DIALOG_CONFIGS` (after line 22, before the closing `};`):

```typescript
  ChangelogDialog:         { width: 700,  height: 550, minWidth: 500, minHeight: 400, modal: false },
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (types compile, no consumers yet)

- [ ] **Step 5: Commit**

```
feat(changelog): add shared types and IPC channel constants
```

---

### Task 2: Changelog Parser (TDD)

**Files:**
- Create: `src/main/git/changelog-parser.ts`
- Create: `src/main/git/changelog-parser.test.ts`

- [ ] **Step 1: Write failing tests for the parser**

Create `src/main/git/changelog-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseChangelog } from "./changelog-parser";
import type { ChangelogEntry } from "../../shared/git-types";

function makeEntry(overrides: Partial<ChangelogEntry> & { subject: string }): ChangelogEntry {
  return {
    hash: "abc1234567890",
    abbreviatedHash: "abc1234",
    subject: overrides.subject,
    description: "",
    type: "other",
    breaking: false,
    authorName: "Test Author",
    authorDate: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("parseChangelog", () => {
  it("groups feat commits under Features", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: add changelog dialog" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const feats = result.groups.find((g) => g.label === "Features");
    expect(feats).toBeDefined();
    expect(feats!.entries).toHaveLength(1);
    expect(feats!.entries[0].description).toBe("add changelog dialog");
    expect(feats!.entries[0].type).toBe("feat");
  });

  it("groups fix commits under Bug Fixes", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "fix: broken graph lines" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const fixes = result.groups.find((g) => g.label === "Bug Fixes");
    expect(fixes).toBeDefined();
    expect(fixes!.entries[0].description).toBe("broken graph lines");
  });

  it("extracts scope from conventional commit", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat(auth): add login flow" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const feats = result.groups.find((g) => g.label === "Features");
    expect(feats!.entries[0].scope).toBe("auth");
    expect(feats!.entries[0].description).toBe("add login flow");
  });

  it("detects breaking change via ! suffix", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat!: remove legacy API" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const breaking = result.groups.find((g) => g.label === "Breaking Changes");
    expect(breaking).toBeDefined();
    expect(breaking!.entries[0].breaking).toBe(true);
  });

  it("detects breaking change via BREAKING CHANGE in body", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({
        subject: "refactor: change auth middleware",
        description: "BREAKING CHANGE: session tokens no longer stored",
      }),
    ];
    // Parser should check the original entry's description field for BREAKING CHANGE
    // We simulate this by setting breaking on the raw entry
    entries[0].description = "BREAKING CHANGE: session tokens no longer stored";
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const breaking = result.groups.find((g) => g.label === "Breaking Changes");
    expect(breaking).toBeDefined();
  });

  it("puts non-conventional commits in Other group", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "update readme" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const other = result.groups.find((g) => g.label === "Other");
    expect(other).toBeDefined();
    expect(other!.entries[0].description).toBe("update readme");
  });

  it("groups chore, build, ci under Maintenance", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "chore: update deps" }),
      makeEntry({ subject: "build: fix webpack config" }),
      makeEntry({ subject: "ci: add GitHub Actions" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const maint = result.groups.find((g) => g.label === "Maintenance");
    expect(maint).toBeDefined();
    expect(maint!.entries).toHaveLength(3);
  });

  it("omits empty groups from output", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: only feature" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.groups.every((g) => g.entries.length > 0)).toBe(true);
  });

  it("calculates totalCommits and unique authors", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: one", authorName: "Alice" }),
      makeEntry({ subject: "fix: two", authorName: "Bob" }),
      makeEntry({ subject: "feat: three", authorName: "Alice" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.totalCommits).toBe(3);
    expect(result.authors).toEqual(["Alice", "Bob"]);
  });

  it("sets from and to in result", () => {
    const result = parseChangelog([], "v1.0.0", "v2.0.0");
    expect(result.from).toBe("v1.0.0");
    expect(result.to).toBe("v2.0.0");
  });

  it("puts Breaking Changes group first", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: normal feature" }),
      makeEntry({ subject: "fix!: breaking fix" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.groups[0].label).toBe("Breaking Changes");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/changelog-parser.test.ts`
Expected: FAIL — `parseChangelog` not found

- [ ] **Step 3: Implement the parser**

Create `src/main/git/changelog-parser.ts`:

```typescript
import type { ChangelogEntry, ChangelogGroup, ChangelogData } from "../../shared/git-types";

const COMMIT_PATTERN = /^(\w+)(\(.+?\))?(!)?:\s*(.+)$/;

const GROUP_CONFIG: { types: string[]; label: string; color: string }[] = [
  { types: ["feat"], label: "Features", color: "var(--green)" },
  { types: ["fix"], label: "Bug Fixes", color: "var(--peach)" },
  { types: ["perf"], label: "Performance", color: "var(--mauve)" },
  { types: ["refactor"], label: "Refactoring", color: "var(--blue)" },
  { types: ["docs"], label: "Documentation", color: "var(--teal)" },
  { types: ["test"], label: "Tests", color: "var(--yellow)" },
  { types: ["chore", "build", "ci"], label: "Maintenance", color: "var(--overlay1)" },
];

const BREAKING_COLOR = "var(--red)";
const OTHER_COLOR = "var(--subtext0)";

export function parseChangelog(
  entries: ChangelogEntry[],
  from: string,
  to: string,
): ChangelogData {
  const breakingEntries: ChangelogEntry[] = [];
  const grouped = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const parsed = parseSubject(entry.subject);
    const body = entry.description; // preserve raw body before overwrite
    const isBreaking =
      parsed.breaking ||
      body.includes("BREAKING CHANGE:");

    entry.type = parsed.type;
    entry.scope = parsed.scope;
    entry.description = parsed.description;
    entry.breaking = isBreaking;

    if (isBreaking) {
      breakingEntries.push(entry);
    }

    const groupLabel = findGroupLabel(parsed.type);
    const existing = grouped.get(groupLabel) || [];
    existing.push(entry);
    grouped.set(groupLabel, existing);
  }

  const groups: ChangelogGroup[] = [];

  if (breakingEntries.length > 0) {
    groups.push({
      label: "Breaking Changes",
      color: BREAKING_COLOR,
      entries: breakingEntries,
    });
  }

  for (const config of GROUP_CONFIG) {
    const groupEntries = grouped.get(config.label);
    if (groupEntries && groupEntries.length > 0) {
      groups.push({
        label: config.label,
        color: config.color,
        entries: groupEntries,
      });
    }
  }

  const otherEntries = grouped.get("Other");
  if (otherEntries && otherEntries.length > 0) {
    groups.push({
      label: "Other",
      color: OTHER_COLOR,
      entries: otherEntries,
    });
  }

  const uniqueAuthors = [...new Set(entries.map((e) => e.authorName))];

  return {
    from,
    to,
    groups,
    totalCommits: entries.length,
    authors: uniqueAuthors,
  };
}

function parseSubject(subject: string): {
  type: string;
  scope?: string;
  breaking: boolean;
  description: string;
} {
  const match = subject.match(COMMIT_PATTERN);
  if (!match) {
    return { type: "other", breaking: false, description: subject };
  }
  return {
    type: match[1],
    scope: match[2] ? match[2].slice(1, -1) : undefined,
    breaking: match[3] === "!",
    description: match[4],
  };
}

function findGroupLabel(type: string): string {
  for (const config of GROUP_CONFIG) {
    if (config.types.includes(type)) return config.label;
  }
  return "Other";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/changelog-parser.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```
feat(changelog): add conventional commit parser with TDD
```

---

### Task 3: Git Service Methods

**Files:**
- Modify: `src/main/git/git-service.ts`

- [ ] **Step 1: Add getTagsBefore method**

In `src/main/git/git-service.ts`, add before the closing of the `GitService` class (before the `}` that precedes the `// Singleton` comment near line 1935):

```typescript
  async getTagsBefore(hash: string): Promise<string[]> {
    if (!this.git) throw new Error("No repo open");
    const result = await this.git.raw([
      "tag", "--merged", hash, "--sort=-creatordate",
    ]);
    return result
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }
```

- [ ] **Step 2: Add getChangelogCommits method**

In the same class, add after `getTagsBefore`:

```typescript
  async getChangelogCommits(
    from: string,
    to: string,
  ): Promise<ChangelogEntry[]> {
    if (!this.git) throw new Error("No repo open");
    const FIELD_SEP = "\x00";
    const RECORD_SEP = "\x1e";
    const format = ["%H", "%h", "%s", "%b", "%an", "%aI"].join(FIELD_SEP) + RECORD_SEP;

    const raw = await this.git.raw([
      "log", `${from}..${to}`, "--no-merges", `--format=${format}`,
    ]);

    if (!raw.trim()) return [];

    return raw
      .split(RECORD_SEP)
      .filter((r) => r.trim())
      .map((record) => {
        const fields = record.split(FIELD_SEP);
        return {
          hash: fields[0].trim(),
          abbreviatedHash: fields[1]?.trim() || "",
          subject: fields[2]?.trim() || "",
          description: fields[3]?.trim() || "",
          type: "other",
          breaking: false,
          authorName: fields[4]?.trim() || "",
          authorDate: fields[5]?.trim() || "",
        };
      });
  }
```

Add the import at the top of `git-service.ts`:

```typescript
import type { ChangelogEntry } from "../../shared/git-types";
```

(Add to the existing type import block from `../../shared/git-types`.)

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
feat(changelog): add git service methods for tags and changelog commits
```

---

### Task 4: IPC Handlers

**Files:**
- Create: `src/main/ipc/changelog.ipc.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1: Create changelog IPC handler**

Create `src/main/ipc/changelog.ipc.ts`:

```typescript
import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { parseChangelog } from "../git/changelog-parser";

export function registerChangelogHandlers(): void {
  ipcMain.handle(
    IPC.CHANGELOG.TAGS_BEFORE,
    async (_event: IpcMainInvokeEvent, hash: string) => {
      return gitService.getTagsBefore(hash);
    },
  );

  ipcMain.handle(
    IPC.CHANGELOG.GENERATE,
    async (_event: IpcMainInvokeEvent, from: string, to: string) => {
      const entries = await gitService.getChangelogCommits(from, to);
      return parseChangelog(entries, from, to);
    },
  );
}
```

- [ ] **Step 2: Register in index.ts**

In `src/main/ipc/index.ts`, add import (line 18):

```typescript
import { registerChangelogHandlers } from "./changelog.ipc";
```

Add call in `registerAllHandlers()` (line 38, before closing `}`):

```typescript
  registerChangelogHandlers();
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
feat(changelog): add IPC handlers for changelog generation
```

---

### Task 5: Preload API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add changelog methods to preload**

In `src/preload/index.ts`, add after the `mcp` block (before line 424 closing `};`):

```typescript

  changelog: {
    getTagsBefore: (hash: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.CHANGELOG.TAGS_BEFORE, hash),
    generate: (from: string, to: string): Promise<ChangelogData> =>
      ipcRenderer.invoke(IPC.CHANGELOG.GENERATE, from, to),
  },
```

Add `ChangelogData` to the type import from `../../shared/git-types` at the top of the file.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
feat(changelog): expose changelog IPC in preload API
```

---

### Task 6: ChangelogDialog Component (TDD)

**Files:**
- Create: `src/renderer/components/dialogs/ChangelogDialog.tsx`

- [ ] **Step 1: Create the ChangelogDialog component**

Create `src/renderer/components/dialogs/ChangelogDialog.tsx`:

```typescript
import React, { useState, useEffect } from "react";
import type { ChangelogData } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  commitSubject?: string;
  mode?: "overlay" | "window";
}

export const ChangelogDialog: React.FC<Props> = ({
  open,
  onClose,
  commitHash,
  commitSubject,
  mode = "overlay",
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedBase, setSelectedBase] = useState("");
  const [customBase, setCustomBase] = useState("");
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChangelog(null);
    setError(null);
    setLoading(false);
    setCustomBase("");
    window.electronAPI.changelog
      .getTagsBefore(commitHash)
      .then((result) => {
        setTags(result);
        if (result.length > 0) setSelectedBase(result[0]);
        else setSelectedBase("__custom__");
      })
      .catch(() => {
        setTags([]);
        setSelectedBase("__custom__");
      });
  }, [open, commitHash]);

  useEffect(() => {
    if (mode === "window") {
      document.title = changelog
        ? `Changelog — ${changelog.from}..${changelog.to}`
        : "Changelog";
    }
  }, [changelog, mode]);

  const effectiveBase = selectedBase === "__custom__" ? customBase.trim() : selectedBase;

  const handleGenerate = async () => {
    if (!effectiveBase) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.changelog.generate(
        effectiveBase,
        commitHash,
      );
      setChangelog(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!changelog) return;
    const md = changelogToMarkdown(changelog);
    navigator.clipboard.writeText(md);
  };

  if (!open) return null;

  const isWindow = mode === "window";

  return (
    <div
      style={{
        ...(isWindow
          ? { height: "100vh", display: "flex", flexDirection: "column" }
          : {
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }),
        background: isWindow ? "var(--surface-0)" : undefined,
      }}
    >
      <div
        style={{
          ...(isWindow
            ? { flex: 1, display: "flex", flexDirection: "column" }
            : {
                background: "var(--surface-0)",
                borderRadius: 8,
                width: 700,
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
              }),
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--surface-2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>From</span>
          <select
            value={selectedBase}
            onChange={(e) => setSelectedBase(e.target.value)}
            style={{
              background: "var(--surface-1)",
              color: "var(--text-primary)",
              border: "1px solid var(--surface-2)",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 13,
              minWidth: 140,
            }}
          >
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
            <option value="__custom__">Custom ref...</option>
          </select>
          {selectedBase === "__custom__" && (
            <input
              type="text"
              value={customBase}
              onChange={(e) => setCustomBase(e.target.value)}
              placeholder="branch, tag, or commit hash"
              style={{
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 13,
                minWidth: 160,
              }}
            />
          )}
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>to</span>
          <span
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-2)",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            {commitHash.slice(0, 7)}
            {commitSubject ? ` — ${commitSubject}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleGenerate}
            disabled={!effectiveBase || loading}
            style={{
              background: "var(--blue)",
              color: "var(--surface-0)",
              border: "none",
              borderRadius: 4,
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: effectiveBase && !loading ? "pointer" : "not-allowed",
              opacity: !effectiveBase || loading ? 0.6 : 1,
            }}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, fontSize: 13, lineHeight: 1.6 }}>
          {error && (
            <div style={{ color: "var(--red)", marginBottom: 12 }}>{error}</div>
          )}
          {!changelog && !error && !loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              Click Generate to create changelog
            </div>
          )}
          {changelog && changelog.totalCommits === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              No commits in this range
            </div>
          )}
          {changelog && changelog.totalCommits > 0 &&
            changelog.groups.map((group) => (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    color: group.color,
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  {group.label === "Breaking Changes" ? "⚠ " : "✦ "}
                  {group.label}
                </div>
                <div
                  style={{
                    paddingLeft: 12,
                    borderLeft: `2px solid ${group.color}`,
                  }}
                >
                  {group.entries.map((entry) => (
                    <div key={entry.hash} style={{ marginBottom: 4 }}>
                      <span style={{ color: "var(--text-primary)" }}>
                        {entry.scope && (
                          <strong>{entry.scope}: </strong>
                        )}
                        {entry.description}
                      </span>
                      <span
                        style={{
                          color: "var(--overlay1)",
                          marginLeft: 8,
                          fontSize: 11,
                        }}
                      >
                        {entry.abbreviatedHash}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--overlay1)", fontSize: 12 }}>
            {changelog
              ? `${changelog.totalCommits} commits · ${changelog.authors.length} authors`
              : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {changelog && (
              <button
                onClick={handleCopyMarkdown}
                style={{
                  background: "var(--surface-1)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--surface-2)",
                  borderRadius: 4,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Copy as Markdown
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--surface-2)",
                borderRadius: 4,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function changelogToMarkdown(data: ChangelogData): string {
  const lines: string[] = [`## Changelog (${data.from}..${data.to})`, ""];
  for (const group of data.groups) {
    const icon = group.label === "Breaking Changes" ? "⚠ " : "";
    lines.push(`### ${icon}${group.label}`);
    for (const entry of group.entries) {
      const scopePrefix = entry.scope ? `**${entry.scope}:** ` : "";
      lines.push(`- ${scopePrefix}${entry.description} (${entry.abbreviatedHash})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
feat(changelog): add ChangelogDialog component
```

---

### Task 7: DialogRouter & Context Menu Wiring

**Files:**
- Modify: `src/renderer/components/DialogRouter.tsx:106-143`
- Modify: `src/renderer/components/graph/CommitGraphPanel.tsx:377-389`

- [ ] **Step 1: Add ChangelogDialog to DialogRouter**

In `src/renderer/components/DialogRouter.tsx`, add import at top:

```typescript
import { ChangelogDialog } from "./dialogs/ChangelogDialog";
```

Add case before the `default:` in the switch (before line 144):

```typescript
      case "ChangelogDialog":
        return (
          <ChangelogDialog
            open={true}
            onClose={handleClose}
            commitHash={(initData.commitHash as string) || "HEAD"}
            commitSubject={initData.commitSubject as string | undefined}
            mode="window"
          />
        );
```

- [ ] **Step 2: Add context menu entry in CommitGraphPanel**

In `src/renderer/components/graph/CommitGraphPanel.tsx`, add after the compare section (after line 377, before the `items.push` for Copy Hash on line 379):

```typescript
    items.push(
      { divider: true },
      {
        label: "Generate Changelog...",
        icon: "📋",
        onClick: () =>
          openDialogWindow({
            dialog: "ChangelogDialog",
            data: { commitHash: row.commit.hash, commitSubject: row.commit.subject },
          }),
      },
    );
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```
feat(changelog): wire dialog router and context menu entry
```

---

### Task 8: Manual Smoke Test & Final Commit

- [ ] **Step 1: Start the app**

Run: `npm start`

- [ ] **Step 2: Smoke test**

1. Open a repo with tags and conventional commits
2. Right-click a commit in the graph
3. Verify "Generate Changelog..." appears in the context menu
4. Click it — verify child window opens
5. Verify the "From" dropdown is populated with tags (previous tag selected)
6. Click "Generate" — verify grouped changelog appears
7. Click "Copy as Markdown" — paste somewhere to verify format
8. Close the window

- [ ] **Step 3: Run all tests one final time**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Run type check and lint**

Run: `npx tsc --noEmit && npx eslint src/`
Expected: PASS (no new errors)

- [ ] **Step 5: Final commit (if any fixes needed)**

```
fix(changelog): address smoke test feedback
```
