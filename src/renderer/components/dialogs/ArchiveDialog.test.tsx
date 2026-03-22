// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ArchiveDialog } from "./ArchiveDialog";

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn((_label: string, fn: () => Promise<unknown>) => fn()),
  GitOperationCancelledError: class extends Error {},
}));

const mockElectronAPI = {
  repo: {
    browseDirectory: vi.fn().mockResolvedValue(null),
  },
  archive: {
    export: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("ArchiveDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ArchiveDialog open={false} onClose={vi.fn()} ref_="main" refLabel="main" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    expect(screen.getByText("Archive / Export")).toBeInTheDocument();
  });

  it("shows the ref label in description", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="abc123" refLabel="v1.2.3" />);
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });

  it("shows ZIP and TAR.GZ format radio buttons", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    expect(screen.getByText("ZIP")).toBeInTheDocument();
    expect(screen.getByText("TAR.GZ")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
  });

  it("defaults to ZIP format selected", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked(); // ZIP
    expect(radios[1]).not.toBeChecked(); // TAR.GZ
  });

  it("switches to TAR.GZ when that radio is clicked", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]!); // TAR.GZ
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });

  it("shows Export and Cancel buttons", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    expect(screen.getByRole("button", { name: /^export$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls browseDirectory when Export is clicked", () => {
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalled();
  });

  it("does not call archive.export when browseDirectory returns null", () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue(null);
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    expect(mockElectronAPI.archive.export).not.toHaveBeenCalled();
  });

  it("calls archive.export with zip extension when a directory is chosen", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/home/user/exports");
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() => {
      expect(mockElectronAPI.archive.export).toHaveBeenCalledWith(
        "main",
        "/home/user/exports/main.zip",
        "zip"
      );
    });
  });

  it("calls archive.export with tar.gz extension when TAR.GZ is selected and directory chosen", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/home/user/exports");
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="abc123" refLabel="v2.0.0" />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]!); // TAR.GZ
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() => {
      expect(mockElectronAPI.archive.export).toHaveBeenCalledWith(
        "abc123",
        "/home/user/exports/v2.0.0.tar.gz",
        "tar.gz"
      );
    });
  });

  it("shows success message after successful export", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/home/user/exports");
    render(<ArchiveDialog open={true} onClose={vi.fn()} ref_="main" refLabel="main" />);
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() => {
      expect(screen.getByText(/exported to/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<ArchiveDialog open={true} onClose={onClose} ref_="main" refLabel="main" />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
