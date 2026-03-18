# Author Statistics Panel — Design Specification

## Overview

New dockview panel showing commit/author statistics as an analytical dashboard with leaderboard ranking, timeframe filtering (All Time / Month / Week), and expandable author detail with comparative sparkline (author vs team average).

## Architecture

### Approach: Two-level IPC (leaderboard + detail on-demand)

Two separate IPC calls to keep initial load fast and defer heavy computation to user interaction:

1. `STATS.LEADERBOARD` — returns ranked list with base stats for all authors
2. `STATS.AUTHOR_DETAIL` — returns full detail for a single author (on click)

### IPC Channels

```text
IPC.STATS.LEADERBOARD   = "git:stats:leaderboard"   → getLeaderboard(timeframe: 'all' | 'month' | 'week')
IPC.STATS.AUTHOR_DETAIL = "git:stats:author-detail"  → getAuthorDetail(email: string, timeframe: 'all' | 'month' | 'week')
```

## Data Types

### `Timeframe`

```typescript
type Timeframe = 'all' | 'month' | 'week';
```

### `LeaderboardEntry`

```typescript
interface LeaderboardEntry {
  authorName: string;
  authorEmail: string;
  gravatarHash: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  firstCommitDate: string;    // ISO 8601
  lastCommitDate: string;     // ISO 8601
  longestStreak: number;      // consecutive UTC calendar days with commits
  rank: number;
}
```

### `AuthorDetail`

```typescript
// Returned by backend IPC
interface AuthorDetail {
  authorName: string;       // most recent name used with this email
  authorEmail: string;
  // Sparkline: commits grouped by hour (week), day (month), or week (all-time)
  commitTimeline: { date: string; count: number }[];
  // Top 10 most modified files
  topFiles: { path: string; changes: number }[];
  // Hourly distribution (0-23), computed in UTC
  hourlyDistribution: number[];   // 24 elements
  // Day-of-week distribution (0=Sun, 6=Sat), computed in UTC
  dailyDistribution: number[];    // 7 elements
  // Summary stats
  avgCommitSize: number;          // avg lines changed per commit
  linesAdded: number;
  linesRemoved: number;
  longestStreak: number;          // consecutive UTC calendar days
  currentStreak: number;          // streak counting back from today
  firstCommitDate: string;
  lastCommitDate: string;
}

// Computed client-side in Zustand store from leaderboard data
// Used for the sparkline overlay comparison
interface TeamTimeline {
  timeline: { date: string; count: number }[];  // avg commits per time bucket
}
```

## Backend Implementation

### `git-service.ts` — New Methods

#### `getLeaderboard(timeframe: Timeframe): Promise<LeaderboardEntry[]>`

1. Build `--since` flag from timeframe ('week' → 7 days ago, 'month' → 30 days ago, 'all' → no flag)
2. Run `git log --shortstat` with format args passed as array elements to `simple-git` (not shell strings): `['--format=COMMIT_START%n%H%n%an%n%ae%n%aI', '--shortstat', ...]`
3. Parse output: accumulate per-author commits, lines added/removed, dates
4. Compute gravatarHash (MD5 of lowercase email, reuse existing pattern)
5. Compute longest streak per author from commit dates (days computed in UTC — convert author date to UTC before extracting calendar date)
6. Sort by commits descending, assign rank
7. Return `LeaderboardEntry[]`

**Note**: Uses `--shortstat` instead of `--numstat` since the leaderboard only needs per-commit totals, not per-file breakdown. This is significantly faster on large repos.

#### `getAuthorDetail(email: string, timeframe: Timeframe): Promise<AuthorDetail>`

