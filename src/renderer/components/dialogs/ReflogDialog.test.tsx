// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ReflogDialog } from "./ReflogDialog";
import type { ReflogEntry } from "../../../shared/git-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "reflog.title": "Git Reflog",
        "reflog.filterPlaceholder": "Filter reflog entries...",
        "reflog.entry": "entry",
        "reflog.entries": "entries",
        "reflog.clickToNavigate": "Click a row to navigate to that commit",
        "reflog.noEntriesFound": "No reflog entries found",
        "reflog.noEntriesMatchFilter": "No entries match the filter",
        "dialogs.loading": "Loading...",
      };
      return translations[key] || key;
    },
  }),
}));

const mockEntries: ReflogEntry[] = [
  {
    hash: "abc123full",
    abbreviatedHash: "abc123f",
    selector: "HEAD@{0}",
    action: "commit",
    subject: "feat: add new feature",
    date: "2026-03-21 10:00:00 +0100",
  },
  {
    hash: "def456full",
    abbreviatedHash: "def456f",
    selector: "HEAD@{1}",
    action: "checkout: moving from main to feature",
    subject: "checkout: moving from main to feature",
    date: "2026-03-20 15:30:00 +0100",
  },
  {
    hash: "ghi789full",
    abbreviatedHash: "ghi789f",
    selector: "HEAD@{2}",
    action: "reset: moving to HEAD~1",
    subject: "reset: moving to HEAD~1",
    date: "2026-03-19 09:00:00 +0100",
  },
];

const reflogListMock = vi.fn().mockResolvedValue(mockEntries);
const selectCommitMock = vi.fn();

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    selectCommit: selectCommitMock,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    reflog: {
      list: reflogListMock,
    },
  };
});

describe("ReflogDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ReflogDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("fetches and displays reflog entries when opened", async () => {
    render(<ReflogDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(reflogListMock).toHaveBeenCalledWith(200);
    });

    expect(screen.getByText("HEAD@{0}")).toBeInTheDocument();
    expect(screen.getByText("abc123f")).toBeInTheDocument();
    expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    expect(screen.getByText("HEAD@{1}")).toBeInTheDocument();
    expect(screen.getByText("HEAD@{2}")).toBeInTheDocument();
    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });

  it("filters entries by search query", async () => {
    render(<ReflogDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("HEAD@{0}")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Filter reflog entries...");
    fireEvent.change(input, { target: { value: "checkout" } });

    // Only HEAD@{1} should remain (checkout action)
    expect(screen.queryByText("HEAD@{0}")).not.toBeInTheDocument();
    expect(screen.getByText("HEAD@{1}")).toBeInTheDocument();
    expect(screen.queryByText("HEAD@{2}")).not.toBeInTheDocument();
    expect(screen.getByText("1 entry")).toBeInTheDocument();
  });

  it("navigates to commit and closes on row click", async () => {
    const onClose = vi.fn();
    render(<ReflogDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("HEAD@{0}")).toBeInTheDocument();
    });

    // Click on the first entry row
    fireEvent.click(screen.getByText("feat: add new feature"));

    expect(selectCommitMock).toHaveBeenCalledWith("abc123full");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows empty state when no entries found", async () => {
    reflogListMock.mockResolvedValueOnce([]);
    render(<ReflogDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No reflog entries found")).toBeInTheDocument();
    });
  });

  it("shows no-match message when filter has no results", async () => {
    render(<ReflogDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("HEAD@{0}")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Filter reflog entries...");
    fireEvent.change(input, { target: { value: "nonexistent" } });

    expect(screen.getByText("No entries match the filter")).toBeInTheDocument();
  });
});
