// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CommitInfoDialog } from "./CommitInfoDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const mockElectronAPI = {
  log: {
    fullInfo: vi.fn().mockResolvedValue(null),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

const makeFullInfo = (overrides = {}) => ({
  hash: "abc1234567890",
  abbreviatedHash: "abc1234",
  subject: "feat: add cool feature",
  body: "",
  authorName: "Alice",
  authorEmail: "alice@example.com",
  authorDate: new Date().toISOString(),
  committerName: "Alice",
  committerEmail: "alice@example.com",
  gravatarHash: "",
  parentHashes: [],
  childHashes: [],
  containedInBranches: [],
  containedInTags: [],
  derivesFromTag: null,
  ...overrides,
});

describe("CommitInfoDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommitInfoDialog open={false} onClose={vi.fn()} commitHash="abc123" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    expect(screen.getByText("commitInfoDialog.title")).toBeInTheDocument();
  });

  it("calls log.fullInfo with the commitHash on open", () => {
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="deadbeef" />);
    expect(mockElectronAPI.log.fullInfo).toHaveBeenCalledWith("deadbeef");
  });

  it("does not call log.fullInfo when closed", () => {
    render(<CommitInfoDialog open={false} onClose={vi.fn()} commitHash="deadbeef" />);
    expect(mockElectronAPI.log.fullInfo).not.toHaveBeenCalled();
  });

  it("does not call log.fullInfo when commitHash is empty", () => {
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="" />);
    expect(mockElectronAPI.log.fullInfo).not.toHaveBeenCalled();
  });

  it("shows commit info after loading", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo());
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("feat: add cool feature")).toBeInTheDocument();
    });
  });

  it("shows author name and email", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo());
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/alice@example\.com/).length).toBeGreaterThan(0);
    });
  });

  it("shows commit hash in monospace", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo());
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("abc1234567890")).toBeInTheDocument();
    });
  });

  it("shows error when fullInfo rejects", async () => {
    mockElectronAPI.log.fullInfo.mockRejectedValue(new Error("Network error"));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows 'No branches' when containedInBranches is empty", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ containedInBranches: [] }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.noBranches")).toBeInTheDocument();
    });
  });

  it("shows branch badges when containedInBranches has items", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ containedInBranches: ["main", "develop"] })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("develop")).toBeInTheDocument();
    });
  });

  it("shows 'Contained in no tag' when tags empty", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ containedInTags: [] }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.containedInNoTag")).toBeInTheDocument();
    });
  });

  it("shows tag badges when containedInTags has items", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ containedInTags: ["v1.0.0", "v1.1.0"] })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
      expect(screen.getByText("v1.1.0")).toBeInTheDocument();
    });
  });

  it("shows 'Derives from no tag' when derivesFromTag is null", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ derivesFromTag: null }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.derivesFromNoTag")).toBeInTheDocument();
    });
  });

  it("shows derivesFromTag when set", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ derivesFromTag: "v2.0.0" }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("v2.0.0")).toBeInTheDocument();
    });
  });

  it("shows parent hashes as links when present", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ parentHashes: ["parentaaaa", "parentbbbb"] })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      // hash.slice(0,10) of "parentaaaa" (10 chars) = "parentaaaa"
      expect(screen.getByText("parentaaaa")).toBeInTheDocument();
    });
  });

  it("calls onNavigateToCommit when parent hash is clicked", async () => {
    const onNavigate = vi.fn();
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ parentHashes: ["parentabc123"] })
    );
    render(
      <CommitInfoDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123"
        onNavigateToCommit={onNavigate}
      />
    );
    await waitFor(() => {
      // hash.slice(0,10) of "parentabc123" = "parentabc1"
      expect(screen.getByText("parentabc1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("parentabc1"));
    expect(onNavigate).toHaveBeenCalledWith("parentabc123");
  });

  it("shows child hashes when present", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ childHashes: ["childabc123"] }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      // hash.slice(0,10) of "childabc123" = "childabc12"
      expect(screen.getByText("childabc12")).toBeInTheDocument();
    });
  });

  it("shows body text when commit has a body", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ body: "Detailed description of the change." })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText("Detailed description of the change.")).toBeInTheDocument();
    });
  });

  it("shows gravatar image when gravatarHash is set", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ gravatarHash: "abc123hashvalue" })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      const img = document.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.src).toContain("abc123hashvalue");
    });
  });

  it("shows date as 'Today' for today's date", async () => {
    mockElectronAPI.log.fullInfo.mockResolvedValue(
      makeFullInfo({ authorDate: new Date().toISOString() })
    );
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText(/Today/)).toBeInTheDocument();
    });
  });

  it("shows '1 day ago' for yesterday's date", async () => {
    const yesterday = new Date(Date.now() - 86400000 * 1.5).toISOString();
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ authorDate: yesterday }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText(/1 day ago/)).toBeInTheDocument();
    });
  });

  it("shows 'months ago' for dates 30+ days back", async () => {
    const twoMonthsAgo = new Date(Date.now() - 86400000 * 62).toISOString();
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ authorDate: twoMonthsAgo }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText(/months ago/)).toBeInTheDocument();
    });
  });

  it("shows 'years ago' for dates 365+ days back", async () => {
    const twoYearsAgo = new Date(Date.now() - 86400000 * 730).toISOString();
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ authorDate: twoYearsAgo }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText(/years ago/)).toBeInTheDocument();
    });
  });

  it("shows 'days ago' for dates 2-29 days back", async () => {
    const fiveDaysAgo = new Date(Date.now() - 86400000 * 5).toISOString();
    mockElectronAPI.log.fullInfo.mockResolvedValue(makeFullInfo({ authorDate: fiveDaysAgo }));
    render(<CommitInfoDialog open={true} onClose={vi.fn()} commitHash="abc123" />);
    await waitFor(() => {
      expect(screen.getByText(/days ago/)).toBeInTheDocument();
    });
  });

  it("calls onClose when dialog close button is clicked", () => {
    const onClose = vi.fn();
    render(<CommitInfoDialog open={true} onClose={onClose} commitHash="abc123" />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
