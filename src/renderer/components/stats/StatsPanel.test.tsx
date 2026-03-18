// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import type { LeaderboardEntry } from "../../../shared/stats-types";

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockGetLeaderboard = vi.fn();
const mockGetAuthorDetail = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).electronAPI = {
    stats: {
      getLeaderboard: mockGetLeaderboard,
      getAuthorDetail: mockGetAuthorDetail,
    },
    on: {
      repoChanged: vi.fn(() => () => {}),
    },
  };
  (window as unknown as Record<string, unknown>).electronAPI =
    (globalThis as unknown as Record<string, unknown>).electronAPI;
});

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------
const mockRepo = {
  path: "/repo",
  name: "test-repo",
  currentBranch: "main",
  headCommit: "abc",
};

vi.mock("../../store/repo-store", () => ({
  useRepoStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { repo: mockRepo };
    return selector ? selector(state) : state;
  }),
}));

// We need to reset the stats store between tests
import { useStatsStore } from "../../store/stats-store";

const resetStats = () => {
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

const mockLeaderboard: LeaderboardEntry[] = [
  {
    authorName: "Alice",
    authorEmail: "alice@example.com",
    gravatarHash: "aaa",
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
    gravatarHash: "bbb",
    commits: 20,
    linesAdded: 500,
    linesRemoved: 100,
    firstCommitDate: "2024-03-01",
    lastCommitDate: "2024-11-30",
    longestStreak: 3,
    rank: 2,
  },
];

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------
import { StatsPanel } from "./StatsPanel";

describe("StatsPanel", () => {
  beforeEach(() => {
    resetStats();
  });

  it("shows loading state while fetching", async () => {
    mockGetLeaderboard.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    render(<StatsPanel />);
    // Trigger load by checking the store state
    useStatsStore.setState({ loading: true });
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  it("renders leaderboard rows when data is available", async () => {
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows rank numbers in leaderboard", async () => {
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("shows commit counts", async () => {
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
    });
  });

  it("shows error state with retry button", async () => {
    mockGetLeaderboard.mockRejectedValue(new Error("network error"));
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("retries loading on retry button click", async () => {
    mockGetLeaderboard
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(mockLeaderboard);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(mockGetLeaderboard).toHaveBeenCalledTimes(2);
  });

  it("switches timeframe when control buttons are clicked", async () => {
    mockGetLeaderboard.mockResolvedValue([]);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledWith("all");
    });
    fireEvent.click(screen.getByRole("button", { name: /month/i }));
    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledWith("month");
    });
    fireEvent.click(screen.getByRole("button", { name: /week/i }));
    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledWith("week");
    });
  });

  it("expands author detail on row click", async () => {
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    mockGetAuthorDetail.mockResolvedValue({
      authorName: "Alice",
      authorEmail: "alice@example.com",
      commitTimeline: [],
      topFiles: [],
      hourlyDistribution: Array(24).fill(0),
      dailyDistribution: Array(7).fill(0),
      avgCommitSize: 10,
      linesAdded: 1000,
      linesRemoved: 200,
      longestStreak: 7,
      currentStreak: 2,
      firstCommitDate: "2024-01-01",
      lastCommitDate: "2024-12-31",
    });
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => {
      expect(mockGetAuthorDetail).toHaveBeenCalledWith("alice@example.com", "all");
    });
  });

  it("collapses detail when same row is clicked again", async () => {
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    mockGetAuthorDetail.mockResolvedValue({
      authorName: "Alice",
      authorEmail: "alice@example.com",
      commitTimeline: [],
      topFiles: [],
      hourlyDistribution: Array(24).fill(0),
      dailyDistribution: Array(7).fill(0),
      avgCommitSize: 10,
      linesAdded: 1000,
      linesRemoved: 200,
      longestStreak: 7,
      currentStreak: 2,
      firstCommitDate: "2024-01-01",
      lastCommitDate: "2024-12-31",
    });
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    // Click to expand
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => {
      expect(useStatsStore.getState().selectedEmail).toBe("alice@example.com");
    });
    // Click again to collapse
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => {
      expect(useStatsStore.getState().selectedEmail).toBeNull();
    });
  });

  it("shows empty state when leaderboard is empty", async () => {
    mockGetLeaderboard.mockResolvedValue([]);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  it("shows Author Statistics title", async () => {
    mockGetLeaderboard.mockResolvedValue([]);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByText("Author Statistics")).toBeInTheDocument();
    });
  });

  it("shows refresh button", async () => {
    mockGetLeaderboard.mockResolvedValue([]);
    render(<StatsPanel />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });
  });
});
