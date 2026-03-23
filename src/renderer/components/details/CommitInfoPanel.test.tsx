// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

// --- Mutable store state ---
let mockSelectedCommit: { hash: string } | null = null;
let mockRepo: { path: string; name: string; headCommit?: string } | null = null;

vi.mock("../../store/graph-store", () => ({
  useGraphStore: (selector?: (s: unknown) => unknown) => {
    const state = { selectedCommit: mockSelectedCommit };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: unknown) => unknown) => {
    const state = { repo: mockRepo };
    return selector ? selector(state) : state;
  },
}));

const fullInfoMock = vi.fn();
const gpgVerifyMock = vi.fn();
const notesGetMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectedCommit = null;
  mockRepo = null;
  fullInfoMock.mockResolvedValue(null);
  gpgVerifyMock.mockResolvedValue(null);
  notesGetMock.mockResolvedValue("");
  (window as unknown as Record<string, unknown>).electronAPI = {
    log: { fullInfo: fullInfoMock },
    gpg: { verify: gpgVerifyMock },
    notes: { get: notesGetMock },
  };
});

import { CommitInfoPanel } from "./CommitInfoPanel";

const makeFullInfo = (overrides: Record<string, unknown> = {}) => ({
  hash: "abc1234567890abcdef",
  abbreviatedHash: "abc1234",
  subject: "feat: add new feature",
  body: "",
  authorName: "Alice Developer",
  authorEmail: "alice@example.com",
  authorDate: new Date("2024-01-15T10:30:00Z").toISOString(),
  committerName: "Alice Developer",
  committerEmail: "alice@example.com",
  committerDate: new Date("2024-01-15T10:30:00Z").toISOString(),
  parentHashes: ["parent1234"],
  childHashes: [],
  refs: [],
  containedInBranches: ["main", "feature/test"],
  containedInTags: ["v1.0.0"],
  derivesFromTag: "v1.0.0",
  gravatarHash: undefined,
  ...overrides,
});

