// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SubmoduleDialog } from "./SubmoduleDialog";

const mockStatus = vi.fn();
const mockUpdate = vi.fn();
const mockSync = vi.fn();
const mockDeinit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    submodule: {
      status: mockStatus,
      update: mockUpdate,
      sync: mockSync,
      deinit: mockDeinit,
    },
  };
});

describe("SubmoduleDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  it("shows loading then submodule list", async () => {
    mockStatus.mockResolvedValueOnce([
      {
        name: "lib/core",
        path: "lib/core",
        url: "https://github.com/test/core.git",
        hash: "abc1234567890",
        branch: "main",
        status: "up-to-date",
      },
    ]);
    render(<SubmoduleDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("lib/core")).toBeInTheDocument();
    });
    expect(screen.getByText("up-to-date")).toBeInTheDocument();
  });

  it("shows empty state when no submodules", async () => {
    mockStatus.mockResolvedValueOnce([]);
    render(<SubmoduleDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No submodules found")).toBeInTheDocument();
    });
  });

  it("calls sync on Sync button click", async () => {
    mockStatus.mockResolvedValue([]);
    mockSync.mockResolvedValueOnce(undefined);
    render(<SubmoduleDialog {...defaultProps} />);

    await waitFor(() => expect(mockStatus).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Sync"));

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalled();
    });
  });

  it("calls update on Init & Update button click", async () => {
    mockStatus.mockResolvedValue([]);
    mockUpdate.mockResolvedValueOnce(undefined);
    render(<SubmoduleDialog {...defaultProps} />);

    await waitFor(() => expect(mockStatus).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Init & Update"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(true);
    });
  });

  it("calls deinit on Deinit button click", async () => {
    mockStatus.mockResolvedValueOnce([
      {
        name: "lib/core",
        path: "lib/core",
        url: "",
        hash: "abc123",
        branch: "",
        status: "up-to-date",
      },
    ]);
    mockDeinit.mockResolvedValueOnce(undefined);
    mockStatus.mockResolvedValueOnce([]);
    render(<SubmoduleDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Deinit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Deinit"));

    await waitFor(() => {
      expect(mockDeinit).toHaveBeenCalledWith("lib/core", true);
    });
  });
});
