// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BranchCompareDialog } from "./BranchCompareDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "branchCompare.title": "Compare Branch Commit Ranges",
        "branchCompare.branchA": "Branch A",
        "branchCompare.branchB": "Branch B",
        "branchCompare.swapBranches": "Swap branches",
        "branchCompare.comparing": "Comparing...",
        "branchCompare.compare": "Compare",
        "branchCompare.selectBranchesPrompt":
          "Select two branches and click Compare to see exclusive commits.",
        "branchCompare.noExclusiveCommits": "No exclusive commits",
      };
      return translations[key] ?? key;
    },
  }),
}));

const mockElectronAPI = {
  branch: {
    list: vi.fn().mockResolvedValue([]),
  },
  logRange: {
    compare: vi.fn().mockResolvedValue([]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("BranchCompareDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<BranchCompareDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Compare Branch Commit Ranges")).toBeInTheDocument();
  });

  it("shows Branch A and Branch B labels", () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Branch A")).toBeInTheDocument();
    expect(screen.getByText("Branch B")).toBeInTheDocument();
  });

  it("shows Compare button", () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Compare")).toBeInTheDocument();
  });

  it("shows swap button", () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByTitle("Swap branches")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<BranchCompareDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows instruction prompt before first compare", async () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByText("Select two branches and click Compare to see exclusive commits.")
      ).toBeInTheDocument();
    });
  });

  it("loads branch list on open", async () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.branch.list).toHaveBeenCalledTimes(1);
    });
  });

  it("populates selects with branch list", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText("main").length).toBeGreaterThan(0);
      expect(screen.getAllByText("develop").length).toBeGreaterThan(0);
    });
  });

  it("calls logRange compare when Compare is clicked", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(mockElectronAPI.logRange.compare).toHaveBeenCalled();
    });
  });

  it("shows column headers after compare", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getAllByText(/Only in/).length).toBeGreaterThan(0);
    });
  });

  it("shows commits returned by compare", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "aaa111bbb222",
          abbreviatedHash: "aaa111b",
          subject: "feat: exclusive to main",
          authorName: "Alice",
          authorDate: "2024-01-01",
        },
      ])
      .mockResolvedValueOnce([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("feat: exclusive to main")).toBeInTheDocument();
    });
  });

  it("shows No exclusive commits when both sides are empty", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getAllByText("No exclusive commits").length).toBe(2);
    });
  });

  it("shows error when logRange.compare rejects", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockRejectedValue(new Error("Compare failed"));
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("Compare failed")).toBeInTheDocument();
    });
  });

  it("swaps refA and refB when Swap button is clicked", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    const selects = document.querySelectorAll("select");
    const selectA = selects[0] as HTMLSelectElement;
    const selectB = selects[1] as HTMLSelectElement;
    const initialA = selectA.value;
    const initialB = selectB.value;
    fireEvent.click(screen.getByTitle("Swap branches"));
    await waitFor(() => {
      expect(selectA.value).toBe(initialB);
      expect(selectB.value).toBe(initialA);
    });
  });

  it("resets compared state when Branch A is changed", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => screen.getAllByText("No exclusive commits"));
    // Change Branch A
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "develop" } });
    // Results panel should disappear and prompt should return
    await waitFor(() => {
      expect(
        screen.getByText("Select two branches and click Compare to see exclusive commits.")
      ).toBeInTheDocument();
    });
  });

  it("resets compared state when Branch B is changed", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => screen.getAllByText("No exclusive commits"));
    // Change Branch B
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[1]!, { target: { value: "main" } });
    await waitFor(() => {
      expect(
        screen.getByText("Select two branches and click Compare to see exclusive commits.")
      ).toBeInTheDocument();
    });
  });

  it("shows commit author and date in commit rows", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "aaa111bbb222",
          abbreviatedHash: "aaa111b",
          subject: "feat: exclusive to main",
          authorName: "Alice",
          authorDate: "2024-01-01",
        },
      ])
      .mockResolvedValueOnce([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    });
  });

  it("shows abbreviated hash for each commit", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "aaa111bbb222",
          abbreviatedHash: "aaa111b",
          subject: "feat: thing",
          authorName: "Bob",
          authorDate: "2024-02-01",
        },
      ])
      .mockResolvedValueOnce([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("aaa111b")).toBeInTheDocument();
    });
  });

  it("shows commit count badges in column headers", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "a1",
          abbreviatedHash: "a1",
          subject: "c1",
          authorName: "A",
          authorDate: "d1",
        },
        {
          hash: "a2",
          abbreviatedHash: "a2",
          subject: "c2",
          authorName: "A",
          authorDate: "d2",
        },
      ])
      .mockResolvedValueOnce([
        {
          hash: "b1",
          abbreviatedHash: "b1",
          subject: "c3",
          authorName: "B",
          authorDate: "d3",
        },
      ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      const badges = document.querySelectorAll("span");
      const badgeTexts = Array.from(badges).map((b) => b.textContent);
      expect(badgeTexts).toContain("2");
      expect(badgeTexts).toContain("1");
    });
  });

  it("pre-selects current branch as refA when branches load", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "develop", current: false },
      { name: "main", current: true },
      { name: "feature", current: false },
    ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      const selects = document.querySelectorAll("select");
      expect((selects[0] as HTMLSelectElement).value).toBe("main");
    });
  });

  it("handles non-Error rejection in compare gracefully", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockRejectedValue("string error");
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("string error")).toBeInTheDocument();
    });
  });

  it("shows Comparing... text during compare", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    let resolveFn!: (v: unknown[]) => void;
    mockElectronAPI.logRange.compare.mockReturnValue(
      new Promise((res) => {
        resolveFn = res;
      })
    );
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("Comparing...")).toBeInTheDocument();
    });
    resolveFn([]);
  });

  it("Compare button is disabled while loading", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    let resolveFn!: (v: unknown[]) => void;
    mockElectronAPI.logRange.compare.mockReturnValue(
      new Promise((res) => {
        resolveFn = res;
      })
    );
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      const compareBtn = screen.getByText("Comparing...");
      expect((compareBtn as HTMLButtonElement).disabled).toBe(true);
    });
    resolveFn([]);
  });

  it("resets state when dialog is reopened (open toggles false→true)", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    const { rerender } = render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => screen.getAllByText("No exclusive commits"));

    // Close and reopen
    rerender(<BranchCompareDialog open={false} onClose={vi.fn()} />);
    rerender(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByText("Select two branches and click Compare to see exclusive commits.")
      ).toBeInTheDocument();
    });
  });

  it("CommitRow shows hover effect on mouse enter/leave without crash", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "abc1",
          abbreviatedHash: "abc1",
          subject: "hover test",
          authorName: "Tester",
          authorDate: "2024-01-01",
        },
      ])
      .mockResolvedValueOnce([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => screen.getByText("hover test"));
    const row = screen.getByText("hover test").closest("div[style]")!;
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);
    expect(screen.getByText("hover test")).toBeInTheDocument();
  });

  it("swap resets compared state", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare.mockResolvedValue([]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => screen.getAllByText("No exclusive commits"));
    // Swap should reset compared state
    fireEvent.click(screen.getByTitle("Swap branches"));
    await waitFor(() => {
      expect(
        screen.getByText("Select two branches and click Compare to see exclusive commits.")
      ).toBeInTheDocument();
    });
  });

  it("swap button mouse hover events do not crash", async () => {
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    const swapBtn = screen.getByTitle("Swap branches");
    fireEvent.mouseEnter(swapBtn);
    fireEvent.mouseLeave(swapBtn);
    expect(swapBtn).toBeInTheDocument();
  });

  it("both commit columns show with commits in both lists", async () => {
    mockElectronAPI.branch.list.mockResolvedValue([
      { name: "main", current: true },
      { name: "develop", current: false },
    ]);
    mockElectronAPI.logRange.compare
      .mockResolvedValueOnce([
        {
          hash: "a1",
          abbreviatedHash: "a1",
          subject: "in main",
          authorName: "A",
          authorDate: "d1",
        },
      ])
      .mockResolvedValueOnce([
        {
          hash: "b1",
          abbreviatedHash: "b1",
          subject: "in develop",
          authorName: "B",
          authorDate: "d2",
        },
      ]);
    render(<BranchCompareDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText("main"));
    fireEvent.click(screen.getByText("Compare"));
    await waitFor(() => {
      expect(screen.getByText("in main")).toBeInTheDocument();
      expect(screen.getByText("in develop")).toBeInTheDocument();
    });
  });
});
