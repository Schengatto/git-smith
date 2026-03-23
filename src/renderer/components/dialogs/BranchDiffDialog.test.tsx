// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BranchDiffDialog } from "./BranchDiffDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "branchDiff.title": "Branch Diff",
        "branchDiff.from": "From",
        "branchDiff.to": "To",
        "branchDiff.swapBranches": "Swap branches",
        "branchDiff.compare": "Compare",
        "branchDiff.noDifferences": "No differences between these branches",
        "branchDiff.selectBranchesAndCompare": "Select two branches and press Compare",
      };
      if (key === "branchDiff.filesChanged" && opts) {
        return `${opts.count} file(s) changed`;
      }
      return translations[key] ?? key;
    },
  }),
}));

const mockElectronAPI = {
  branch: {
    list: vi.fn().mockResolvedValue([]),
  },
  diffBranches: {
    compare: vi.fn().mockResolvedValue({
      files: [],
      stats: { filesChanged: 0, additions: 0, deletions: 0 },
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("BranchDiffDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<BranchDiffDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Branch Diff")).toBeInTheDocument();
  });

  it("shows From and To labels", () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("shows Compare button", () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Compare")).toBeInTheDocument();
  });

  it("shows swap button", () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByTitle("Swap branches")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<BranchDiffDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty state prompt before first compare", async () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Select two branches and press Compare")).toBeInTheDocument();
    });
  });

  it("loads branch list on open", async () => {
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.branch.list).toHaveBeenCalledTimes(1);
    });
  });

  it("populates selects with branch list", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "feature/foo", current: false },
    ]);
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText("main").length).toBeGreaterThan(0);
      expect(screen.getAllByText("feature/foo").length).toBeGreaterThan(0);
    });
  });

  it("calls compare API when Compare button is clicked", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "feature/foo", current: false },
    ]);
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(mockElectronAPI.diffBranches.compare).toHaveBeenCalled();
    });
  });

  it("shows result stats after compare", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "feature/foo", current: false },
    ]);
    mockElectronAPI.diffBranches.compare.mockResolvedValue({
      files: [],
      stats: { filesChanged: 3, additions: 10, deletions: 2 },
    });
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("3 file(s) changed")).toBeInTheDocument();
    });
  });

  it("shows no differences message when file list is empty after compare", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "feature/foo", current: false },
    ]);
    mockElectronAPI.diffBranches.compare.mockResolvedValue({
      files: [],
      stats: { filesChanged: 0, additions: 0, deletions: 0 },
    });
    render(<BranchDiffDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("No differences between these branches")).toBeInTheDocument();
    });
  });
});
