// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { StashDialog } from "./StashDialog";

const mockStatus = {
  staged: [{ path: "src/index.ts", status: "modified" }],
  unstaged: [{ path: "src/utils.ts", status: "modified" }],
  untracked: ["newfile.txt"],
};

const mockStashes = [
  { index: 0, message: "WIP on main", date: "2026-03-15", hash: "abc123" },
  { index: 1, message: "WIP: feature", date: "2026-03-14", hash: "def456" },
];

const mockElectronAPI = {
  status: { get: vi.fn().mockResolvedValue(mockStatus) },
  stash: {
    list: vi.fn().mockResolvedValue(mockStashes),
    create: vi.fn().mockResolvedValue(undefined),
    pop: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue(undefined),
    drop: vi.fn().mockResolvedValue(undefined),
  },
  diff: { file: vi.fn().mockResolvedValue("+ added line") },
};

// Mock Zustand stores
vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshStatus: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: vi.fn().mockResolvedValue(undefined),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.status.get.mockResolvedValue(mockStatus);
  mockElectronAPI.stash.list.mockResolvedValue(mockStashes);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("StashDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<StashDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows title when open", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Stash")).toBeInTheDocument();
  });

  it("loads working directory changes on open", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.status.get).toHaveBeenCalled();
    });
    // Files should be visible in tree
    await waitFor(() => {
      expect(screen.getByText("index.ts")).toBeInTheDocument();
      expect(screen.getByText("utils.ts")).toBeInTheDocument();
      expect(screen.getByText("newfile.txt")).toBeInTheDocument();
    });
  });

  it("shows file count in header", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Working directory \(3 files\)/i)).toBeInTheDocument();
    });
  });

  it("shows stash list when switching mode", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.stash.list).toHaveBeenCalled();
    });

    const select = screen.getByDisplayValue("Current working directory changes");
    fireEvent.change(select, { target: { value: "stash" } });

    await waitFor(() => {
      expect(screen.getByText("stash@{0}")).toBeInTheDocument();
      expect(screen.getByText("WIP on main")).toBeInTheDocument();
    });
  });

  it("calls stash.create with options when clicking Stash all changes", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Stash all changes")).toBeInTheDocument();
    });

    // Set message
    const input = screen.getByPlaceholderText("Optional stash message...");
    fireEvent.change(input, { target: { value: "my stash" } });

    // Toggle options
    const keepIndexCb = screen.getByLabelText("Keep index");
    const includeUntrackedCb = screen.getByLabelText("Include untracked");
    fireEvent.click(keepIndexCb);
    fireEvent.click(includeUntrackedCb);

    fireEvent.click(screen.getByText("Stash all changes"));

    await waitFor(() => {
      expect(mockElectronAPI.stash.create).toHaveBeenCalledWith("my stash", {
        keepIndex: true,
        includeUntracked: true,
      });
    });
  });

  it("calls stash.drop when clicking Drop Selected Stash", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.stash.list).toHaveBeenCalled());

    // Switch to stash list view
    const select = screen.getByDisplayValue("Current working directory changes");
    fireEvent.change(select, { target: { value: "stash" } });

    await waitFor(() => {
      expect(screen.getByText("stash@{0}")).toBeInTheDocument();
    });

    // Select first stash
    fireEvent.click(screen.getByText("stash@{0}"));

    // Drop it
    fireEvent.click(screen.getByText("Drop Selected Stash"));

    await waitFor(() => {
      expect(mockElectronAPI.stash.drop).toHaveBeenCalledWith(0);
    });
  });

  it("calls stash.apply when clicking Apply Selected Stash", async () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.stash.list).toHaveBeenCalled());

    const select = screen.getByDisplayValue("Current working directory changes");
    fireEvent.change(select, { target: { value: "stash" } });

    await waitFor(() => {
      expect(screen.getByText("stash@{1}")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("stash@{1}"));
    fireEvent.click(screen.getByText("Apply Selected Stash"));

    await waitFor(() => {
      expect(mockElectronAPI.stash.apply).toHaveBeenCalledWith(1);
    });
  });

  it("calls onClose when clicking X button", () => {
    const onClose = vi.fn();
    render(<StashDialog open={true} onClose={onClose} />);
    // The close button is the one with the X icon inside the header
    const buttons = screen.getAllByRole("button");
    // Find the close button (first button in header area)
    const _closeBtn = buttons.find((b) => b.getAttribute("title") === null && b.closest("[style]"));
    // Click the backdrop as alternative
    // Instead let's find it by querying all buttons
    fireEvent.click(buttons[0]!); // The X close button is the first button
    expect(onClose).toHaveBeenCalled();
  });

  it("shows checkboxes for Keep index and Include untracked", () => {
    render(<StashDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Keep index")).toBeInTheDocument();
    expect(screen.getByLabelText("Include untracked")).toBeInTheDocument();
  });

  it("renders without overlay backdrop in window mode", () => {
    render(<StashDialog open={true} onClose={vi.fn()} mode="window" />);
    const container = document.querySelector('[style*="position: fixed"]');
    expect(container).toBeNull();
  });
});
