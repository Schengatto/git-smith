// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { LfsDialog } from "./LfsDialog";

const mockLfsStatus = vi.fn();
const mockLfsInfo = vi.fn();
const mockLfsTrack = vi.fn();
const mockLfsUntrack = vi.fn();
const mockLfsInstall = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    lfs: {
      status: mockLfsStatus,
      info: mockLfsInfo,
      track: mockLfsTrack,
      untrack: mockLfsUntrack,
      install: mockLfsInstall,
    },
  };
});

describe("LfsDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  it("shows install button when LFS not installed", async () => {
    mockLfsStatus.mockResolvedValueOnce({ installed: false, version: "", tracked: [], files: [] });
    mockLfsInfo.mockRejectedValueOnce(new Error("no lfs"));
    render(<LfsDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Install Git LFS")).toBeInTheDocument();
    });
  });

  it("shows tracked patterns when LFS is installed", async () => {
    mockLfsStatus.mockResolvedValueOnce({
      installed: true,
      version: "git-lfs/3.0.0",
      tracked: [{ pattern: "*.psd", filter: "lfs" }],
      files: [],
    });
    mockLfsInfo.mockResolvedValueOnce({ storagePath: "/tmp", endpoint: "https://example.com" });
    render(<LfsDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("*.psd")).toBeInTheDocument();
    });
    expect(screen.getByText("git-lfs/3.0.0")).toBeInTheDocument();
  });

  it("tracks new pattern", async () => {
    mockLfsStatus.mockResolvedValue({
      installed: true,
      version: "git-lfs/3.0.0",
      tracked: [],
      files: [],
    });
    mockLfsInfo.mockResolvedValue({ storagePath: "", endpoint: "" });
    mockLfsTrack.mockResolvedValueOnce(undefined);
    render(<LfsDialog {...defaultProps} />);

    await waitFor(() => expect(mockLfsStatus).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("*.psd, *.zip, *.bin...");
    fireEvent.change(input, { target: { value: "*.bin" } });
    fireEvent.click(screen.getByText("Track"));

    await waitFor(() => {
      expect(mockLfsTrack).toHaveBeenCalledWith("*.bin");
    });
  });

  it("untracks pattern", async () => {
    mockLfsStatus.mockResolvedValueOnce({
      installed: true,
      version: "git-lfs/3.0.0",
      tracked: [{ pattern: "*.zip", filter: "lfs" }],
      files: [],
    });
    mockLfsInfo.mockResolvedValueOnce({ storagePath: "", endpoint: "" });
    mockLfsUntrack.mockResolvedValueOnce(undefined);
    mockLfsStatus.mockResolvedValueOnce({
      installed: true,
      version: "git-lfs/3.0.0",
      tracked: [],
      files: [],
    });
    mockLfsInfo.mockResolvedValueOnce({ storagePath: "", endpoint: "" });
    render(<LfsDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Untrack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Untrack"));

    await waitFor(() => {
      expect(mockLfsUntrack).toHaveBeenCalledWith("*.zip");
    });
  });
});