1. Run `git log --numstat` with exact author match: `['--author=^<email>$', '--numstat', '--format=COMMIT_START%n%aI', ...]`. The `^...$` anchors prevent substring matching (e.g., `a@b.com` won't match `ba@b.com`). After parsing, also verify exact email match in code as a safety net.
2. Parse commits: collect dates, file changes, line counts
3. Build `commitTimeline`: group by hour (week timeframe, ~168 points), by day (month, ~30 points), by week (all-time)
4. Build `hourlyDistribution`: extract hour from each commit date (UTC), count per hour
5. Build `dailyDistribution`: extract day-of-week (UTC), count per day
6. Build `topFiles`: aggregate file change counts, sort descending, take top 10
7. Compute `avgCommitSize`: total lines changed / total commits
8. Compute `longestStreak` and `currentStreak` from sorted commit dates (UTC calendar days)
9. Return `AuthorDetail`

**Streak definition**: A streak is counted as consecutive UTC calendar days on which the author has at least one commit. Multiple commits on the same UTC day count as one day. `currentStreak` counts backwards from today (or the last commit date in the timeframe).

**Team timeline approach**: Instead of running a second expensive `git log` for all authors, the renderer computes the team average from the leaderboard data it already has. The `teamTimeline` is populated client-side by the Zustand store, not by the backend. The backend `getAuthorDetail` does NOT return `teamTimeline`.

### IPC Handler (`stats.ipc.ts`)

```typescript
export function registerStatsHandlers() {
  ipcMain.handle(IPC.STATS.LEADERBOARD, async (_event, timeframe: Timeframe) => {
    return gitService.getLeaderboard(timeframe);
  });

  ipcMain.handle(IPC.STATS.AUTHOR_DETAIL, async (_event, email: string, timeframe: Timeframe) => {
    return gitService.getAuthorDetail(email, timeframe);
  });
}
```

### Preload Bridge

```typescript
stats: {
  getLeaderboard: (timeframe: Timeframe) => ipcRenderer.invoke(IPC.STATS.LEADERBOARD, timeframe),
  getAuthorDetail: (email: string, timeframe: Timeframe) => ipcRenderer.invoke(IPC.STATS.AUTHOR_DETAIL, email, timeframe),
}
```

## Frontend Implementation

### Panel Registration

New panel `stats` registered in `AppShell.tsx` components record. Positioned as the last tab within the Details group (after CommandLog and Console). Shown by default in the tab bar but not auto-selected — user clicks to view.

**Repo change handling**: The store listens to `REPO_CHANGED` events and calls `reset()` to clear leaderboard, selected author, and errors. Stats are not auto-loaded on repo change — the user must be on the stats tab and data loads on first view or manual refresh.

### Zustand Store (`stats-store.ts`)

```typescript
interface StatsState {
  leaderboard: LeaderboardEntry[];
  selectedAuthor: AuthorDetail | null;
  selectedEmail: string | null;
  timeframe: Timeframe;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  detailError: string | null;
  sortField: 'commits' | 'linesAdded' | 'linesRemoved' | 'longestStreak';
  sortDirection: 'asc' | 'desc';
  // Actions
  loadLeaderboard: (timeframe: Timeframe) => Promise<void>;
  loadAuthorDetail: (email: string) => Promise<void>;
  setTimeframe: (tf: Timeframe) => void;
  setSortField: (field: StatsState['sortField']) => void;
  clearSelection: () => void;
  reset: () => void;  // called on repo change
}
```

### StatsPanel Layout

```text
┌──────────────────────────────────────────────────┐
│  Author Statistics                    [↻]        │
│  [All Time] [Month] [Week]    ← segmented control│
├──────────────────────────────────────────────────┤
│  #   Avatar  Author        Commits  +/-    Streak│
│  ─────────────────────────────────────────────────│
│  1   (●)     Mario Rossi     342    +12k/-3k  45d│
│  2   (●)     Luca Bianchi    218    +8k/-2k   32d│
│  3   (●)     Anna Verdi      156    +5k/-1k   28d│
│  ...                                             │
└──────────────────────────────────────────────────┘
```

- **Header**: title + refresh button + segmented control for timeframe
- **Table**: scrollable rows with rank, gravatar (24px), author name, commit count, lines +/- (green/red), streak in days
- **Proportional bars**: behind each row, a subtle horizontal bar (opacity 0.15) proportional to commit count relative to top contributor, colored from Catppuccin palette
- **Sorting**: default by commits descending. Clickable column headers (Commits, +/-, Streak) toggle sort field and direction. Sorting is done client-side on the already-loaded leaderboard array — no additional IPC calls. Sort state (`sortField`, `sortDirection`) lives in the Zustand store.
- **Number formatting**: large numbers abbreviated in the component (e.g., 12340 → "12.3k"). Raw `number` types from backend, formatting is purely presentational.

### AuthorDetailExpander Layout

Expands inline below the clicked row with ~200ms max-height transition.

```text
┌──────────────────────────────────────────────────┐
│  1   (●)  Mario Rossi    342   +12k/-3k    45d  │
├──────────────────────────────────────────────────┤
│  ┌─ Commit Activity ──────────────────────────┐  │
│  │  ▂▃▅▇▅▃▂▁▃▅▇█▅▃▂▁▂▃▅▃▂▁▂▃▅▇▅▃  sparkline │  │
│  │  — author (accent)  --- team avg (overlay)  │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ Activity Heatmap ─┐  ┌─ Top Files ────────┐  │
│  │ Hours: ░░▓▓██▓▓░░░  │  │ src/main/foo.ts  87│  │
│  │ Days:  ░▓██▓▓░      │  │ src/renderer/..  63│  │
│  └─────────────────────┘  └────────────────────┘  │
│                                                   │
│  ┌─ Summary ───────────────────────────────────┐  │
│  │ Avg size: 47 lines    │ Longest streak: 45d │  │
│  │ Lines: +12,340/-3,210 │ Current streak: 12d │  │
│  │ First: 2024-01-15     │ Last: 2026-03-17    │  │
│  └─────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  2   (●)  Luca Bianchi   218   +8k/-2k     32d  │
```

### Sparkline Component (`Sparkline.tsx`)

- SVG inline, viewBox proportional to data points
- Author line: solid polyline with gradient fill below, Catppuccin `blue`
- Team average line: dashed polyline in `overlay0` color
- Hover shows tooltip with date + count

### ActivityHeatmap Component (`ActivityHeatmap.tsx`)

- 24 horizontal cells for hours, 7 cells for days of week
- Color intensity: `surface0` (0 commits) → Catppuccin `blue` (max commits)
- Labels: hour ticks (0, 6, 12, 18) and day abbreviations (Mon-Sun)

## Error Handling

- **No repo open**: centered message "Open a repository to view statistics"
- **Git error**: error message with retry button, consistent with app style. Error stored in `error` / `detailError` state fields.
- **Slow detail load**: inline spinner in expanded section, leaderboard stays interactive

## Performance

- **No persistent cache**: stats computed on-demand via git commands
- **Store cache**: results stay in Zustand store until timeframe change or manual refresh
- **Manual refresh**: refresh button in panel header, no auto-refresh
- **Leaderboard uses `--shortstat`**: only per-commit summary totals, not per-file breakdown (much faster)
- **Author detail uses `--numstat`**: per-file breakdown only for the single selected author
- **No second git query for team timeline**: computed client-side from leaderboard data
- **Author limit**: leaderboard shows all authors (typically tens, not thousands), no virtualization needed

## Testing Strategy

| Test file | Coverage |
| --------- | -------- |
| `src/main/git/git-service-stats.test.ts` | `getLeaderboard()` and `getAuthorDetail()` with mocked git output — parsing, aggregation, streak calculation, timeframe filtering |
| `src/main/ipc/stats.ipc.test.ts` | Handler registration and parameter passing |
| `src/renderer/components/stats/StatsPanel.test.tsx` | Render leaderboard, click expand/collapse, timeframe switch, loading/error states |
| `src/renderer/store/stats-store.test.ts` | Actions and state transitions |

## Files to Create/Modify

| File | Action |
| ---- | ------ |
| `src/shared/ipc-channels.ts` | Add `STATS` namespace with `LEADERBOARD`, `AUTHOR_DETAIL` |
| `src/shared/stats-types.ts` | New — `Timeframe`, `LeaderboardEntry`, `AuthorDetail`, `TeamTimeline` types |
| `src/main/git/git-service.ts` | Add `getLeaderboard()`, `getAuthorDetail()` methods |
| `src/main/ipc/stats.ipc.ts` | New — IPC handlers |
| `src/main/ipc/index.ts` | Register stats handlers |
| `src/preload/index.ts` | Expose `stats` API |
| `src/renderer/store/stats-store.ts` | New — Zustand store (includes client-side team timeline computation) |
| `src/renderer/components/stats/StatsPanel.tsx` | New — main panel component |
| `src/renderer/components/stats/AuthorDetailExpander.tsx` | New — expandable detail section |
| `src/renderer/components/stats/Sparkline.tsx` | New — SVG sparkline component |
| `src/renderer/components/stats/ActivityHeatmap.tsx` | New — hourly/daily heatmap |
| `src/renderer/components/layout/AppShell.tsx` | Register `stats` panel |
| + corresponding test files | |
