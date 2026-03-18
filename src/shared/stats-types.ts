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
