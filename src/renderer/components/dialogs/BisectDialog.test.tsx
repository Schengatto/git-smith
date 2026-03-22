// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BisectDialog } from "./BisectDialog";

const mockSelectCommit = vi.fn();
const mockLoadGraph = vi.fn().mockResolvedValue(undefined);

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: mockLoadGraph,
    selectCommit: mockSelectCommit,
  }),
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshInfo: vi.fn().mockResolvedValue(undefined),
    refreshStatus: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockElectronAPI = {
  bisect: {
    status: vi.fn().mockResolvedValue({ active: false, good: [], bad: [], current: undefined }),
    start: vi.fn().mockResolvedValue("Bisecting: 5 revisions left to test"),
    good: vi.fn().mockResolvedValue("Bisecting: 2 revisions left to test"),
    bad: vi.fn().mockResolvedValue("Bisecting: 1 revision left to test"),
    skip: vi.fn().mockResolvedValue("Bisecting: 2 revisions left to test (skipped 1)"),
    reset: vi.fn().mockResolvedValue("Bisect reset"),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.bisect.status.mockResolvedValue({
    active: false,
    good: [],
    bad: [],
    current: undefined,
  });
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("BisectDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<BisectDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Git Bisect")).toBeInTheDocument();
  });

  it("shows Bisect Not Active status when bisect is inactive", async () => {
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Bisect Not Active")).toBeInTheDocument();
    });
  });

  it("shows Start Bisect button when not active", async () => {
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start bisect/i })).toBeInTheDocument();
    });
  });

  it("calls bisect.start when Start Bisect is clicked", async () => {
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /start bisect/i }));
    fireEvent.click(screen.getByRole("button", { name: /start bisect/i }));
    expect(mockElectronAPI.bisect.start).toHaveBeenCalled();
  });

  it("shows Bisect in Progress when active", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: ["abc1234"],
      bad: ["def5678"],
      current: "ghi9012",
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Bisect in Progress")).toBeInTheDocument();
    });
  });

  it("shows Good, Bad, Skip, and Reset Bisect buttons when active", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: undefined,
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^good$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^bad$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^skip$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reset bisect/i })).toBeInTheDocument();
    });
  });

  it("shows current commit hash when active and current is set", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: ["abc1234"],
      bad: ["def5678"],
      current: "ghi90123456",
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("ghi9012")).toBeInTheDocument();
    });
  });

  it("calls bisect.good when Good button is clicked", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: undefined,
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /^good$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^good$/i }));
    expect(mockElectronAPI.bisect.good).toHaveBeenCalled();
  });

  it("calls bisect.bad when Bad button is clicked", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: undefined,
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /^bad$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^bad$/i }));
    expect(mockElectronAPI.bisect.bad).toHaveBeenCalled();
  });

  it("calls bisect.skip when Skip button is clicked", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: undefined,
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /^skip$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(mockElectronAPI.bisect.skip).toHaveBeenCalled();
  });

  it("calls bisect.reset when Reset Bisect button is clicked", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: undefined,
    });
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /reset bisect/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset bisect/i }));
    expect(mockElectronAPI.bisect.reset).toHaveBeenCalled();
  });

  it("shows output text after an action", async () => {
    render(<BisectDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("button", { name: /start bisect/i }));
    fireEvent.click(screen.getByRole("button", { name: /start bisect/i }));
    await waitFor(() => {
      expect(screen.getByText(/bisecting: 5 revisions/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<BisectDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls selectCommit and onClose when current commit link is clicked", async () => {
    mockElectronAPI.bisect.status.mockResolvedValue({
      active: true,
      good: [],
      bad: [],
      current: "ghi90123456",
    });
    const onClose = vi.fn();
    render(<BisectDialog open={true} onClose={onClose} />);
    await waitFor(() => screen.getByText("ghi9012"));
    fireEvent.click(screen.getByText("ghi9012"));
    expect(mockSelectCommit).toHaveBeenCalledWith("ghi90123456");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
