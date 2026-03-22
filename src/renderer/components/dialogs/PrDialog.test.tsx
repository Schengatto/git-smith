// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";
import { PrDialog } from "./PrDialog";

const mockDetectProvider = vi.fn();
const mockListPrs = vi.fn();
const mockViewPr = vi.fn();
const mockCreatePr = vi.fn();
const mockOpenExternal = vi.fn();
const mockGeneratePrTitle = vi.fn();
const mockGeneratePrDescription = vi.fn();

vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: unknown) => unknown) => {
    const state = { repo: { path: "/test", currentBranch: "feature-branch" } };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../store/mcp-store", () => ({
  useMcpStore: () => ({
    generating: false,
    generatePrTitle: mockGeneratePrTitle,
    generatePrDescription: mockGeneratePrDescription,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    pr: {
      detectProvider: mockDetectProvider,
      list: mockListPrs,
      view: mockViewPr,
      create: mockCreatePr,
    },
    repo: {
      openExternal: mockOpenExternal,
    },
  };
});

describe("PrDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  it("shows PR list from GitHub", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 1,
        title: "Add feature X",
        state: "open",
        author: "dev",
        url: "https://github.com/user/test/pull/1",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "feature-x",
        targetBranch: "main",
        labels: [],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add feature X")).toBeInTheDocument();
    });
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("shows empty state when no PRs", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No Pull Requests found")).toBeInTheDocument();
    });
  });

  it("shows unknown provider warning", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "unknown",
      owner: "",
      repo: "",
      baseUrl: "",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Could not detect GitHub or GitLab/)).toBeInTheDocument();
    });
  });

  it("shows GitLab MR labels", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "gitlab",
      owner: "user",
      repo: "test",
      baseUrl: "https://gitlab.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 5,
        title: "Fix bug Y",
        state: "opened",
        author: "dev2",
        url: "https://gitlab.com/user/test/-/merge_requests/5",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "fix-y",
        targetBranch: "main",
        labels: ["bug", "critical"],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Fix bug Y")).toBeInTheDocument();
    });
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("switches to Create New tab and shows form fields", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Pull Request title...")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Description (optional)...")).toBeInTheDocument();
      expect(screen.getByText("Create as draft")).toBeInTheDocument();
    });
  });

  it("shows source branch from repo in create tab", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => {
      expect(screen.getByText("feature-branch")).toBeInTheDocument();
    });
  });

  it("Create PR button disabled when title is empty", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => {
      const createBtn = screen.getByText("Create Pull Request").closest("button")!;
      expect(createBtn).toBeDisabled();
    });
  });

  it("calls pr.create with form values when Create PR is submitted", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValue([]);
    mockCreatePr.mockResolvedValueOnce("https://github.com/user/test/pull/42");
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));

    fireEvent.change(screen.getByPlaceholderText("Pull Request title..."), {
      target: { value: "My new PR" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)..."), {
      target: { value: "This is the body" },
    });

    const createBtn = screen.getByText("Create Pull Request").closest("button")!;
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => {
      expect(mockCreatePr).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "My new PR",
          body: "This is the body",
          sourceBranch: "feature-branch",
        })
      );
    });
  });

  it("shows error when pr.create fails", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValue([]);
    mockCreatePr.mockRejectedValueOnce(new Error("Creation failed: no permission"));
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));
    fireEvent.change(screen.getByPlaceholderText("Pull Request title..."), {
      target: { value: "Bad PR" },
    });

    const createBtn = screen.getByText("Create Pull Request").closest("button")!;
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Creation failed: no permission")).toBeInTheDocument();
    });
  });

  it("shows error when loadData fails", async () => {
    mockDetectProvider.mockRejectedValueOnce(new Error("Network error"));
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows PR detail view when a PR is clicked", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 7,
        title: "Detail PR",
        state: "open",
        author: "alice",
        url: "https://github.com/user/test/pull/7",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "feat-x",
        targetBranch: "main",
        labels: [],
      },
    ]);
    mockViewPr.mockResolvedValueOnce("PR body details here");
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Detail PR"));
    fireEvent.click(screen.getByText("Detail PR"));

    await waitFor(() => {
      expect(screen.getByText("PR body details here")).toBeInTheDocument();
      expect(screen.getByText("Back to list")).toBeInTheDocument();
    });
  });

  it("shows 'Back to list' button returns to PR list", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 8,
        title: "Another PR",
        state: "open",
        author: "bob",
        url: "https://github.com/user/test/pull/8",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "feat-y",
        targetBranch: "main",
        labels: [],
      },
    ]);
    mockViewPr.mockResolvedValueOnce("Some detail");
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Another PR"));
    fireEvent.click(screen.getByText("Another PR"));

    await waitFor(() => screen.getByText("Back to list"));
    fireEvent.click(screen.getByText("Back to list"));

    await waitFor(() => {
      expect(screen.getByText("Another PR")).toBeInTheDocument();
      expect(screen.queryByText("Back to list")).not.toBeInTheDocument();
    });
  });

  it("shows loading state in detail view before view resolves", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 9,
        title: "Slow PR",
        state: "open",
        author: "carol",
        url: "https://github.com/user/test/pull/9",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "slow",
        targetBranch: "main",
        labels: [],
      },
    ]);
    let resolveView!: (val: string) => void;
    mockViewPr.mockReturnValueOnce(
      new Promise<string>((res) => {
        resolveView = res;
      })
    );
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Slow PR"));
    fireEvent.click(screen.getByText("Slow PR"));

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    await act(async () => {
      resolveView("Now loaded");
    });
    await waitFor(() => {
      expect(screen.getByText("Now loaded")).toBeInTheDocument();
    });
  });

  it("shows 'Failed to load details.' when pr.view throws", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 10,
        title: "Error PR",
        state: "open",
        author: "dave",
        url: "https://github.com/user/test/pull/10",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "err",
        targetBranch: "main",
        labels: [],
      },
    ]);
    mockViewPr.mockRejectedValueOnce(new Error("not found"));
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Error PR"));
    fireEvent.click(screen.getByText("Error PR"));

    await waitFor(() => {
      expect(screen.getByText("Failed to load details.")).toBeInTheDocument();
    });
  });

  it("switches tab back to list when list tab is clicked from create tab", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValue([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));
    await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));

    fireEvent.click(screen.getByText(/List \(/));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Pull Request title...")).not.toBeInTheDocument();
      expect(screen.getByText("No Pull Requests found")).toBeInTheDocument();
    });
  });

  it("toggles draft checkbox", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValue([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));
    await waitFor(() => screen.getByText("Create as draft"));

    const draftCheckbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(draftCheckbox.checked).toBe(false);
    fireEvent.click(draftCheckbox);
    expect(draftCheckbox.checked).toBe(true);
  });

  it("opens external URL after successful PR creation", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValue([]);
    mockCreatePr.mockResolvedValueOnce("https://github.com/user/test/pull/99");
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));
    await waitFor(() => screen.getByPlaceholderText("Pull Request title..."));

    fireEvent.change(screen.getByPlaceholderText("Pull Request title..."), {
      target: { value: "Valid PR" },
    });
    const createBtn = screen.getByText("Create Pull Request").closest("button")!;
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => {
      expect(mockOpenExternal).toHaveBeenCalledWith("https://github.com/user/test/pull/99");
    });
  });

  it("shows closed PR with correct state label", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 20,
        title: "Closed PR",
        state: "closed",
        author: "eve",
        url: "https://github.com/user/test/pull/20",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "closed-branch",
        targetBranch: "main",
        labels: [],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("closed")).toBeInTheDocument();
    });
  });

  it("shows AI Generate button in create tab", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => {
      expect(screen.getByText("AI Generate")).toBeInTheDocument();
    });
  });

  it("populates title and body when AI Generate is clicked", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    mockGeneratePrTitle.mockResolvedValueOnce("AI generated title");
    mockGeneratePrDescription.mockResolvedValueOnce("AI generated body");
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => screen.getByText("AI Generate"));
    await act(async () => {
      fireEvent.click(screen.getByText("AI Generate"));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("AI generated title")).toBeInTheDocument();
      expect(screen.getByDisplayValue("AI generated body")).toBeInTheDocument();
    });
    expect(mockGeneratePrTitle).toHaveBeenCalledWith("feature-branch", "main");
    expect(mockGeneratePrDescription).toHaveBeenCalledWith("feature-branch", "main");
  });

  it("shows error when AI generation fails", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([]);
    mockGeneratePrTitle.mockRejectedValueOnce(new Error("No AI provider configured"));
    mockGeneratePrDescription.mockRejectedValueOnce(new Error("No AI provider configured"));
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => screen.getByText("Create New"));
    fireEvent.click(screen.getByText("Create New"));

    await waitFor(() => screen.getByText("AI Generate"));
    await act(async () => {
      fireEvent.click(screen.getByText("AI Generate"));
    });

    await waitFor(() => {
      expect(screen.getByText("No AI provider configured")).toBeInTheDocument();
    });
  });

  it("shows merged PR state", async () => {
    mockDetectProvider.mockResolvedValueOnce({
      provider: "github",
      owner: "user",
      repo: "test",
      baseUrl: "https://github.com",
    });
    mockListPrs.mockResolvedValueOnce([
      {
        number: 21,
        title: "Merged PR",
        state: "merged",
        author: "frank",
        url: "https://github.com/user/test/pull/21",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        sourceBranch: "merged-branch",
        targetBranch: "main",
        labels: [],
      },
    ]);
    render(<PrDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("merged")).toBeInTheDocument();
    });
  });
});
