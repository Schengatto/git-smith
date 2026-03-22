import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CodebaseStats } from "../../shared/codebase-stats-types";

const mockGetCodebaseStats = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    stats: {
      getCodebaseStats: mockGetCodebaseStats,
    },
  },
});

import { useCodebaseStatsStore } from "./codebase-stats-store";

const makeStats = (): CodebaseStats => ({
  totalLines: 10000,
  totalFiles: 120,
  languageCount: 5,
  byLanguage: [
    { language: "TypeScript", lines: 8000, files: 100, percentage: 80, color: "#3178c6" },
    { language: "CSS", lines: 2000, files: 20, percentage: 20, color: "#563d7c" },
  ],
  byType: [
    { type: "source", lines: 7000, files: 90, color: "#4ec9b0" },
    { type: "test", lines: 1000, files: 10, color: "#dcdcaa" },
    { type: "config", lines: 2000, files: 20, color: "#569cd6" },
  ],
  testRatio: {
    sourceLines: 7000,
    testLines: 1000,
    ratio: 0.143,
    percentage: 14.3,
  },
});

const resetStore = () => {
  useCodebaseStatsStore.setState({ stats: null, loading: false, error: null });
};

describe("codebase-stats-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("initial state", () => {
    it("stats is null", () => {
      expect(useCodebaseStatsStore.getState().stats).toBeNull();
    });

    it("loading is false", () => {
      expect(useCodebaseStatsStore.getState().loading).toBe(false);
    });

    it("error is null", () => {
      expect(useCodebaseStatsStore.getState().error).toBeNull();
    });
  });

  describe("loadStats", () => {
    it("calls stats.getCodebaseStats once", async () => {
      mockGetCodebaseStats.mockResolvedValue(makeStats());
      await useCodebaseStatsStore.getState().loadStats();
      expect(mockGetCodebaseStats).toHaveBeenCalledOnce();
    });

    it("sets stats on success", async () => {
      const stats = makeStats();
      mockGetCodebaseStats.mockResolvedValue(stats);
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().stats).toEqual(stats);
    });

    it("sets loading to false after success", async () => {
      mockGetCodebaseStats.mockResolvedValue(makeStats());
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().loading).toBe(false);
    });

    it("clears error on success", async () => {
      useCodebaseStatsStore.setState({ error: "previous error" });
      mockGetCodebaseStats.mockResolvedValue(makeStats());
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().error).toBeNull();
    });

    it("sets loading to true while fetching", async () => {
      let resolve!: (v: CodebaseStats) => void;
      mockGetCodebaseStats.mockImplementation(
        () =>
          new Promise<CodebaseStats>((r) => {
            resolve = r;
          })
      );
      const promise = useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().loading).toBe(true);
      resolve(makeStats());
      await promise;
    });

    it("sets error message on failure", async () => {
      mockGetCodebaseStats.mockRejectedValue(new Error("analysis failed"));
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().error).toBe("analysis failed");
    });

    it("sets loading to false on failure", async () => {
      mockGetCodebaseStats.mockRejectedValue(new Error("fail"));
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().loading).toBe(false);
    });

    it("leaves stats null on failure", async () => {
      mockGetCodebaseStats.mockRejectedValue(new Error("fail"));
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().stats).toBeNull();
    });

    it("converts non-Error thrown values to string for the error field", async () => {
      mockGetCodebaseStats.mockRejectedValue("string error");
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().error).toBe("string error");
    });

    it("stores all language stats correctly", async () => {
      const stats = makeStats();
      mockGetCodebaseStats.mockResolvedValue(stats);
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().stats?.byLanguage).toHaveLength(2);
      expect(useCodebaseStatsStore.getState().stats?.byLanguage[0]!.language).toBe(
        "TypeScript"
      );
    });

    it("stores test ratio correctly", async () => {
      const stats = makeStats();
      mockGetCodebaseStats.mockResolvedValue(stats);
      await useCodebaseStatsStore.getState().loadStats();
      expect(useCodebaseStatsStore.getState().stats?.testRatio.percentage).toBe(14.3);
    });
  });

  describe("reset", () => {
    it("clears stats, loading and error", async () => {
      const stats = makeStats();
      mockGetCodebaseStats.mockResolvedValue(stats);
      await useCodebaseStatsStore.getState().loadStats();
      useCodebaseStatsStore.getState().reset();
      const state = useCodebaseStatsStore.getState();
      expect(state.stats).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("is a no-op when already in initial state", () => {
      useCodebaseStatsStore.getState().reset();
      expect(useCodebaseStatsStore.getState().stats).toBeNull();
      expect(useCodebaseStatsStore.getState().loading).toBe(false);
      expect(useCodebaseStatsStore.getState().error).toBeNull();
    });
  });
});
