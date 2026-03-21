// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { PrDialog } from "./PrDialog";

const mockDetectProvider = vi.fn();
const mockListPrs = vi.fn();
const mockViewPr = vi.fn();
const mockCreatePr = vi.fn();
const mockOpenExternal = vi.fn();

vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: unknown) => unknown) => {
    const state = { repo: { path: "/test", currentBranch: "feature-branch" } };
    return selector ? selector(state) : state;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    pr: {
      detectProvider: mockDetectProvider,
      list: mockListPrs,
      view: mockViewPr,
      create: mockCreatePr,
    },
    repo: {
      openExternal: mockOpenExternal,
    },
  };
});

describe("PrDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  it("shows PR list from GitHub", async () => {
    mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "user", repo: "test", baseUrl: "https://github.com" });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 1,
        title: "Add feature X",
        state: "open",
        author: "dev",
        url: "https://github.com/user/test/pull/1",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "feature-x",
        targetBranch: "main",
        labels: [],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add feature X")).toBeInTheDocument();
    });
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("shows empty state when no PRs", async () => {
    mockDetectProvider.mockResolvedValueOnce({ provider: "github", owner: "user", repo: "test", baseUrl: "https://github.com" });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No Pull Requests found")).toBeInTheDocument();
    });
  });

  it("shows unknown provider warning", async () => {
    mockDetectProvider.mockResolvedValueOnce({ provider: "unknown", owner: "", repo: "", baseUrl: "" });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Could not detect GitHub or GitLab/)).toBeInTheDocument();
    });
  });

  it("shows GitLab MR labels", async () => {
    mockDetectProvider.mockResolvedValueOnce({ provider: "gitlab", owner: "user", repo: "test", baseUrl: "https://gitlab.com" });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 5,
        title: "Fix bug Y",
        state: "opened",
        author: "dev2",
        url: "https://gitlab.com/user/test/-/merge_requests/5",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "fix-y",
        targetBranch: "main",
        labels: ["bug", "critical"],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Fix bug Y")).toBeInTheDocument();
    });
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });
});
