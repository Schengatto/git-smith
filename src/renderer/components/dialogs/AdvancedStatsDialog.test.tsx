// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AdvancedStatsDialog } from "./AdvancedStatsDialog";

const mockElectronAPI = {
  statsAdvanced: {
    timeline: vi.fn().mockResolvedValue([]),
    churn: vi.fn().mockResolvedValue([]),
    contributorsTimeline: vi.fn().mockResolvedValue([]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("AdvancedStatsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<AdvancedStatsDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Advanced Statistics")).toBeInTheDocument();
  });

  it("shows period selector buttons", () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Day")).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();
    expect(screen.getByText("Month")).toBeInTheDocument();
  });

  it("shows tab buttons", () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Commits Timeline")).toBeInTheDocument();
    expect(screen.getByText("Code Churn")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("calls timeline API on open", async () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.statsAdvanced.timeline).toHaveBeenCalledWith("week");
    });
  });

  it("calls churn API when churn tab is clicked", async () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Code Churn"));
    await waitFor(() => {
      expect(mockElectronAPI.statsAdvanced.churn).toHaveBeenCalledWith("week");
    });
  });

  it("calls contributorsTimeline API when contributors tab is clicked", async () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Contributors"));
    await waitFor(() => {
      expect(mockElectronAPI.statsAdvanced.contributorsTimeline).toHaveBeenCalledWith("week");
    });
  });

  it("calls timeline API with new period when period is changed", async () => {
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.statsAdvanced.timeline).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Month"));
    await waitFor(() => {
      expect(mockElectronAPI.statsAdvanced.timeline).toHaveBeenCalledWith("month");
    });
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<AdvancedStatsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when timeline returns no data", async () => {
    mockElectronAPI.statsAdvanced.timeline.mockResolvedValue([]);
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No data for this period.")).toBeInTheDocument();
    });
  });

  it("shows error state when API fails", async () => {
    mockElectronAPI.statsAdvanced.timeline.mockRejectedValue(new Error("API error"));
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("API error")).toBeInTheDocument();
    });
  });

  it("shows timeline chart when timeline data is available", async () => {
    mockElectronAPI.statsAdvanced.timeline.mockResolvedValue([
      { date: "2024-01-01", count: 5 },
      { date: "2024-01-02", count: 3 },
    ]);
    render(<AdvancedStatsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("2024-01-01")).toBeInTheDocument();
      expect(screen.getByText("2024-01-02")).toBeInTheDocument();
    });
  });
});
