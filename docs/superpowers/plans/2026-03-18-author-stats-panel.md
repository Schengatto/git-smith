# Author Statistics Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dockview panel showing commit/author statistics as an analytical dashboard with leaderboard, timeframe filtering (All Time/Month/Week), and expandable author detail with sparkline comparison.

**Architecture:** Two-level IPC — `STATS.LEADERBOARD` returns ranked authors with base stats, `STATS.AUTHOR_DETAIL` returns full detail for a single author on click. Backend uses `git log --shortstat` for leaderboard and `git log --numstat` for detail. Frontend uses Zustand store with client-side sorting and team timeline computation.

**Tech Stack:** Electron IPC, simple-git raw(), Zustand, React inline styles, SVG sparkline, Catppuccin CSS variables.

**Spec:** `docs/superpowers/specs/2026-03-18-author-stats-panel-design.md`

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/shared/ipc-channels.ts` | Add `STATS` namespace |
| `src/shared/stats-types.ts` | NEW — Timeframe, LeaderboardEntry, AuthorDetail, TeamTimeline |
| `src/main/git/git-service.ts` | Add `getLeaderboard()`, `getAuthorDetail()` |
| `src/main/git/git-service-stats.test.ts` | NEW — tests for stats methods |
| `src/main/ipc/stats.ipc.ts` | NEW — IPC handlers |
| `src/main/ipc/stats.ipc.test.ts` | NEW — handler tests |
| `src/main/ipc/index.ts` | Register stats handlers |
| `src/preload/index.ts` | Expose `stats` API |
| `src/renderer/store/stats-store.ts` | NEW — Zustand store |
| `src/renderer/store/stats-store.test.ts` | NEW — store tests |
| `src/renderer/components/stats/StatsPanel.tsx` | NEW — main panel |
| `src/renderer/components/stats/StatsPanel.test.tsx` | NEW — panel tests |
| `src/renderer/components/stats/AuthorDetailExpander.tsx` | NEW — expandable detail |
| `src/renderer/components/stats/Sparkline.tsx` | NEW — SVG sparkline |
| `src/renderer/components/stats/ActivityHeatmap.tsx` | NEW — hour/day heatmap |
| `src/renderer/components/layout/AppShell.tsx` | Register `stats` panel |

---

## Task 1: Shared Types and IPC Channels

**Files:**
- Modify: `src/shared/ipc-channels.ts` (add STATS namespace after DIALOG, ~line 194)
- Create: `src/shared/stats-types.ts`

- [ ] **Step 1: Add STATS namespace to IPC channels**

In `src/shared/ipc-channels.ts`, add after the DIALOG namespace (~line 194):

```typescript
STATS: {
  LEADERBOARD: "git:stats:leaderboard",
  AUTHOR_DETAIL: "git:stats:author-detail",
},
```

- [ ] **Step 2: Create shared types file**

Create `src/shared/stats-types.ts`:

```typescript
export type Timeframe = "all" | "month" | "week";

export interface LeaderboardEntry {
  authorName: string;
  authorEmail: string;
  gravatarHash: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  firstCommitDate: string;
  lastCommitDate: string;
  longestStreak: number;
  rank: number;
}

export interface AuthorDetail {
  authorName: string;
  authorEmail: string;
  commitTimeline: { date: string; count: number }[];
  topFiles: { path: string; changes: number }[];
  hourlyDistribution: number[];
  dailyDistribution: number[];
  avgCommitSize: number;
  linesAdded: number;
  linesRemoved: number;
  longestStreak: number;
  currentStreak: number;
  firstCommitDate: string;
  lastCommitDate: string;
}

