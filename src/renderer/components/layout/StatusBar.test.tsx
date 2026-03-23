// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

type MockRepo = {
  path: string;
  name: string;
  currentBranch: string;
  headCommit: string;
  isDirty: boolean;
};

type MockStatus = {
  staged: string[];
  unstaged: string[];
  untracked: string[];
};

let mockRepo: MockRepo | null = null;
let mockStatus: MockStatus | null = null;

vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: unknown) => unknown) => {
    const state = { repo: mockRepo, status: mockStatus };
    return selector ? selector(state) : state;
  },
}));

import { StatusBar } from "./StatusBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const makeRepo = (overrides: Partial<MockRepo> = {}): MockRepo => ({
  path: "/repos/my-repo",
  name: "my-repo",
  currentBranch: "main",
  headCommit: "abc123def456",
  isDirty: false,
  ...overrides,
});

const makeStatus = (overrides: Partial<MockStatus> = {}): MockStatus => ({
  staged: [],
  unstaged: [],
  untracked: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo = null;
  mockStatus = null;
});

describe("StatusBar", () => {
  it("shows 'No repository open' when repo is null", () => {
    render(<StatusBar />);
    expect(screen.getByText("statusBar.noRepositoryOpen")).toBeInTheDocument();
  });

  it("shows branch name when a repo is open", () => {
    mockRepo = makeRepo({ currentBranch: "feature/my-branch" });
    mockStatus = makeStatus();
    render(<StatusBar />);
    expect(screen.getByText("feature/my-branch")).toBeInTheDocument();
  });

  it("shows shortened head commit hash (first 8 chars)", () => {
    mockRepo = makeRepo({ headCommit: "deadbeef1234" });
    mockStatus = makeStatus();
    render(<StatusBar />);
    expect(screen.getByText("deadbeef")).toBeInTheDocument();
  });

  it("shows 'clean' when repo is not dirty and no changes", () => {
    mockRepo = makeRepo({ isDirty: false });
    mockStatus = makeStatus();
    render(<StatusBar />);
    expect(screen.getByText("statusBar.clean")).toBeInTheDocument();
  });

  it("shows change count when files are staged and unstaged", () => {
    mockRepo = makeRepo({ isDirty: true });
    mockStatus = makeStatus({ staged: ["a.ts"], unstaged: ["b.ts", "c.ts"] });
    render(<StatusBar />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/changes/)).toBeInTheDocument();
  });

  it("shows singular 'change' when count is 1", () => {
    mockRepo = makeRepo({ isDirty: true });
    mockStatus = makeStatus({ staged: ["a.ts"] });
    render(<StatusBar />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("statusBar.change")).toBeInTheDocument();
  });
});