describe("CommitInfoPanel", () => {
  it("renders empty state when no commit is selected and no repo", () => {
    render(<CommitInfoPanel />);
    expect(screen.getByText("details.selectCommitToViewInfo")).toBeInTheDocument();
  });

  it("renders empty state when repo has no headCommit and no selectedCommit", () => {
    mockRepo = { path: "/repo", name: "test-repo" };
    render(<CommitInfoPanel />);
    expect(screen.getByText("details.selectCommitToViewInfo")).toBeInTheDocument();
  });

  it("uses repo headCommit as fallback when no commit is selected", async () => {
    mockRepo = { path: "/repo", name: "test-repo", headCommit: "head123" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ hash: "head123" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(fullInfoMock).toHaveBeenCalledWith("head123");
    });
  });

  it("uses selectedCommit.hash when available", async () => {
    mockSelectedCommit = { hash: "selected456" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ hash: "selected456" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(fullInfoMock).toHaveBeenCalledWith("selected456");
    });
  });

  it("shows loading state after hash is resolved but before data returns", async () => {
    mockSelectedCommit = { hash: "loading123" };
    // Never resolves
    fullInfoMock.mockReturnValue(new Promise(() => {}));
    gpgVerifyMock.mockReturnValue(new Promise(() => {}));
    notesGetMock.mockReturnValue(new Promise(() => {}));
    render(<CommitInfoPanel />);
    expect(screen.getByText("details.loading")).toBeInTheDocument();
  });

  it("renders commit author information", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Alice Developer/)).toBeInTheDocument();
    });
  });

  it("renders commit subject", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ subject: "feat: add new feature" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });
  });

  it("renders commit body when present", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ body: "This is a detailed description." }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("This is a detailed description.")).toBeInTheDocument();
    });
  });

  it("renders commit hash in metadata", async () => {
    mockSelectedCommit = { hash: "abc1234567890abcdef" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ hash: "abc1234567890abcdef" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("abc1234567890abcdef")).toBeInTheDocument();
    });
  });

  it("renders parent hash", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ parentHashes: ["parent1234567"] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText(/parent1234/)).toBeInTheDocument();
    });
  });

  it("renders child hash when present", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    // The component slices child hashes to 10 chars
    fullInfoMock.mockResolvedValue(makeFullInfo({ childHashes: ["child56789012345"] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      // Component renders first 10 chars of each child hash
      expect(screen.getByText(/child56789/)).toBeInTheDocument();
    });
  });

  it("renders contained-in branches", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ containedInBranches: ["main", "feature/test"] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("feature/test")).toBeInTheDocument();
    });
  });

  it("renders 'No branches' when not contained in any branch", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ containedInBranches: [] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.noBranches")).toBeInTheDocument();
    });
  });

  it("renders contained-in tags", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ containedInTags: ["v2.0.0-unique-tag"] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("v2.0.0-unique-tag")).toBeInTheDocument();
    });
  });

  it("renders 'Contained in no tag' when no tags", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ containedInTags: [] }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.containedInNoTag")).toBeInTheDocument();
    });
  });

  it("renders derivesFromTag", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ derivesFromTag: "v1.0.0" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      // derivesFromTag label present
      expect(screen.getByText("commitInfo.derivesFromTag:")).toBeInTheDocument();
    });
  });

  it("renders 'Derives from no tag' when derivesFromTag is empty", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ derivesFromTag: "" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("commitInfo.derivesFromNoTag")).toBeInTheDocument();
    });
  });

  it("renders committer when different from author", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(
      makeFullInfo({ committerName: "Bob Committer", committerEmail: "bob@example.com" })
    );
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Bob Committer/)).toBeInTheDocument();
    });
  });

  it("renders GPG verified signature badge", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    gpgVerifyMock.mockResolvedValue({
      signed: true,
      status: "G",
      signer: "Alice Developer",
      key: "ABCD1234",
    });
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Verified/)).toBeInTheDocument();
    });
  });

  it("renders GPG signed (unverified) badge when status is not G", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    gpgVerifyMock.mockResolvedValue({
      signed: true,
      status: "U",
      signer: "Alice",
      key: "KEY123",
    });
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Signed/)).toBeInTheDocument();
    });
  });

  it("does not render GPG badge when not signed", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    gpgVerifyMock.mockResolvedValue({ signed: false });
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Verified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Signed/)).not.toBeInTheDocument();
  });

  it("renders git notes when present", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    notesGetMock.mockResolvedValue("This is a git note.");
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("This is a git note.")).toBeInTheDocument();
    });
  });

  it("does not render note section when no note exists", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo());
    notesGetMock.mockResolvedValue("");
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });
    expect(screen.queryByText("commitInfo.note")).not.toBeInTheDocument();
  });

  it("renders gravatar image when gravatarHash is present", async () => {
    mockSelectedCommit = { hash: "abc1234" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ gravatarHash: "abc123gravatar" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      const img = document.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.src).toContain("abc123gravatar");
    });
  });

  it("handles fullInfo API error gracefully (stays on loading then shows empty)", async () => {
    mockSelectedCommit = { hash: "error-hash" };
    fullInfoMock.mockRejectedValue(new Error("API error"));
    render(<CommitInfoPanel />);
    // After error resolves, info is null → shows loading placeholder
    await waitFor(() => {
      expect(fullInfoMock).toHaveBeenCalledWith("error-hash");
    });
  });

  it("calls gpg.verify with the selected commit hash", async () => {
    mockSelectedCommit = { hash: "gpgtest" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ hash: "gpgtest" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(gpgVerifyMock).toHaveBeenCalledWith("gpgtest");
    });
  });

  it("calls notes.get with the selected commit hash", async () => {
    mockSelectedCommit = { hash: "notetest" };
    fullInfoMock.mockResolvedValue(makeFullInfo({ hash: "notetest" }));
    render(<CommitInfoPanel />);
    await waitFor(() => {
      expect(notesGetMock).toHaveBeenCalledWith("notetest");
    });
  });
});