export interface TeamTimeline {
  timeline: { date: string; count: number }[];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc-channels.ts src/shared/stats-types.ts
git commit -m "feat(stats): add IPC channels and shared types"
```

---

## Task 2: Backend — getLeaderboard()

**Files:**
- Modify: `src/main/git/git-service.ts`
- Create: `src/main/git/git-service-stats.test.ts`

- [ ] **Step 1: Write failing tests for getLeaderboard**

Create `src/main/git/git-service-stats.test.ts`.

**IMPORTANT:** Follow the existing test pattern from `git-service-checkout.test.ts`:
- Mock `simple-git` module at top level with `vi.mock("simple-git", ...)`
- Mock `electron` module
- Import `GitService` class (not the singleton `gitService`)
- In `beforeEach`, create `new GitService()` and set `git` and `repoPath` via cast:
  ```typescript
  service = new GitService();
  (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
  (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  ```

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

describe("getLeaderboard", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("should parse shortstat output and return ranked authors", async () => {
    const mockOutput = [
      "COMMIT_START",
      "abc123",
      "Alice",
      "alice@example.com",
      "2026-03-15T10:00:00+00:00",
      " 3 files changed, 50 insertions(+), 10 deletions(-)",
      "",
      "COMMIT_START",
      "def456",
      "Bob",
      "bob@example.com",
      "2026-03-14T10:00:00+00:00",
      " 1 file changed, 20 insertions(+), 5 deletions(-)",
      "",
      "COMMIT_START",
      "ghi789",
      "Alice",
      "alice@example.com",
      "2026-03-13T10:00:00+00:00",
      " 2 files changed, 30 insertions(+)",
      "",
    ].join("\n");

    mockRaw.mockResolvedValue(mockOutput);

    const result = await service.getLeaderboard("all");

    expect(result).toHaveLength(2);
    expect(result[0].authorName).toBe("Alice");
    expect(result[0].commits).toBe(2);
    expect(result[0].linesAdded).toBe(80);
    expect(result[0].linesRemoved).toBe(10);
    expect(result[0].rank).toBe(1);
    expect(result[0].gravatarHash).toBeDefined();
    expect(result[1].authorName).toBe("Bob");
    expect(result[1].commits).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it("should apply --since flag for week timeframe", async () => {
    mockRaw.mockResolvedValue("");

    await service.getLeaderboard("week");

    const args = mockRaw.mock.calls[0][0] as string[];
    expect(args).toContain("--since=7 days ago");
  });

  it("should apply --since flag for month timeframe", async () => {
    mockRaw.mockResolvedValue("");

    await service.getLeaderboard("month");

    const args = mockRaw.mock.calls[0][0] as string[];
    expect(args).toContain("--since=30 days ago");
  });

  it("should not apply --since for all timeframe", async () => {
    mockRaw.mockResolvedValue("");

    await service.getLeaderboard("all");

    const args = mockRaw.mock.calls[0][0] as string[];
    expect(args.some((a: string) => a.startsWith("--since"))).toBe(false);
  });

  it("should compute longest streak in UTC calendar days", async () => {
    const mockOutput = [
      "COMMIT_START", "a1", "Dev", "dev@test.com", "2026-03-15T23:00:00+00:00",
      " 1 file changed, 1 insertion(+)", "",
      "COMMIT_START", "a2", "Dev", "dev@test.com", "2026-03-14T10:00:00+00:00",
      " 1 file changed, 1 insertion(+)", "",
      "COMMIT_START", "a3", "Dev", "dev@test.com", "2026-03-13T05:00:00+00:00",
      " 1 file changed, 1 insertion(+)", "",
      "COMMIT_START", "a4", "Dev", "dev@test.com", "2026-03-11T10:00:00+00:00",
      " 1 file changed, 1 insertion(+)", "",
    ].join("\n");

    mockRaw.mockResolvedValue(mockOutput);

    const result = await service.getLeaderboard("all");
    expect(result[0].longestStreak).toBe(3);
  });

  it("should return empty array for empty repo", async () => {
    mockRaw.mockResolvedValue("");

    const result = await service.getLeaderboard("all");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/git-service-stats.test.ts`
Expected: FAIL — `gitService.getLeaderboard is not a function`

- [ ] **Step 3: Implement getLeaderboard in git-service.ts**

Add to `src/main/git/git-service.ts` (after existing methods, before the class closing brace):

```typescript
async getLeaderboard(timeframe: import("../../shared/stats-types").Timeframe): Promise<import("../../shared/stats-types").LeaderboardEntry[]> {
  const git = this.getGit();
  const args = [
    "log",
    "--format=COMMIT_START%n%H%n%an%n%ae%n%aI",
    "--shortstat",
  ];

  if (timeframe === "week") args.push("--since=7 days ago");
  else if (timeframe === "month") args.push("--since=30 days ago");

  const result = await git.raw(args);
  if (!result.trim()) return [];

  const lines = result.split("\n");
  const authors = new Map<string, {
    name: string; email: string; commits: number;
    linesAdded: number; linesRemoved: number;
    dates: string[];
  }>();

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== "COMMIT_START") { i++; continue; }
    i++; // skip hash
    const _hash = lines[i++]?.trim();
    const name = lines[i++]?.trim();
    const email = lines[i++]?.trim()?.toLowerCase();
    const date = lines[i++]?.trim();
    if (!name || !email || !date) continue;

    // Find shortstat line (skip empty lines)
    let added = 0, removed = 0;
    while (i < lines.length && lines[i].trim() !== "COMMIT_START") {
      const line = lines[i].trim();
      if (line.includes("changed")) {
        const insMatch = line.match(/(\d+) insertion/);
        const delMatch = line.match(/(\d+) deletion/);
        if (insMatch) added = parseInt(insMatch[1], 10);
        if (delMatch) removed = parseInt(delMatch[1], 10);
      }
      i++;
    }

    const key = email;
    const entry = authors.get(key) || {
      name, email, commits: 0, linesAdded: 0, linesRemoved: 0, dates: [],
    };
    entry.name = name; // use most recent name
    entry.commits++;
    entry.linesAdded += added;
    entry.linesRemoved += removed;
    entry.dates.push(date);
    authors.set(key, entry);
  }

  const entries: import("../../shared/stats-types").LeaderboardEntry[] = [];
  for (const [, author] of authors) {
    const sortedDates = author.dates
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    const utcDays = sortedDates.map((d) => {
      const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      return utc.getTime();
    });
    const uniqueDays = [...new Set(utcDays)].sort((a, b) => a - b);

    let longestStreak = 0, currentRun = 1;
    for (let j = 1; j < uniqueDays.length; j++) {
      const diffMs = uniqueDays[j] - uniqueDays[j - 1];
      if (diffMs === 86400000) { currentRun++; }
      else { longestStreak = Math.max(longestStreak, currentRun); currentRun = 1; }
    }
    longestStreak = Math.max(longestStreak, currentRun);
    if (uniqueDays.length === 0) longestStreak = 0;

    entries.push({
      authorName: author.name,
      authorEmail: author.email,
      gravatarHash: crypto.createHash("md5").update(author.email).digest("hex"),
      commits: author.commits,
      linesAdded: author.linesAdded,
      linesRemoved: author.linesRemoved,
      firstCommitDate: sortedDates[0]?.toISOString() ?? "",
      lastCommitDate: sortedDates[sortedDates.length - 1]?.toISOString() ?? "",
      longestStreak,
      rank: 0,
    });
  }

  entries.sort((a, b) => b.commits - a.commits);
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/git-service-stats.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/git/git-service.ts src/main/git/git-service-stats.test.ts
git commit -m "feat(stats): implement getLeaderboard with shortstat parsing and streak calculation"
```

---

## Task 3: Backend — getAuthorDetail()

**Files:**
- Modify: `src/main/git/git-service.ts`
- Modify: `src/main/git/git-service-stats.test.ts`

- [ ] **Step 1: Write failing tests for getAuthorDetail**

Add to `src/main/git/git-service-stats.test.ts` (inside the same file, after the `getLeaderboard` describe block — reuses the same `mockRaw`, `service`, and `beforeEach` setup):

```typescript
describe("getAuthorDetail", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("should parse numstat output and return author detail with name", async () => {
    const mockOutput = [
      "COMMIT_START",
      "Alice Smith",
      "2026-03-15T14:30:00+00:00",
      "alice@example.com",
      "10\t2\tsrc/main/index.ts",
      "5\t1\tsrc/renderer/App.tsx",
      "",
      "COMMIT_START",
      "Alice Smith",
      "2026-03-14T09:00:00+00:00",
      "alice@example.com",
      "3\t0\tsrc/main/index.ts",
      "",
    ].join("\n");

    mockRaw.mockResolvedValue(mockOutput);

    const result = await service.getAuthorDetail("alice@example.com", "month");

    expect(result.authorName).toBe("Alice Smith");
    expect(result.authorEmail).toBe("alice@example.com");
    expect(result.linesAdded).toBe(18);
    expect(result.linesRemoved).toBe(3);
    expect(result.avgCommitSize).toBe(10.5); // (18+3)/2
    expect(result.topFiles).toHaveLength(2);
    expect(result.topFiles[0].path).toBe("src/main/index.ts");
    expect(result.topFiles[0].changes).toBe(15); // 10+2+3+0
    expect(result.hourlyDistribution).toHaveLength(24);
    expect(result.hourlyDistribution[14]).toBe(1); // 14:30 UTC
    expect(result.hourlyDistribution[9]).toBe(1);  // 09:00 UTC
    expect(result.dailyDistribution).toHaveLength(7);
  });

  it("should use anchored author match in git args", async () => {
    mockRaw.mockResolvedValue("");

    await service.getAuthorDetail("test@example.com", "all");

    const args = mockRaw.mock.calls[0][0] as string[];
    expect(args).toContain("--author=^test@example.com$");
  });

  it("should compute current streak counting back from last commit", async () => {
    const today = new Date();
    const d = (daysAgo: number) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      return date.toISOString();
    };

    const mockOutput = [
      "COMMIT_START", "Dev", d(0), "dev@test.com", "1\t0\tfile.ts", "",
      "COMMIT_START", "Dev", d(1), "dev@test.com", "1\t0\tfile.ts", "",
      "COMMIT_START", "Dev", d(2), "dev@test.com", "1\t0\tfile.ts", "",
      // gap at d(3)
      "COMMIT_START", "Dev", d(4), "dev@test.com", "1\t0\tfile.ts", "",
    ].join("\n");

    mockRaw.mockResolvedValue(mockOutput);

    const result = await service.getAuthorDetail("dev@test.com", "all");
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("should group commitTimeline by day for month timeframe", async () => {
    const mockOutput = [
      "COMMIT_START", "A", "2026-03-15T10:00:00+00:00", "a@b.com", "1\t0\tf.ts", "",
      "COMMIT_START", "A", "2026-03-15T14:00:00+00:00", "a@b.com", "1\t0\tf.ts", "",
      "COMMIT_START", "A", "2026-03-14T10:00:00+00:00", "a@b.com", "1\t0\tf.ts", "",
    ].join("\n");

    mockRaw.mockResolvedValue(mockOutput);

    const result = await service.getAuthorDetail("a@b.com", "month");
    const mar15 = result.commitTimeline.find((t) => t.date === "2026-03-15");
    expect(mar15?.count).toBe(2);
  });

  it("should return empty detail for no commits", async () => {
    mockRaw.mockResolvedValue("");

    const result = await service.getAuthorDetail("nobody@test.com", "all");
    expect(result.commitTimeline).toEqual([]);
    expect(result.topFiles).toEqual([]);
    expect(result.linesAdded).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/git-service-stats.test.ts`
Expected: FAIL — `gitService.getAuthorDetail is not a function`

- [ ] **Step 3: Implement getAuthorDetail in git-service.ts**

Add to `src/main/git/git-service.ts` after `getLeaderboard`:

```typescript
async getAuthorDetail(email: string, timeframe: import("../../shared/stats-types").Timeframe): Promise<import("../../shared/stats-types").AuthorDetail> {
  const git = this.getGit();
  const args = [
    "log",
    `--author=^${email}$`,
    "--format=COMMIT_START%n%an%n%aI%n%ae",
    "--numstat",
  ];

  if (timeframe === "week") args.push("--since=7 days ago");
  else if (timeframe === "month") args.push("--since=30 days ago");

  const result = await git.raw(args);
  if (!result.trim()) {
    return {
      authorName: "", authorEmail: email,
      commitTimeline: [], topFiles: [],
      hourlyDistribution: new Array(24).fill(0),
      dailyDistribution: new Array(7).fill(0),
      avgCommitSize: 0, linesAdded: 0, linesRemoved: 0,
      longestStreak: 0, currentStreak: 0,
      firstCommitDate: "", lastCommitDate: "",
    };
  }

  const lines = result.split("\n");
  const commits: { date: Date; files: { path: string; added: number; removed: number }[] }[] = [];
  let authorName = "";

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== "COMMIT_START") { i++; continue; }
    i++;
    const commitAuthorName = lines[i++]?.trim();
    const dateStr = lines[i++]?.trim();
    const commitEmail = lines[i++]?.trim()?.toLowerCase();
    if (!dateStr) continue;
    // Safety net: verify exact email match
    if (commitEmail && commitEmail !== email.toLowerCase()) { continue; }
    if (commitAuthorName) authorName = commitAuthorName; // keep most recent

    const date = new Date(dateStr);
    const fileChanges: { path: string; added: number; removed: number }[] = [];

    while (i < lines.length && lines[i].trim() !== "COMMIT_START") {
      const line = lines[i].trim();
      if (line) {
        const parts = line.split("\t");
        if (parts.length === 3) {
          const added = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
          const removed = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
          fileChanges.push({ path: parts[2], added, removed });
        }
      }
      i++;
    }

    commits.push({ date, files: fileChanges });
  }

  if (commits.length === 0) {
    return {
      authorName: "", authorEmail: email,
      commitTimeline: [], topFiles: [],
      hourlyDistribution: new Array(24).fill(0),
      dailyDistribution: new Array(7).fill(0),
      avgCommitSize: 0, linesAdded: 0, linesRemoved: 0,
      longestStreak: 0, currentStreak: 0,
      firstCommitDate: "", lastCommitDate: "",
    };
  }

  // Sort oldest first
  commits.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Lines
  let totalAdded = 0, totalRemoved = 0;
  const fileStats = new Map<string, number>();
  for (const c of commits) {
    for (const f of c.files) {
      totalAdded += f.added;
      totalRemoved += f.removed;
      fileStats.set(f.path, (fileStats.get(f.path) || 0) + f.added + f.removed);
    }
  }

  // Top files
  const topFiles = [...fileStats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, changes]) => ({ path, changes }));

  // Hourly distribution (UTC)
  const hourly = new Array(24).fill(0);
  const daily = new Array(7).fill(0);
  for (const c of commits) {
    hourly[c.date.getUTCHours()]++;
    daily[c.date.getUTCDay()]++;
  }

  // Commit timeline
  const timelineBuckets = new Map<string, number>();
  for (const c of commits) {
    let key: string;
    if (timeframe === "week") {
      // Group by hour
      key = `${c.date.getUTCFullYear()}-${String(c.date.getUTCMonth() + 1).padStart(2, "0")}-${String(c.date.getUTCDate()).padStart(2, "0")}T${String(c.date.getUTCHours()).padStart(2, "0")}:00`;
    } else if (timeframe === "month") {
      // Group by day
      key = `${c.date.getUTCFullYear()}-${String(c.date.getUTCMonth() + 1).padStart(2, "0")}-${String(c.date.getUTCDate()).padStart(2, "0")}`;
    } else {
      // Group by ISO week (Monday-based)
      const d = new Date(Date.UTC(c.date.getUTCFullYear(), c.date.getUTCMonth(), c.date.getUTCDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      key = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    }
    timelineBuckets.set(key, (timelineBuckets.get(key) || 0) + 1);
  }
  const commitTimeline = [...timelineBuckets.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Streaks (UTC calendar days)
  const utcDays = commits
    .map((c) => Date.UTC(c.date.getUTCFullYear(), c.date.getUTCMonth(), c.date.getUTCDate()))
  const uniqueDays = [...new Set(utcDays)].sort((a, b) => a - b);

  let longestStreak = 0, currentStreak = 1, runLength = 1;
  for (let j = 1; j < uniqueDays.length; j++) {
    if (uniqueDays[j] - uniqueDays[j - 1] === 86400000) { runLength++; }
    else { longestStreak = Math.max(longestStreak, runLength); runLength = 1; }
  }
  longestStreak = Math.max(longestStreak, runLength);

  // Current streak: count back from today
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  currentStreak = 0;
  for (let d = todayUtc; ; d -= 86400000) {
    if (uniqueDays.includes(d)) { currentStreak++; }
    else if (d < todayUtc) { break; } // allow today to be missing (streak from yesterday)
    else { break; }
  }
  // If today has no commit, try from yesterday
  if (currentStreak === 0) {
    for (let d = todayUtc - 86400000; ; d -= 86400000) {
      if (uniqueDays.includes(d)) { currentStreak++; }
      else { break; }
    }
  }

  if (uniqueDays.length <= 1) {
    longestStreak = uniqueDays.length;
    currentStreak = uniqueDays.length > 0 && uniqueDays[uniqueDays.length - 1] >= todayUtc - 86400000 ? 1 : 0;
  }

  return {
    authorName: authorName || email.split("@")[0],
    authorEmail: email,
    commitTimeline,
    topFiles,
    hourlyDistribution: hourly,
    dailyDistribution: daily,
    avgCommitSize: (totalAdded + totalRemoved) / commits.length,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
    longestStreak,
    currentStreak,
    firstCommitDate: commits[0].date.toISOString(),
    lastCommitDate: commits[commits.length - 1].date.toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/git-service-stats.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/git/git-service.ts src/main/git/git-service-stats.test.ts
git commit -m "feat(stats): implement getAuthorDetail with numstat parsing and streak calculation"
```

---

## Task 4: IPC Handlers

**Files:**
- Create: `src/main/ipc/stats.ipc.ts`
- Create: `src/main/ipc/stats.ipc.test.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1: Write failing test for stats IPC handlers**

Create `src/main/ipc/stats.ipc.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHandle = vi.fn();
vi.mock("electron", () => ({
  ipcMain: { handle: mockHandle },
}));

vi.mock("../git/git-service", () => ({
  gitService: {
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getAuthorDetail: vi.fn().mockResolvedValue({}),
  },
}));

import { registerStatsHandlers } from "./stats.ipc";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

describe("stats IPC handlers", () => {
  beforeEach(() => {
    mockHandle.mockClear();
  });

  it("should register leaderboard and author-detail handlers", () => {
    registerStatsHandlers();
    const channels = mockHandle.mock.calls.map((c: any[]) => c[0]);
    expect(channels).toContain(IPC.STATS.LEADERBOARD);
    expect(channels).toContain(IPC.STATS.AUTHOR_DETAIL);
  });

  it("should call gitService.getLeaderboard with timeframe", async () => {
    registerStatsHandlers();
    const leaderboardHandler = mockHandle.mock.calls.find(
      (c: any[]) => c[0] === IPC.STATS.LEADERBOARD
    )?.[1];
    await leaderboardHandler({}, "week");
    expect(gitService.getLeaderboard).toHaveBeenCalledWith("week");
  });

  it("should call gitService.getAuthorDetail with email and timeframe", async () => {
    registerStatsHandlers();
    const detailHandler = mockHandle.mock.calls.find(
      (c: any[]) => c[0] === IPC.STATS.AUTHOR_DETAIL
    )?.[1];
    await detailHandler({}, "alice@test.com", "month");
    expect(gitService.getAuthorDetail).toHaveBeenCalledWith("alice@test.com", "month");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/ipc/stats.ipc.test.ts`
Expected: FAIL — cannot resolve `./stats.ipc`

- [ ] **Step 3: Create stats.ipc.ts**

Create `src/main/ipc/stats.ipc.ts`:

```typescript
import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import type { Timeframe } from "../../shared/stats-types";

export function registerStatsHandlers() {
  ipcMain.handle(IPC.STATS.LEADERBOARD, async (_event, timeframe: Timeframe) => {
    return gitService.getLeaderboard(timeframe);
  });

  ipcMain.handle(IPC.STATS.AUTHOR_DETAIL, async (_event, email: string, timeframe: Timeframe) => {
    return gitService.getAuthorDetail(email, timeframe);
  });
}
```

- [ ] **Step 4: Register in index.ts**

In `src/main/ipc/index.ts`, add import:

```typescript
import { registerStatsHandlers } from "./stats.ipc";
```

Add to `registerAllHandlers()` body:

```typescript
registerStatsHandlers();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/ipc/stats.ipc.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/stats.ipc.ts src/main/ipc/stats.ipc.test.ts src/main/ipc/index.ts
git commit -m "feat(stats): add IPC handlers for leaderboard and author detail"
```

---

## Task 5: Preload Bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add stats API to preload bridge**

In `src/preload/index.ts`, add a `stats` section before the `on:` section (before ~line 345). Follow the existing pattern:

```typescript
stats: {
  getLeaderboard: (timeframe: import("../shared/stats-types").Timeframe): Promise<import("../shared/stats-types").LeaderboardEntry[]> =>
    ipcRenderer.invoke(IPC.STATS.LEADERBOARD, timeframe),
  getAuthorDetail: (email: string, timeframe: import("../shared/stats-types").Timeframe): Promise<import("../shared/stats-types").AuthorDetail> =>
    ipcRenderer.invoke(IPC.STATS.AUTHOR_DETAIL, email, timeframe),
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(stats): expose stats API in preload bridge"
```

---

## Task 6: Zustand Store

**Files:**
- Create: `src/renderer/store/stats-store.ts`
- Create: `src/renderer/store/stats-store.test.ts`

- [ ] **Step 1: Write failing tests for stats store**

Create `src/renderer/store/stats-store.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetLeaderboard = vi.fn();
const mockGetAuthorDetail = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    stats: {
      getLeaderboard: mockGetLeaderboard,
      getAuthorDetail: mockGetAuthorDetail,
    },
  },
});

import { useStatsStore } from "./stats-store";

describe("stats-store", () => {
  beforeEach(() => {
    useStatsStore.getState().reset();
    mockGetLeaderboard.mockClear();
    mockGetAuthorDetail.mockClear();
  });

  it("should have correct initial state", () => {
    const state = useStatsStore.getState();
    expect(state.leaderboard).toEqual([]);
    expect(state.selectedAuthor).toBeNull();
    expect(state.timeframe).toBe("all");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.sortField).toBe("commits");
    expect(state.sortDirection).toBe("desc");
  });

  it("should load leaderboard and set loading states", async () => {
    const mockData = [
      { authorName: "Alice", commits: 10, rank: 1 },
      { authorName: "Bob", commits: 5, rank: 2 },
    ];
    mockGetLeaderboard.mockResolvedValue(mockData);

    const promise = useStatsStore.getState().loadLeaderboard("all");
    expect(useStatsStore.getState().loading).toBe(true);

    await promise;
    expect(useStatsStore.getState().loading).toBe(false);
    expect(useStatsStore.getState().leaderboard).toEqual(mockData);
    expect(useStatsStore.getState().error).toBeNull();
  });

  it("should set error on leaderboard load failure", async () => {
    mockGetLeaderboard.mockRejectedValue(new Error("git failed"));

    await useStatsStore.getState().loadLeaderboard("all");
    expect(useStatsStore.getState().loading).toBe(false);
    expect(useStatsStore.getState().error).toBe("git failed");
  });

  it("should load author detail", async () => {
    const mockDetail = { authorEmail: "a@b.com", linesAdded: 100 };
    mockGetAuthorDetail.mockResolvedValue(mockDetail);

    await useStatsStore.getState().loadAuthorDetail("a@b.com");
    expect(useStatsStore.getState().selectedAuthor).toEqual(mockDetail);
    expect(useStatsStore.getState().selectedEmail).toBe("a@b.com");
  });

  it("should change timeframe and reload", async () => {
    mockGetLeaderboard.mockResolvedValue([]);
    useStatsStore.getState().setTimeframe("week");
    expect(useStatsStore.getState().timeframe).toBe("week");
  });

  it("should toggle sort field and direction", () => {
    const store = useStatsStore.getState();
    store.setSortField("linesAdded");
    expect(useStatsStore.getState().sortField).toBe("linesAdded");
    expect(useStatsStore.getState().sortDirection).toBe("desc");

    // Toggle same field reverses direction
    useStatsStore.getState().setSortField("linesAdded");
    expect(useStatsStore.getState().sortDirection).toBe("asc");
  });

  it("should clear selection", () => {
    useStatsStore.setState({ selectedEmail: "a@b.com", selectedAuthor: {} as any });
    useStatsStore.getState().clearSelection();
    expect(useStatsStore.getState().selectedEmail).toBeNull();
    expect(useStatsStore.getState().selectedAuthor).toBeNull();
  });

  it("should reset all state", () => {
    useStatsStore.setState({
      leaderboard: [{ rank: 1 }] as any,
      selectedEmail: "a@b.com",
      timeframe: "week",
      error: "fail",
    });
    useStatsStore.getState().reset();
    expect(useStatsStore.getState().leaderboard).toEqual([]);
    expect(useStatsStore.getState().timeframe).toBe("all");
    expect(useStatsStore.getState().error).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/store/stats-store.test.ts`
Expected: FAIL — cannot resolve `./stats-store`

- [ ] **Step 3: Implement stats store**

Create `src/renderer/store/stats-store.ts`:

```typescript
import { create } from "zustand";
import type { LeaderboardEntry, AuthorDetail, Timeframe } from "../../shared/stats-types";

interface StatsState {
  leaderboard: LeaderboardEntry[];
  selectedAuthor: AuthorDetail | null;
  selectedEmail: string | null;
  timeframe: Timeframe;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  detailError: string | null;
  sortField: "commits" | "linesAdded" | "linesRemoved" | "longestStreak";
  sortDirection: "asc" | "desc";
  loadLeaderboard: (timeframe: Timeframe) => Promise<void>;
  loadAuthorDetail: (email: string) => Promise<void>;
  setTimeframe: (tf: Timeframe) => void;
  setSortField: (field: StatsState["sortField"]) => void;
  clearSelection: () => void;
  reset: () => void;
}

const initialState = {
  leaderboard: [] as LeaderboardEntry[],
  selectedAuthor: null as AuthorDetail | null,
  selectedEmail: null as string | null,
  timeframe: "all" as Timeframe,
  loading: false,
  detailLoading: false,
  error: null as string | null,
  detailError: null as string | null,
  sortField: "commits" as StatsState["sortField"],
  sortDirection: "desc" as StatsState["sortDirection"],
};

export const useStatsStore = create<StatsState>((set, get) => ({
  ...initialState,

  loadLeaderboard: async (timeframe: Timeframe) => {
    set({ loading: true, error: null });
    try {
      const leaderboard = await window.electronAPI.stats.getLeaderboard(timeframe);
      set({ leaderboard, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e.message || "Failed to load stats" });
    }
  },

  loadAuthorDetail: async (email: string) => {
    set({ detailLoading: true, detailError: null, selectedEmail: email });
    try {
      const detail = await window.electronAPI.stats.getAuthorDetail(email, get().timeframe);
      set({ selectedAuthor: detail, detailLoading: false });
    } catch (e: any) {
      set({ detailLoading: false, detailError: e.message || "Failed to load detail" });
    }
  },

  setTimeframe: (tf: Timeframe) => {
    set({ timeframe: tf, selectedAuthor: null, selectedEmail: null });
  },

  setSortField: (field: StatsState["sortField"]) => {
    const state = get();
    if (state.sortField === field) {
      set({ sortDirection: state.sortDirection === "desc" ? "asc" : "desc" });
    } else {
      set({ sortField: field, sortDirection: "desc" });
    }
  },

  clearSelection: () => {
    set({ selectedAuthor: null, selectedEmail: null, detailError: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/store/stats-store.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store/stats-store.ts src/renderer/store/stats-store.test.ts
git commit -m "feat(stats): add Zustand store for stats panel state management"
```

---

## Task 7: Sparkline Component

**Files:**
- Create: `src/renderer/components/stats/Sparkline.tsx`

- [ ] **Step 1: Create Sparkline SVG component**

Create `src/renderer/components/stats/Sparkline.tsx`:

```typescript
import React from "react";

interface SparklineProps {
  data: { date: string; count: number }[];
  teamData?: { date: string; count: number }[];
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  teamData,
  width = 400,
  height = 80,
}) => {
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 11 }}>No data</div>;

  const maxCount = Math.max(...data.map((d) => d.count), ...(teamData || []).map((d) => d.count), 1);
  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const toPoints = (series: { date: string; count: number }[]) =>
    series.map((d, i) => {
      const x = padding + (i / Math.max(series.length - 1, 1)) * innerW;
      const y = padding + innerH - (d.count / maxCount) * innerH;
      return `${x},${y}`;
    }).join(" ");

  const authorPoints = toPoints(data);
  const fillPoints = `${padding},${padding + innerH} ${authorPoints} ${padding + innerW},${padding + innerH}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#sparkFill)" />
      <polyline
        points={authorPoints}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {teamData && teamData.length > 0 && (
        <polyline
          points={toPoints(teamData)}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="4,3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/stats/Sparkline.tsx
git commit -m "feat(stats): add Sparkline SVG component"
```

---

## Task 8: ActivityHeatmap Component

**Files:**
- Create: `src/renderer/components/stats/ActivityHeatmap.tsx`

- [ ] **Step 1: Create ActivityHeatmap component**

Create `src/renderer/components/stats/ActivityHeatmap.tsx`:

```typescript
import React from "react";

interface ActivityHeatmapProps {
  hourlyDistribution: number[];
  dailyDistribution: number[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  hourlyDistribution,
  dailyDistribution,
}) => {
  const hourMax = Math.max(...hourlyDistribution, 1);
  const dayMax = Math.max(...dailyDistribution, 1);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hourTicks = [0, 6, 12, 18];

  const cellColor = (value: number, max: number) => {
    const intensity = value / max;
    return `rgba(147, 187, 255, ${intensity * 0.8 + 0.05})`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Hours</div>
        <div style={{ display: "flex", gap: 1 }}>
          {hourlyDistribution.map((count, h) => (
            <div
              key={h}
              title={`${h}:00 — ${count} commits`}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                backgroundColor: count === 0 ? "var(--surface-2)" : cellColor(count, hourMax),
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 1, marginTop: 2 }}>
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              style={{
                width: 14,
                textAlign: "center",
                fontSize: 8,
                color: "var(--text-muted)",
              }}
            >
              {hourTicks.includes(h) ? h : ""}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Days</div>
        <div style={{ display: "flex", gap: 2 }}>
          {dailyDistribution.map((count, d) => (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div
                title={`${dayLabels[d]} — ${count} commits`}
                style={{
                  width: 28,
                  height: 14,
                  borderRadius: 2,
                  backgroundColor: count === 0 ? "var(--surface-2)" : cellColor(count, dayMax),
                }}
              />
              <div style={{ fontSize: 8, color: "var(--text-muted)" }}>{dayLabels[d]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/stats/ActivityHeatmap.tsx
git commit -m "feat(stats): add ActivityHeatmap component"
```

---

## Task 9: AuthorDetailExpander Component

**Files:**
- Create: `src/renderer/components/stats/AuthorDetailExpander.tsx`

- [ ] **Step 1: Create AuthorDetailExpander component**

Create `src/renderer/components/stats/AuthorDetailExpander.tsx`:

```typescript
import React from "react";
import type { AuthorDetail } from "../../../shared/stats-types";
import { Sparkline } from "./Sparkline";
import { ActivityHeatmap } from "./ActivityHeatmap";

interface AuthorDetailExpanderProps {
  detail: AuthorDetail | null;
  teamTimeline?: { date: string; count: number }[];
  loading?: boolean;
  error?: string | null;
}

const formatNumber = (n: number): string => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD
};

export const AuthorDetailExpander: React.FC<AuthorDetailExpanderProps> = ({
  detail,
  teamTimeline,
  loading,
  error,
}) => {
  if (loading || !detail) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Loading author details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "var(--red)", fontSize: 12 }}>
        {error}
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface-1)",
    borderRadius: 6,
    padding: 12,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: 8,
  };

  const statGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 16px",
    fontSize: 12,
  };

  const statLabel: React.CSSProperties = { color: "var(--text-muted)" };
  const statValue: React.CSSProperties = { color: "var(--text-primary)", fontFamily: "monospace" };

  return (
    <div style={{
      padding: "12px 16px",
      borderTop: "1px solid var(--border-subtle)",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--surface-0)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Sparkline */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Commit Activity</div>
        <Sparkline data={detail.commitTimeline} teamData={teamTimeline} />
      </div>

      {/* Heatmap + Top Files */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <div style={labelStyle}>Activity Pattern</div>
          <ActivityHeatmap
            hourlyDistribution={detail.hourlyDistribution}
            dailyDistribution={detail.dailyDistribution}
          />
        </div>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <div style={labelStyle}>Top Files</div>
          <div style={{ fontSize: 11 }}>
            {detail.topFiles.map((f) => (
              <div
                key={f.path}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 0",
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {f.path}
                </span>
                <span style={{ marginLeft: 8, fontFamily: "monospace", color: "var(--text-muted)" }}>
                  {f.changes}
                </span>
              </div>
            ))}
            {detail.topFiles.length === 0 && (
              <div style={{ color: "var(--text-muted)" }}>No file data</div>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Summary</div>
        <div style={statGrid}>
          <span style={statLabel}>Avg commit size</span>
          <span style={statValue}>{Math.round(detail.avgCommitSize)} lines</span>
          <span style={statLabel}>Lines added</span>
          <span style={{ ...statValue, color: "var(--green)" }}>+{formatNumber(detail.linesAdded)}</span>
          <span style={statLabel}>Lines removed</span>
          <span style={{ ...statValue, color: "var(--red)" }}>-{formatNumber(detail.linesRemoved)}</span>
          <span style={statLabel}>Longest streak</span>
          <span style={statValue}>{detail.longestStreak}d</span>
          <span style={statLabel}>Current streak</span>
          <span style={statValue}>{detail.currentStreak}d</span>
          <span style={statLabel}>First commit</span>
          <span style={statValue}>{formatDate(detail.firstCommitDate)}</span>
          <span style={statLabel}>Last commit</span>
          <span style={statValue}>{formatDate(detail.lastCommitDate)}</span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/stats/AuthorDetailExpander.tsx
git commit -m "feat(stats): add AuthorDetailExpander component"
```

---

## Task 10: StatsPanel Component

**Files:**
- Create: `src/renderer/components/stats/StatsPanel.tsx`
- Create: `src/renderer/components/stats/StatsPanel.test.tsx`

- [ ] **Step 1: Write failing tests for StatsPanel**

Create `src/renderer/components/stats/StatsPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetLeaderboard = vi.fn();
const mockGetAuthorDetail = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    stats: {
      getLeaderboard: mockGetLeaderboard,
      getAuthorDetail: mockGetAuthorDetail,
    },
    on: {
      repoChanged: vi.fn(() => () => {}),
    },
  },
});

import { StatsPanel } from "./StatsPanel";
import { useStatsStore } from "../../store/stats-store";

const mockLeaderboard = [
  {
    authorName: "Alice",
    authorEmail: "alice@test.com",
    gravatarHash: "abc",
    commits: 50,
    linesAdded: 5000,
    linesRemoved: 1000,
    firstCommitDate: "2026-01-01T00:00:00Z",
    lastCommitDate: "2026-03-15T00:00:00Z",
    longestStreak: 15,
    rank: 1,
  },
  {
    authorName: "Bob",
    authorEmail: "bob@test.com",
    gravatarHash: "def",
    commits: 30,
    linesAdded: 3000,
    linesRemoved: 500,
    firstCommitDate: "2026-02-01T00:00:00Z",
    lastCommitDate: "2026-03-14T00:00:00Z",
    longestStreak: 10,
    rank: 2,
  },
];

describe("StatsPanel", () => {
  beforeEach(() => {
    useStatsStore.getState().reset();
    mockGetLeaderboard.mockClear();
    mockGetAuthorDetail.mockClear();
  });

  it("should show loading state", () => {
    useStatsStore.setState({ loading: true });
    render(<StatsPanel />);
    expect(screen.getByText("Loading statistics...")).toBeInTheDocument();
  });

  it("should show error state with retry button", () => {
    useStatsStore.setState({ error: "git failed" });
    render(<StatsPanel />);
    expect(screen.getByText(/git failed/)).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should render leaderboard rows", () => {
    useStatsStore.setState({ leaderboard: mockLeaderboard });
    render(<StatsPanel />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("should show timeframe buttons", () => {
    render(<StatsPanel />);
    expect(screen.getByText("All Time")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();
  });

  it("should switch timeframe on button click", () => {
    render(<StatsPanel />);
    fireEvent.click(screen.getByText("Week"));
    expect(useStatsStore.getState().timeframe).toBe("week");
  });

  it("should expand author detail on row click", async () => {
    const mockDetail = {
      authorEmail: "alice@test.com",
      commitTimeline: [],
      topFiles: [],
      hourlyDistribution: new Array(24).fill(0),
      dailyDistribution: new Array(7).fill(0),
      avgCommitSize: 50,
      linesAdded: 5000,
      linesRemoved: 1000,
      longestStreak: 15,
      currentStreak: 5,
      firstCommitDate: "2026-01-01T00:00:00Z",
      lastCommitDate: "2026-03-15T00:00:00Z",
    };
    mockGetAuthorDetail.mockResolvedValue(mockDetail);
    useStatsStore.setState({ leaderboard: mockLeaderboard });

    render(<StatsPanel />);
    fireEvent.click(screen.getByText("Alice"));

    await waitFor(() => {
      expect(screen.getByText("Commit Activity")).toBeInTheDocument();
    });
  });

  it("should collapse detail when clicking same author again", async () => {
    useStatsStore.setState({
      leaderboard: mockLeaderboard,
      selectedEmail: "alice@test.com",
      selectedAuthor: {
        authorEmail: "alice@test.com",
        commitTimeline: [],
        topFiles: [],
        hourlyDistribution: new Array(24).fill(0),
        dailyDistribution: new Array(7).fill(0),
      } as any,
    });

    render(<StatsPanel />);
    fireEvent.click(screen.getByText("Alice"));
    expect(useStatsStore.getState().selectedEmail).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/stats/StatsPanel.test.tsx`
Expected: FAIL — cannot resolve `./StatsPanel`

- [ ] **Step 3: Implement StatsPanel**

Create `src/renderer/components/stats/StatsPanel.tsx`:

```typescript
import React, { useEffect } from "react";
import { useStatsStore } from "../../store/stats-store";
import { useRepoStore } from "../../store/repo-store";
import { AuthorDetailExpander } from "./AuthorDetailExpander";
import type { Timeframe, LeaderboardEntry } from "../../../shared/stats-types";

const formatNumber = (n: number): string => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const timeframes: { label: string; value: Timeframe }[] = [
  { label: "All Time", value: "all" },
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
];

export const StatsPanel: React.FC = () => {
  const {
    leaderboard, selectedAuthor, selectedEmail, timeframe,
    loading, detailLoading, error, detailError,
    sortField, sortDirection,
    loadLeaderboard, loadAuthorDetail, setTimeframe, setSortField,
    clearSelection, reset,
  } = useStatsStore();
  const repo = useRepoStore((s) => s.repo);

  useEffect(() => {
    if (repo) loadLeaderboard(timeframe);
  }, [repo?.path]);

  useEffect(() => {
    const unsub = window.electronAPI?.on?.repoChanged?.(() => reset());
    return () => unsub?.();
  }, []);

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    loadLeaderboard(tf);
  };

  const handleRowClick = (entry: LeaderboardEntry) => {
    if (selectedEmail === entry.authorEmail) {
      clearSelection();
    } else {
      loadAuthorDetail(entry.authorEmail);
    }
  };

  const sorted = [...leaderboard].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    return sortDirection === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  const maxCommits = Math.max(...leaderboard.map((e) => e.commits), 1);

  if (!repo) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
        Open a repository to view statistics
      </div>
    );
  }

  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)",
  };

  const segBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", fontSize: 11, fontWeight: active ? 600 : 400,
    border: "1px solid var(--border)",
    background: active ? "var(--accent-dim)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    cursor: "pointer", borderRadius: 4,
  });

  const colHeaderStyle = (field: string): React.CSSProperties => ({
    cursor: "pointer", userSelect: "none" as const,
    color: sortField === field ? "var(--accent)" : "var(--text-muted)",
    fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const,
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--surface-0)" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Author Statistics</span>
          <button
            onClick={() => loadLeaderboard(timeframe)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 14, padding: "2px 4px",
            }}
            title="Refresh"
          >↻</button>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {timeframes.map((tf) => (
            <button key={tf.value} style={segBtnStyle(timeframe === tf.value)} onClick={() => handleTimeframeChange(tf.value)}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: 12 }}>
          Loading statistics...
        </div>
      )}

      {error && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8 }}>
          <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>
          <button
            onClick={() => loadLeaderboard(timeframe)}
            style={{ padding: "4px 12px", fontSize: 11, background: "var(--accent)", color: "var(--surface-0)", border: "none", borderRadius: 4, cursor: "pointer" }}
          >Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Column headers */}
          <div style={{
            display: "flex", alignItems: "center", padding: "6px 12px", gap: 8,
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <span style={{ width: 24, ...colHeaderStyle("rank") }}>#</span>
            <span style={{ width: 24 }} />
            <span style={{ flex: 1, ...colHeaderStyle("authorName") }}>Author</span>
            <span style={{ width: 60, textAlign: "right", ...colHeaderStyle("commits") }} onClick={() => setSortField("commits")}>
              Commits {sortField === "commits" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
            </span>
            <span style={{ width: 90, textAlign: "right", ...colHeaderStyle("linesAdded") }} onClick={() => setSortField("linesAdded")}>
              +/- {sortField === "linesAdded" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
            </span>
            <span style={{ width: 50, textAlign: "right", ...colHeaderStyle("longestStreak") }} onClick={() => setSortField("longestStreak")}>
              Streak {sortField === "longestStreak" ? (sortDirection === "desc" ? "▼" : "▲") : ""}
            </span>
          </div>

          {/* Rows */}
          {sorted.map((entry, idx) => (
            <React.Fragment key={entry.authorEmail}>
              <div
                onClick={() => handleRowClick(entry)}
                style={{
                  display: "flex", alignItems: "center", padding: "6px 12px", gap: 8,
                  cursor: "pointer", position: "relative",
                  background: selectedEmail === entry.authorEmail ? "var(--surface-2)" : "transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {/* Proportional bar */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${(entry.commits / maxCommits) * 100}%`,
                  background: "var(--accent)", opacity: 0.07,
                  borderRadius: 2, pointerEvents: "none",
                }} />
                <span style={{ width: 24, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, position: "relative" }}>
                  {idx + 1}
                </span>
                <img
                  src={`https://www.gravatar.com/avatar/${entry.gravatarHash}?s=24&d=retro`}
                  width={24} height={24}
                  style={{ borderRadius: "50%", position: "relative" }}
                  alt=""
                />
                <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", fontWeight: 500, position: "relative" }}>
                  {entry.authorName}
                </span>
                <span style={{ width: 60, textAlign: "right", fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)", position: "relative" }}>
                  {entry.commits}
                </span>
                <span style={{ width: 90, textAlign: "right", fontSize: 11, fontFamily: "monospace", position: "relative" }}>
                  <span style={{ color: "var(--green)" }}>+{formatNumber(entry.linesAdded)}</span>
                  <span style={{ color: "var(--text-muted)" }}>/</span>
                  <span style={{ color: "var(--red)" }}>-{formatNumber(entry.linesRemoved)}</span>
                </span>
                <span style={{ width: 50, textAlign: "right", fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", position: "relative" }}>
                  {entry.longestStreak}d
                </span>
              </div>

              {/* Expanded detail */}
              {selectedEmail === entry.authorEmail && (
                <AuthorDetailExpander
                  detail={selectedAuthor}
                  loading={detailLoading}
                  error={detailError}
                />
              )}
            </React.Fragment>
          ))}

          {sorted.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No commits found for this timeframe
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/stats/StatsPanel.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/stats/StatsPanel.tsx src/renderer/components/stats/StatsPanel.test.tsx
git commit -m "feat(stats): add StatsPanel component with leaderboard and author detail"
```

---

## Task 11: Register Panel in AppShell

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`

- [ ] **Step 1: Import and register StatsPanel**

In `src/renderer/components/layout/AppShell.tsx`:

Add import (with existing component imports):

```typescript
import { StatsPanel } from "../stats/StatsPanel";
```

Add to `components` record (~line 37, after `console`):

```typescript
stats: () => <StatsPanel />,
```

Add panel registration in the `onReady` callback, after the console panel is added (in the default layout section). Add as a tab within the details group:

```typescript
event.api.addPanel({
  id: "stats",
  component: "stats",
  title: "Statistics",
  position: { referencePanel: "console", direction: "within" },
});
```

Also add a migration block for existing saved layouts (similar to the commitInfo migration pattern at ~line 159):

```typescript
if (!event.api.getPanel("stats")) {
  const consolePanel = event.api.getPanel("console");
  if (consolePanel) {
    event.api.addPanel({
      id: "stats",
      component: "stats",
      title: "Statistics",
      position: { referencePanel: consolePanel, direction: "within" },
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx
git commit -m "feat(stats): register StatsPanel in AppShell dockview layout"
```

---

## Task 12: Full Integration Test

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing 292+ new tests)

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `npx eslint src/`
Expected: No new errors (existing warnings OK)

- [ ] **Step 4: Manual smoke test**

Run: `npm start`
Verify:
- Stats tab appears in details panel group
- Clicking the tab shows leaderboard (after loading)
- Timeframe buttons switch data
- Clicking an author expands detail
- Clicking again collapses
- Refresh button reloads data
- Column headers sort leaderboard

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git commit -m "fix(stats): address integration issues"
```
