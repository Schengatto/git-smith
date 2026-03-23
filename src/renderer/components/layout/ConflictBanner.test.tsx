// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ConflictBanner } from "./ConflictBanner";
import type { GitStatus } from "../../../shared/git-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "conflictBanner.merge": "Merge",
        "conflictBanner.rebase": "Rebase",
        "conflictBanner.cherryPick": "Cherry-pick",
        "conflictBanner.allConflictsResolved": "All conflicts resolved",
        "conflictBanner.inProgress": "in progress",
        "conflictBanner.conflictsResolved": "conflicts resolved",
        "conflictBanner.resolveConflicts": "Resolve Conflicts",
        "conflictBanner.skipCommit": "Skip Commit",
        "conflictBanner.abortButton": "Abort",
      };
      if (key === "conflictBanner.abort" && opts?.operation) {
        return `Abort ${opts.operation}`;
      }
      if (key === "conflictBanner.continue" && opts?.operation) {
        return `Continue ${opts.operation}`;
      }
      if (key === "conflictBanner.abortConfirm" && opts?.operation) {
        return `Are you sure you want to abort the ${opts.operation}?`;
      }
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

// Mock openDialogWindow
vi.mock("../../utils/open-dialog", () => ({
  openDialogWindow: vi.fn(),
}));

// Mock electronAPI on window
const mockElectronAPI = {
  branch: {
    mergeAbort: vi.fn().mockResolvedValue(undefined),
    mergeContinue: vi.fn().mockResolvedValue(undefined),
    rebaseAbort: vi.fn().mockResolvedValue(undefined),
    rebaseContinue: vi.fn().mockResolvedValue(undefined),
    rebaseSkip: vi.fn().mockResolvedValue(undefined),
    cherryPickAbort: vi.fn().mockResolvedValue(undefined),
    cherryPickContinue: vi.fn().mockResolvedValue(undefined),
  },
};

// Mock stores
const mockRefreshStatus = vi.fn().mockResolvedValue(undefined);
const mockRefreshInfo = vi.fn().mockResolvedValue(undefined);
const mockLoadGraph = vi.fn();
vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(vi.fn(), {
    getState: () => ({
      refreshStatus: mockRefreshStatus,
      refreshInfo: mockRefreshInfo,
    }),
  }),
}));
vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(vi.fn(), {
    getState: () => ({ loadGraph: mockLoadGraph }),
  }),
}));

function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    staged: [],
    unstaged: [],
    untracked: [],
    mergeInProgress: false,
    conflicted: [],
    operationInProgress: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
  // Default: confirm returns true
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("ConflictBanner", () => {
  it("does not render when no operation in progress", () => {
    const { container } = render(<ConflictBanner status={makeStatus()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders merge conflict banner with count text", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/Merge in progress/)).toBeInTheDocument();
    expect(screen.getByText(/0\/2 conflicts resolved/)).toBeInTheDocument();
    expect(screen.getByText("Resolve Conflicts")).toBeInTheDocument();
    expect(screen.getByText("Abort Merge")).toBeInTheDocument();
  });

  it("renders rebase banner with step info", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 3, total: 7 },
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
            { path: "c.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/Rebase in progress \(step 3\/7\)/)).toBeInTheDocument();
    expect(screen.getByText(/0\/3 conflicts resolved/)).toBeInTheDocument();
    expect(screen.getByText("Skip Commit")).toBeInTheDocument();
  });

  it("renders cherry-pick banner", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "cherry-pick",
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/Cherry-pick in progress/)).toBeInTheDocument();
    expect(screen.getByText(/0\/2 conflicts resolved/)).toBeInTheDocument();
  });

  it("shows green state when all conflicts resolved", () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [],
        })}
      />
    );
    expect(screen.getByText(/All conflicts resolved/)).toBeInTheDocument();
    expect(screen.getByText("Continue Merge")).toBeInTheDocument();
    expect(screen.getByText("Abort")).toBeInTheDocument();
  });

  it("calls mergeAbort on abort click with confirmation", async () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );
    fireEvent.click(screen.getByText("Abort Merge"));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockElectronAPI.branch.mergeAbort).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockRefreshStatus).toHaveBeenCalled();
      expect(mockRefreshInfo).toHaveBeenCalled();
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });

  it("does NOT abort when confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [{ path: "a.ts", reason: "both-modified" }],
        })}
      />
    );
    fireEvent.click(screen.getByText("Abort Merge"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockElectronAPI.branch.mergeAbort).not.toHaveBeenCalled();
  });

  it("calls mergeContinue on continue click", async () => {
    render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "merge",
          mergeInProgress: true,
          conflicted: [],
        })}
      />
    );
    fireEvent.click(screen.getByText("Continue Merge"));
    await waitFor(() => {
      expect(mockElectronAPI.branch.mergeContinue).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockRefreshStatus).toHaveBeenCalled();
      expect(mockRefreshInfo).toHaveBeenCalled();
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });

  it("should reset progress counter when rebase step changes", () => {
    const { rerender } = render(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 1, total: 3 },
          conflicted: [
            { path: "a.ts", reason: "both-modified" },
            { path: "b.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/0\/2 conflicts resolved/)).toBeTruthy();

    // Resolve one conflict
    rerender(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 1, total: 3 },
          conflicted: [{ path: "b.ts", reason: "both-modified" }],
        })}
      />
    );
    expect(screen.getByText(/1\/2 conflicts resolved/)).toBeTruthy();

    // Move to next rebase step — total should reset
    rerender(
      <ConflictBanner
        status={makeStatus({
          operationInProgress: "rebase",
          rebaseStep: { current: 2, total: 3 },
          conflicted: [
            { path: "c.ts", reason: "both-modified" },
            { path: "d.ts", reason: "both-modified" },
            { path: "e.ts", reason: "both-modified" },
          ],
        })}
      />
    );
    expect(screen.getByText(/0\/3 conflicts resolved/)).toBeTruthy();
  });
});
