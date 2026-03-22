// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CIStatusDialog } from "./CIStatusDialog";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    repo: { headCommit: "abc1234567890" },
  }),
}));

const mockElectronAPI = {
  ci: {
    status: vi.fn().mockResolvedValue([]),
  },
  shell: {
    openFile: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("CIStatusDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CIStatusDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("CI/CD Pipeline Status")).toBeInTheDocument();
  });

  it("shows HEAD commit SHA", () => {
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    // SHA is sliced to 12 chars: "abc123456789"
    expect(screen.getByText(/HEAD:/)).toBeInTheDocument();
  });

  it("shows Refresh button", () => {
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<CIStatusDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls ci.status on open", async () => {
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.ci.status).toHaveBeenCalledWith("abc1234567890");
    });
  });

  it("shows empty state when no CI runs found", async () => {
    mockElectronAPI.ci.status.mockResolvedValue([]);
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No CI runs found for this commit")).toBeInTheDocument();
    });
  });

  it("shows CI run name when runs are returned", async () => {
    mockElectronAPI.ci.status.mockResolvedValue([
      {
        name: "Build & Test",
        status: "success",
        conclusion: "success",
        startedAt: "2024-01-01T10:00:00Z",
        url: "",
      },
    ]);
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Build & Test")).toBeInTheDocument();
    });
  });

  it("shows conclusion label for successful run", async () => {
    mockElectronAPI.ci.status.mockResolvedValue([
      {
        name: "CI",
        status: "success",
        conclusion: "success",
        startedAt: "2024-01-01T10:00:00Z",
        url: "",
      },
    ]);
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("success")).toBeInTheDocument();
    });
  });

  it("calls ci.status again when Refresh is clicked", async () => {
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.ci.status).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(mockElectronAPI.ci.status).toHaveBeenCalledTimes(2));
  });

  it("shows error message when API fails", async () => {
    mockElectronAPI.ci.status.mockRejectedValue(new Error("Network error"));
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("opens URL in browser when run row is clicked", async () => {
    mockElectronAPI.ci.status.mockResolvedValue([
      {
        name: "Deploy",
        status: "success",
        conclusion: "success",
        startedAt: "2024-01-01T10:00:00Z",
        url: "https://ci.example.com/1",
      },
    ]);
    render(<CIStatusDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText("Deploy"));
    fireEvent.click(screen.getByText("Deploy").closest("div[title]")!);
    expect(mockElectronAPI.shell.openFile).toHaveBeenCalledWith("https://ci.example.com/1");
  });
});
