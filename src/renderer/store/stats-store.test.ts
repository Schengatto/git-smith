import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LeaderboardEntry, AuthorDetail, Timeframe } from "../../shared/stats-types";

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

const mockLeaderboard: LeaderboardEntry[] = [
  {
    authorName: "Alice",
    authorEmail: "alice@example.com",
    gravatarHash: "abc123",
    commits: 42,
    linesAdded: 1000,
    linesRemoved: 200,
    firstCommitDate: "2024-01-01",
    lastCommitDate: "2024-12-31",
    longestStreak: 7,
    rank: 1,
  },
  {
    authorName: "Bob",
    authorEmail: "bob@example.com",
    gravatarHash: "def456",
    commits: 20,
    linesAdded: 500,
    linesRemoved: 100,
    firstCommitDate: "2024-03-01",
    lastCommitDate: "2024-11-30",
    longestStreak: 3,
    rank: 2,
  },
];

const mockDetail: AuthorDetail = {
  authorName: "Alice",
  authorEmail: "alice@example.com",
  commitTimeline: [{ date: "2024-01-01", count: 5 }],
  topFiles: [{ path: "src/main.ts", changes: 30 }],
  hourlyDistribution: Array(24).fill(0).map((_, i) => i < 9 ? 0 : 2),
  dailyDistribution: [1, 3, 4, 4, 3, 2, 1],
  avgCommitSize: 20,
  linesAdded: 1000,
  linesRemoved: 200,
  longestStreak: 7,
  currentStreak: 2,
  firstCommitDate: "2024-01-01",
  lastCommitDate: "2024-12-31",
};

const resetStore = () => {
  useStatsStore.setState({
    leaderboard: [],
    selectedAuthor: null,
    selectedEmail: null,
    timeframe: "all",
    loading: false,
    detailLoading: false,
    error: null,
    detailError: null,
    sortField: "commits",
    sortDirection: "desc",
  });
};

describe("stats-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("loadLeaderboard", () => {
    it("sets loading true while fetching", async () => {
      mockGetLeaderboard.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockLeaderboard), 100))
      );
      const promise = useStatsStore.getState().loadLeaderboard("all");
      expect(useStatsStore.getState().loading).toBe(true);
      await promise;
    });

    it("populates leaderboard on success", async () => {
      mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
      await useStatsStore.getState().loadLeaderboard("all");
      expect(useStatsStore.getState().leaderboard).toEqual(mockLeaderboard);
      expect(useStatsStore.getState().loading).toBe(false);
      expect(useStatsStore.getState().error).toBeNull();
    });

    it("passes timeframe to the API", async () => {
      mockGetLeaderboard.mockResolvedValue([]);
      await useStatsStore.getState().loadLeaderboard("month");
      expect(mockGetLeaderboard).toHaveBeenCalledWith("month");
    });

    it("sets error on failure", async () => {
      mockGetLeaderboard.mockRejectedValue(new Error("git failure"));
      await useStatsStore.getState().loadLeaderboard("all");
      expect(useStatsStore.getState().error).toBe("git failure");
      expect(useStatsStore.getState().loading).toBe(false);
    });
  });

  describe("loadAuthorDetail", () => {
    it("sets detailLoading true while fetching", async () => {
      mockGetAuthorDetail.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDetail), 100))
      );
      const promise = useStatsStore.getState().loadAuthorDetail("alice@example.com");
      expect(useStatsStore.getState().detailLoading).toBe(true);
      await promise;
    });

    it("populates selectedAuthor on success", async () => {
      mockGetAuthorDetail.mockResolvedValue(mockDetail);
      await useStatsStore.getState().loadAuthorDetail("alice@example.com");
      expect(useStatsStore.getState().selectedAuthor).toEqual(mockDetail);
      expect(useStatsStore.getState().selectedEmail).toBe("alice@example.com");
      expect(useStatsStore.getState().detailLoading).toBe(false);
      expect(useStatsStore.getState().detailError).toBeNull();
    });

    it("sets detailError on failure", async () => {
      mockGetAuthorDetail.mockRejectedValue(new Error("not found"));
      await useStatsStore.getState().loadAuthorDetail("ghost@example.com");
      expect(useStatsStore.getState().detailError).toBe("not found");
      expect(useStatsStore.getState().detailLoading).toBe(false);
    });
  });

  describe("setTimeframe", () => {
    it("updates timeframe state", () => {
      useStatsStore.getState().setTimeframe("week");
      expect(useStatsStore.getState().timeframe).toBe("week");
    });
  });

  describe("setSortField", () => {
    it("sets sort field and defaults to desc", () => {
      useStatsStore.getState().setSortField("linesAdded");
      expect(useStatsStore.getState().sortField).toBe("linesAdded");
      expect(useStatsStore.getState().sortDirection).toBe("desc");
    });

    it("toggles direction when same field is set again", () => {
      useStatsStore.setState({ sortField: "commits", sortDirection: "desc" });
      useStatsStore.getState().setSortField("commits");
      expect(useStatsStore.getState().sortDirection).toBe("asc");
    });

    it("resets direction to desc when switching to a different field", () => {
      useStatsStore.setState({ sortField: "commits", sortDirection: "asc" });
      useStatsStore.getState().setSortField("linesRemoved");
      expect(useStatsStore.getState().sortField).toBe("linesRemoved");
      expect(useStatsStore.getState().sortDirection).toBe("desc");
    });
  });

  describe("clearSelection", () => {
    it("clears selected author and email", async () => {
      mockGetAuthorDetail.mockResolvedValue(mockDetail);
      await useStatsStore.getState().loadAuthorDetail("alice@example.com");
      useStatsStore.getState().clearSelection();
      expect(useStatsStore.getState().selectedAuthor).toBeNull();
      expect(useStatsStore.getState().selectedEmail).toBeNull();
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", async () => {
      mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
      await useStatsStore.getState().loadLeaderboard("week");
      useStatsStore.getState().reset();
      const state = useStatsStore.getState();
      expect(state.leaderboard).toEqual([]);
      expect(state.selectedAuthor).toBeNull();
      expect(state.selectedEmail).toBeNull();
      expect(state.timeframe).toBe("all");
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.sortField).toBe("commits");
      expect(state.sortDirection).toBe("desc");
    });
  });
});
