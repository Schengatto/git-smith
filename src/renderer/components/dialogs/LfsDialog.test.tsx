// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { LfsDialog } from "./LfsDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "lfs.title": "Git LFS",
        "lfs.notInstalled": "Git LFS is not installed in this repository",
        "lfs.installLfs": "Install Git LFS",
        "lfs.installingLfs": "Installing LFS...",
        "lfs.endpoint": "Endpoint:",
        "lfs.trackedPatterns": "Tracked Patterns",
        "lfs.lfsFiles": "LFS Files",
        "lfs.track": "Track",
        "lfs.untrack": "Untrack",
        "lfs.noTrackedPatterns": "No tracked patterns",
        "lfs.noLfsFiles": "No LFS files",
        "lfs.trackPatternPlaceholder": "*.psd, *.zip, *.bin...",
        "lfs.tracking": "Tracking {{pattern}}...",
        "lfs.untracking": "Untracking {{pattern}}...",
        "dialogs.loading": "Loading...",
        "dialogs.close": "Close",
      };
      let result = translations[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, v);
        }
      }
      return result;
    },
  }),
}));

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
