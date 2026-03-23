// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ScanDialog } from "./ScanDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "scan.title": "Scan for Repositories",
        "scan.scanFrom": "Scan from",
        "scan.pathPlaceholder": "C:/Projects",
        "scan.maxDepth": "Max depth",
        "scan.levelsOfSubdirectories": "levels of subdirectories",
        "scan.scanningCount": "Scanning... ({{count}} found)",
        "scan.newReposFoundAndImported": "{{count}} new repository found and imported",
        "scan.newReposFoundAndImportedPlural": "{{count}} new repositories found and imported",
        "scan.noNewReposFound": "No new repositories found in this directory",
        "scan.selectDirectoryToScan": "Select directory to scan",
        "scan.done": "Done",
        "scan.scan": "Scan",
        "dialogs.browse": "Browse",
        "dialogs.cancel": "Cancel",
      };
      let result = translations[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, String(v));
        }
      }
      return result;
    },
  }),
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    loadRecentRepos: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockElectronAPI = {
  repo: {
    browseDirectory: vi.fn().mockResolvedValue(null),
    scanForRepos: vi.fn().mockResolvedValue(undefined),
    scanCancel: vi.fn().mockResolvedValue(undefined),
  },
  on: {
    scanProgress: vi.fn().mockReturnValue(() => {}),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("ScanDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ScanDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Scan for Repositories")).toBeInTheDocument();
  });

  it("shows Scan from label and root path input", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/scan from/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/C:\/Projects/i)).toBeInTheDocument();
  });

  it("shows Max depth label and numeric input defaulting to 4", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/max depth/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  it("shows Browse button", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
  });

  it("Scan button is disabled when root path is empty", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^scan$/i })).toBeDisabled();
  });

  it("Scan button becomes enabled when root path is typed", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/C:\/Projects/i);
    fireEvent.change(input, { target: { value: "/home/user/projects" } });
    expect(screen.getByRole("button", { name: /^scan$/i })).not.toBeDisabled();
  });

  it("shows Cancel button", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<ScanDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls browseDirectory when Browse button is clicked", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalled();
  });

  it("calls scanForRepos when Scan is clicked with a path", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/C:\/Projects/i);
    fireEvent.change(input, { target: { value: "/home/user/projects" } });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    expect(mockElectronAPI.repo.scanForRepos).toHaveBeenCalledWith("/home/user/projects", 4);
  });

  it("shows levels of subdirectories hint text", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/levels of subdirectories/i)).toBeInTheDocument();
  });

  it("sets root path when browseDirectory returns a path", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/home/user/chosen");
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("/home/user/chosen")).toBeInTheDocument();
    });
  });

  it("does not update root path when browseDirectory returns null", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue(null);
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await waitFor(() => expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalled());
    expect((screen.getByPlaceholderText(/C:\/Projects/i) as HTMLInputElement).value).toBe("");
  });

  it("clamps max depth to minimum of 1", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    const depthInput = screen.getByDisplayValue("4");
    fireEvent.change(depthInput, { target: { value: "0" } });
    expect((depthInput as HTMLInputElement).value).toBe("1");
  });

  it("clamps max depth to maximum of 10", () => {
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    const depthInput = screen.getByDisplayValue("4");
    fireEvent.change(depthInput, { target: { value: "99" } });
    expect((depthInput as HTMLInputElement).value).toBe("10");
  });

  it("shows scanning progress state after Scan is clicked", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let progressCallback:
      | ((p: { currentDir: string; found: string[]; phase: string }) => void)
      | null = null;
    mockElectronAPI.on.scanProgress.mockImplementation((cb: typeof progressCallback) => {
      progressCallback = cb;
      return () => {};
    });
    mockElectronAPI.repo.scanForRepos.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Scanning/i)).toBeInTheDocument();
    });
  });

  it("updates found count via scanProgress event", async () => {
    let progressCallback:
      | ((p: { currentDir: string; found: string[]; phase: string }) => void)
      | null = null;
    mockElectronAPI.on.scanProgress.mockImplementation((cb: typeof progressCallback) => {
      progressCallback = cb;
      return () => {};
    });
    mockElectronAPI.repo.scanForRepos.mockImplementation(async () => {
      progressCallback?.({
        currentDir: "/home/user/p/repo1",
        found: ["/home/user/p/repo1"],
        phase: "scanning",
      });
    });
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 found/i)).toBeInTheDocument();
    });
  });

  it("shows done state with found repos after scan completes", async () => {
    let progressCallback:
      | ((p: { currentDir: string; found: string[]; phase: string }) => void)
      | null = null;
    mockElectronAPI.on.scanProgress.mockImplementation((cb: typeof progressCallback) => {
      progressCallback = cb;
      return () => {};
    });
    mockElectronAPI.repo.scanForRepos.mockImplementation(async () => {
      progressCallback?.({
        currentDir: "/home/user/p/repo1",
        found: ["/home/user/p/repo1", "/home/user/p/repo2"],
        phase: "done",
      });
    });
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByText(/2 new repositories found/i)).toBeInTheDocument();
    });
  });

  it("shows done state with no repos message when none found", async () => {
    let progressCallback:
      | ((p: { currentDir: string; found: string[]; phase: string }) => void)
      | null = null;
    mockElectronAPI.on.scanProgress.mockImplementation((cb: typeof progressCallback) => {
      progressCallback = cb;
      return () => {};
    });
    mockElectronAPI.repo.scanForRepos.mockImplementation(async () => {
      progressCallback?.({ currentDir: "", found: [], phase: "done" });
    });
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByText(/No new repositories found/i)).toBeInTheDocument();
    });
  });

  it("shows Done button (not Scan) after scan completes", async () => {
    let progressCallback:
      | ((p: { currentDir: string; found: string[]; phase: string }) => void)
      | null = null;
    mockElectronAPI.on.scanProgress.mockImplementation((cb: typeof progressCallback) => {
      progressCallback = cb;
      return () => {};
    });
    mockElectronAPI.repo.scanForRepos.mockImplementation(async () => {
      progressCallback?.({ currentDir: "", found: [], phase: "done" });
    });
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^done$/i })).toBeInTheDocument();
    });
  });

  it("shows error and returns to idle when scanForRepos throws", async () => {
    mockElectronAPI.repo.scanForRepos.mockRejectedValue(new Error("Access denied"));
    render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^scan$/i }));
    await waitFor(() => {
      expect(screen.getByText("Access denied")).toBeInTheDocument();
    });
    // After error, Scan button should be back (not Done)
    expect(screen.getByRole("button", { name: /^scan$/i })).toBeInTheDocument();
  });

  it("resets state when dialog re-opens", () => {
    const { rerender } = render(<ScanDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/C:\/Projects/i), {
      target: { value: "/home/user/projects" },
    });
    rerender(<ScanDialog open={false} onClose={vi.fn()} />);
    rerender(<ScanDialog open={true} onClose={vi.fn()} />);
    expect((screen.getByPlaceholderText(/C:\/Projects/i) as HTMLInputElement).value).toBe("");
  });
});
