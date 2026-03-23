// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodebaseStatsPanel } from "./CodebaseStatsPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const mockLoadStats = vi.fn();
const mockReset = vi.fn();
let mockStatsState: Record<string, unknown> = {};
let mockRepo: { path: string } | null = { path: "/test/repo" };

vi.mock("../../store/codebase-stats-store", () => ({
  useCodebaseStatsStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockStatsState) : mockStatsState,
}));
vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector({ repo: mockRepo }) : { repo: mockRepo },
}));

describe("CodebaseStatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = { path: "/test/repo" };
    mockStatsState = {
      stats: null,
      loading: false,
      error: null,
      loadStats: mockLoadStats,
      reset: mockReset,
    };
  });

  it("shows loading spinner when loading", () => {
    mockStatsState.loading = true;
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("shows error message with retry", () => {
    mockStatsState.error = "Something went wrong";
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/retry/i)).toBeTruthy();
  });

  it("shows no-repo message when no repo", () => {
    mockRepo = null;
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/codebaseStats.openRepoToSee/i)).toBeTruthy();
  });

  it("renders stats when data is available", () => {
    mockStatsState.stats = {
      totalLines: 15000,
      totalFiles: 120,
      languageCount: 4,
      byLanguage: [
        { language: "TypeScript", lines: 10000, files: 80, percentage: 66.7, color: "#89b4fa" },
        { language: "CSS", lines: 3000, files: 20, percentage: 20.0, color: "#f38ba8" },
      ],
      byType: [
        { type: "source", lines: 10000, files: 80, color: "#89b4fa" },
        { type: "test", lines: 3000, files: 30, color: "#a6e3a1" },
      ],
      testRatio: { sourceLines: 10000, testLines: 3000, ratio: 0.3, percentage: 23.1 },
    };
    render(<CodebaseStatsPanel />);
    // toLocaleString() output is locale-dependent, so match the formatted number
    const formattedTotal = (15000).toLocaleString();
    expect(screen.getByText(formattedTotal)).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("CSS")).toBeTruthy();
  });
});
