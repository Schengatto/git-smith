// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { UndoDialog } from "./UndoDialog";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshStatus: vi.fn().mockResolvedValue(undefined),
    refreshInfo: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/ui-store", () => ({
  useUIStore: (selector: (s: { showToast: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ showToast: vi.fn() }),
}));

const mockElectronAPI = {
  undo: {
    history: vi.fn().mockResolvedValue([]),
    revert: vi.fn().mockResolvedValue(undefined),
  },
};

// jsdom does not implement window.confirm; provide a stub
const originalConfirm = window.confirm;

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn().mockReturnValue(false);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

afterEach(() => {
  window.confirm = originalConfirm;
});

describe("UndoDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<UndoDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Undo Git Operations")).toBeInTheDocument();
  });

  it("shows empty state when history is empty", async () => {
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/no reflog entries/i)).toBeInTheDocument();
    });
  });

  it("calls undo.history on open", async () => {
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.undo.history).toHaveBeenCalledWith(30);
    });
  });

  it("renders reflog entries when history has items", async () => {
    mockElectronAPI.undo.history.mockResolvedValue([
      {
        index: 0,
        hash: "abc1234def",
        action: "commit: fix bug",
        description: "HEAD@{0}: commit: fix bug",
        date: new Date("2024-01-15T10:00:00").toISOString(),
      },
      {
        index: 1,
        hash: "bcd2345efa",
        action: "checkout: moving from main to feature",
        description: "HEAD@{1}: checkout: moving from main to feature",
        date: new Date("2024-01-14T09:00:00").toISOString(),
      },
    ]);
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("HEAD@{0}: commit: fix bug")).toBeInTheDocument();
      expect(
        screen.getByText("HEAD@{1}: checkout: moving from main to feature")
      ).toBeInTheDocument();
    });
  });

  it("does not show Undo button for the first entry (index 0)", async () => {
    mockElectronAPI.undo.history.mockResolvedValue([
      {
        index: 0,
        hash: "abc1234def",
        action: "commit",
        description: "HEAD@{0}: commit: initial",
        date: new Date().toISOString(),
      },
    ]);
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText("HEAD@{0}: commit: initial"));
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });

  it("shows Undo button for entries with index > 0", async () => {
    mockElectronAPI.undo.history.mockResolvedValue([
      {
        index: 0,
        hash: "abc1234",
        action: "commit",
        description: "HEAD@{0}: commit: latest",
        date: new Date().toISOString(),
      },
      {
        index: 1,
        hash: "bcd2345",
        action: "commit",
        description: "HEAD@{1}: commit: previous",
        date: new Date().toISOString(),
      },
    ]);
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText("HEAD@{1}: commit: previous"));
    expect(screen.getByRole("button", { name: /^undo$/i })).toBeInTheDocument();
  });

  it("prompts confirm when Undo button is clicked", async () => {
    mockElectronAPI.undo.history.mockResolvedValue([
      {
        index: 0,
        hash: "abc1234",
        action: "commit",
        description: "HEAD@{0}: commit: latest",
        date: new Date().toISOString(),
      },
      {
        index: 1,
        hash: "bcd2345",
        action: "commit",
        description: "HEAD@{1}: commit: previous",
        date: new Date().toISOString(),
      },
    ]);
    render(<UndoDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /^undo$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(window.confirm).toHaveBeenCalled();
  });
});
