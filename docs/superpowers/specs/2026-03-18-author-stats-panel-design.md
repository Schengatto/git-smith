# Author Statistics Panel — Design Specification

## Overview

New dockview panel showing commit/author statistics as an analytical dashboard with leaderboard ranking, timeframe filtering (All Time / Month / Week), and expandable author detail with comparative sparkline (author vs team average).

## Architecture

### Approach: Two-level IPC (leaderboard + detail on-demand)

Two separate IPC calls to keep initial load fast and defer heavy computation to user interaction:

1. `STATS.LEADERBOARD` — returns ranked list with base stats for all authors
2. `STATS.AUTHOR_DETAIL` — returns full detail for a single author (on click)

### IPC Channels

```
IPC.STATS.LEADERBOARD   → getLeaderboard(timeframe: 'all' | 'month' | 'week')
IPC.STATS.AUTHOR_DETAIL → getAuthorDetail(email: string, timeframe: 'all' | 'month' | 'week')
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
  longestStreak: number;      // consecutive days with commits
  rank: number;
}
```

### `AuthorDetail`

```typescript
interface AuthorDetail {
  authorName: string;
  authorEmail: string;
  // Sparkline: commits per day/week over the timeframe
  commitTimeline: { date: string; count: number }[];
  // Team average timeline for comparison overlay
  teamTimeline: { date: string; count: number }[];
  // Top 10 most modified files
  topFiles: { path: string; changes: number }[];
  // Hourly distribution (0-23)
  hourlyDistribution: number[];   // 24 elements
  // Day-of-week distribution (0=Sun, 6=Sat)
  dailyDistribution: number[];    // 7 elements
  // Summary stats
  avgCommitSize: number;          // avg lines changed per commit
  linesAdded: number;
  linesRemoved: number;
  longestStreak: number;
  currentStreak: number;
  firstCommitDate: string;
  lastCommitDate: string;
}
```

## Backend Implementation

### `git-service.ts` — New Methods

#### `getLeaderboard(timeframe: Timeframe): Promise<LeaderboardEntry[]>`

1. Build `--since` flag from timeframe ('week' → 7 days ago, 'month' → 30 days ago, 'all' → no flag)
2. Run `git log --numstat --format='COMMIT_START%n%H%n%an%n%ae%n%aI' [--since=...]`
3. Parse output: accumulate per-author commits, lines added/removed, dates
4. Compute gravatarHash (MD5 of lowercase email, reuse existing pattern)
5. Compute longest streak per author from commit dates
6. Sort by commits descending, assign rank
7. Return `LeaderboardEntry[]`

#### `getAuthorDetail(email: string, timeframe: Timeframe): Promise<AuthorDetail>`

1. Run `git log --author=<email> --numstat --format='COMMIT_START%n%aI' [--since=...]`
2. Parse commits: collect dates, file changes, line counts
3. Build `commitTimeline`: group by day (week timeframe), by day (month), by week (all-time)
4. Run same query without `--author` for `teamTimeline` (averaged per author count)
5. Build `hourlyDistribution`: extract hour from each commit date, count per hour
6. Build `dailyDistribution`: extract day-of-week, count per day
7. Build `topFiles`: aggregate file change counts, sort descending, take top 10
8. Compute `avgCommitSize`: total lines changed / total commits
9. Compute `longestStreak` and `currentStreak` from sorted commit dates
10. Return `AuthorDetail`

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

New panel `stats` registered in `AppShell.tsx` components record. Positioned as a tab within the Details group (alongside CommandLog and Console).

### Zustand Store (`stats-store.ts`)

```typescript
interface StatsState {
  leaderboard: LeaderboardEntry[];
  selectedAuthor: AuthorDetail | null;
  selectedEmail: string | null;
  timeframe: Timeframe;
  loading: boolean;
  detailLoading: boolean;
  // Actions
  loadLeaderboard: (timeframe: Timeframe) => Promise<void>;
  loadAuthorDetail: (email: string) => Promise<void>;
  setTimeframe: (tf: Timeframe) => void;
  clearSelection: () => void;
}
```

### StatsPanel Layout

```
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
- **Sorting**: default by commit count, clickable column headers to re-sort

### AuthorDetailExpander Layout

Expands inline below the clicked row with ~200ms max-height transition.

```
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
- **Git error**: error message with retry button, consistent with app style
- **Slow detail load**: inline spinner in expanded section, leaderboard stays interactive

## Performance

- **No persistent cache**: stats computed on-demand via git commands
- **Store cache**: results stay in Zustand store until timeframe change or manual refresh
- **Manual refresh**: refresh button in panel header, no auto-refresh
- **Author limit**: leaderboard shows all authors (typically tens, not thousands), no virtualization needed

## Testing Strategy

| Test file | Coverage |
|-----------|----------|
| `src/main/git/git-service-stats.test.ts` | `getLeaderboard()` and `getAuthorDetail()` with mocked git output — parsing, aggregation, streak calculation, timeframe filtering |
| `src/main/ipc/stats.ipc.test.ts` | Handler registration and parameter passing |
| `src/renderer/components/stats/StatsPanel.test.tsx` | Render leaderboard, click expand/collapse, timeframe switch, loading/error states |
| `src/renderer/store/stats-store.test.ts` | Actions and state transitions |

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/shared/ipc-channels.ts` | Add `STATS` namespace with `LEADERBOARD`, `AUTHOR_DETAIL` |
| `src/shared/stats-types.ts` | New — `Timeframe`, `LeaderboardEntry`, `AuthorDetail` types |
| `src/main/git/git-service.ts` | Add `getLeaderboard()`, `getAuthorDetail()` methods |
| `src/main/ipc/stats.ipc.ts` | New — IPC handlers |
| `src/main/ipc/index.ts` | Register stats handlers |
| `src/preload/index.ts` | Expose `stats` API |
| `src/renderer/store/stats-store.ts` | New — Zustand store |
| `src/renderer/components/stats/StatsPanel.tsx` | New — main panel component |
| `src/renderer/components/stats/AuthorDetailExpander.tsx` | New — expandable detail section |
| `src/renderer/components/stats/Sparkline.tsx` | New — SVG sparkline component |
| `src/renderer/components/stats/ActivityHeatmap.tsx` | New — hourly/daily heatmap |
| `src/renderer/components/layout/AppShell.tsx` | Register `stats` panel |
| + corresponding test files | |
