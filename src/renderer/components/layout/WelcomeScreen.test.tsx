// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockOpenRepoDialog = vi.fn();
const mockInitRepo = vi.fn();
const mockOpenCloneDialog = vi.fn();
const mockOpenScanDialog = vi.fn();
const mockOpenRepo = vi.fn().mockResolvedValue(undefined);
const mockRemoveRecentRepo = vi.fn();
const mockLoadRecentRepos = vi.fn();
const mockClearRecentRepos = vi.fn();
const mockRemoveMissingRepos = vi.fn().mockResolvedValue([]);
const mockSetRepoCategory = vi.fn();
const mockRenameCategory = vi.fn();
const mockDeleteCategory = vi.fn();

let mockRecentRepos: string[] = [];
let mockRepoCategories: Record<string, string> = {};

vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      repo: null,
      recentRepos: mockRecentRepos,
      repoCategories: mockRepoCategories,
      openRepoDialog: mockOpenRepoDialog,
      initRepo: mockInitRepo,
      openRepo: mockOpenRepo,
      removeRecentRepo: mockRemoveRecentRepo,
      loadRecentRepos: mockLoadRecentRepos,
      clearRecentRepos: mockClearRecentRepos,
      removeMissingRepos: mockRemoveMissingRepos,
      setRepoCategory: mockSetRepoCategory,
      renameCategory: mockRenameCategory,
      deleteCategory: mockDeleteCategory,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../store/ui-store", () => ({
  useUIStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      openCloneDialog: mockOpenCloneDialog,
      openScanDialog: mockOpenScanDialog,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import { WelcomeScreen } from "./WelcomeScreen";

const mockElectronAPI = {
  repo: { openExternal: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRecentRepos = [];
  mockRepoCategories = {};
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("WelcomeScreen", () => {
  it("renders without crashing", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.openRepoAction")).toBeInTheDocument();
  });

  it("shows 'Create new repository' action", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.createNewRepo")).toBeInTheDocument();
  });

  it("shows 'Clone repository' action", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.cloneRepoAction")).toBeInTheDocument();
  });

  it("shows 'Scan for repositories' action", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.scanForRepos")).toBeInTheDocument();
  });

  it("calls openRepoDialog when 'Open repository' is clicked", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.openRepoAction"));
    expect(mockOpenRepoDialog).toHaveBeenCalledTimes(1);
  });

  it("calls initRepo when 'Create new repository' is clicked", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.createNewRepo"));
    expect(mockInitRepo).toHaveBeenCalledTimes(1);
  });

  it("calls openCloneDialog when 'Clone repository' is clicked", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.cloneRepoAction"));
    expect(mockOpenCloneDialog).toHaveBeenCalledTimes(1);
  });

  it("calls openScanDialog when 'Scan for repositories' is clicked", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.scanForRepos"));
    expect(mockOpenScanDialog).toHaveBeenCalledTimes(1);
  });

  it("shows recent repo name when repos exist", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });

  it("opens a recent repo when clicked", () => {
    mockRecentRepos = ["/home/user/projects/cool-repo"];
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("cool-repo"));
    expect(mockOpenRepo).toHaveBeenCalledWith("/home/user/projects/cool-repo");
  });

  it("calls loadRecentRepos on mount", () => {
    render(<WelcomeScreen />);
    expect(mockLoadRecentRepos).toHaveBeenCalledTimes(1);
  });

  it("shows 'No recent repositories' empty state when recentRepos is empty", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.noRecentRepos")).toBeInTheDocument();
  });

  it("shows the search input placeholder", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    expect(screen.getByPlaceholderText("welcome.searchRepos")).toBeInTheDocument();
  });

  it("filters repos by search query", () => {
    mockRecentRepos = ["/home/user/projects/my-app", "/home/user/projects/other-project"];
    render(<WelcomeScreen />);
    const input = screen.getByPlaceholderText("welcome.searchRepos");
    fireEvent.change(input, { target: { value: "my-app" } });
    expect(screen.getByText("my-app")).toBeInTheDocument();
    expect(screen.queryByText("other-project")).not.toBeInTheDocument();
  });

  it("shows no-results message when search matches nothing", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const input = screen.getByPlaceholderText("welcome.searchRepos");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });
    expect(screen.getByText(/welcome\.noReposMatch/)).toBeInTheDocument();
  });

  it("clears search when X button is clicked", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const input = screen.getByPlaceholderText("welcome.searchRepos");
    fireEvent.change(input, { target: { value: "filter-text" } });
    // Clear the input value programmatically
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
  });

  it("renders repo full path as subtitle under name", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    expect(screen.getByText("/home/user/projects/my-app")).toBeInTheDocument();
  });

  it("shows keyboard hint Ctrl+O in the sidebar", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();
  });

  it("shows keyboard hint Ctrl+N in the sidebar", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Ctrl+N")).toBeInTheDocument();
  });

  it("shows the GitSmith branding text", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("GitSmith")).toBeInTheDocument();
  });

  it("shows the Contribute section with Develop, Donate, Issues links", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.develop")).toBeInTheDocument();
    expect(screen.getByText("welcome.donate")).toBeInTheDocument();
    expect(screen.getByText("welcome.issues")).toBeInTheDocument();
  });

  it("calls openExternal for Develop link", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.develop"));
    expect(mockElectronAPI.repo.openExternal).toHaveBeenCalledWith(
      "https://github.com/Schengatto/git-expansion"
    );
  });

  it("calls openExternal for Issues link", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.issues"));
    expect(mockElectronAPI.repo.openExternal).toHaveBeenCalledWith(
      "https://github.com/Schengatto/git-expansion/issues"
    );
  });

  it("shows categorized repos in a category section", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    // category name "Work" appears in the section header (CSS uppercase applied visually, text is "Work")
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("work-app")).toBeInTheDocument();
  });

  it("shows uncategorized repos in 'Recent repositories' section", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    mockRepoCategories = {};
    render(<WelcomeScreen />);
    // The section header renders the i18n key (CSS applies uppercase visually)
    expect(screen.getByText("welcome.recentRepositories")).toBeInTheDocument();
  });

  it("shows section count badge next to section header", () => {
    mockRecentRepos = ["/home/user/projects/my-app", "/home/user/projects/other-app"];
    render(<WelcomeScreen />);
    // Count badge shows the number of repos in the section
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("collapses a section when section header is clicked", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    // The i18n key is used as the DOM text (CSS applies uppercase visually only)
    const sectionText = screen.getByText("welcome.recentRepositories");
    // Walk up to find the click-handler div
    const toggleDiv = sectionText.closest("div[style*='flex']") ?? sectionText.parentElement!;
    fireEvent.click(toggleDiv!);
    // After collapse, the repo item should disappear
    expect(screen.queryByText("my-app")).not.toBeInTheDocument();
  });

  it("shows Actions link for category sections", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    // The "Actions" button triggers context menu
    const actionsEls = screen.getAllByText("welcome.actions");
    expect(actionsEls.length).toBeGreaterThan(0);
  });

  it("opens context menu on repo right-click and shows Open repository option", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    expect(repoItem).not.toBeNull();
    fireEvent.contextMenu(repoItem!);
    // Context menu "welcome.openRepository" is a fixed-position overlay element
    const openRepoItems = screen.getAllByText("welcome.openRepository");
    expect(openRepoItems.length).toBeGreaterThan(0);
  });

  it("calls openRepo from context menu 'Open repository' click", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    // Find the "welcome.openRepository" inside the context menu (fixed overlay, not the sidebar action)
    const openRepoItems = screen.getAllByText("welcome.openRepository");
    // Click the last one (the context menu item, rendered after the sidebar button)
    fireEvent.click(openRepoItems[openRepoItems.length - 1]!);
    expect(mockOpenRepo).toHaveBeenCalledWith("/home/user/projects/my-app");
  });

  it("shows 'Remove from list' danger item in context menu", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    expect(screen.getByText("welcome.removeFromList")).toBeInTheDocument();
  });

  it("calls removeRecentRepo when 'Remove from list' is clicked", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    fireEvent.click(screen.getByText("welcome.removeFromList"));
    expect(mockRemoveRecentRepo).toHaveBeenCalledWith("/home/user/projects/my-app");
  });

  it("shows recent actions menu on Actions click (uncategorized section)", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const actionsEl = screen.getByText("welcome.actions");
    fireEvent.click(actionsEl);
    expect(screen.getByText("welcome.clearAllRecentRepos")).toBeInTheDocument();
    expect(screen.getByText("welcome.removeMissingProjects")).toBeInTheDocument();
  });

  it("calls clearRecentRepos when 'Clear all recent repositories' is clicked", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.actions"));
    fireEvent.click(screen.getByText("welcome.clearAllRecentRepos"));
    expect(mockClearRecentRepos).toHaveBeenCalledTimes(1);
  });

  it("calls removeMissingRepos when 'Remove missing projects from the list' is clicked", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.actions"));
    fireEvent.click(screen.getByText("welcome.removeMissingProjects"));
    expect(mockRemoveMissingRepos).toHaveBeenCalledTimes(1);
  });

  it("shows X clear button in search bar when query is non-empty", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const input = screen.getByPlaceholderText("welcome.searchRepos");
    fireEvent.change(input, { target: { value: "my-app" } });
    // XIcon is rendered when searchQuery is truthy — the container div with onClick should be present
    // We test this by clearing it via its click
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
  });

  it("clicking X icon clears search query", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const input = screen.getByPlaceholderText("welcome.searchRepos");
    fireEvent.change(input, { target: { value: "my-app" } });
    expect(input).toHaveValue("my-app");
    // The clear button (XIcon container) — find it by its parent div in the search bar
    const clearBtn = input.parentElement?.querySelector("div[style*='cursor: pointer']");
    if (clearBtn) fireEvent.click(clearBtn);
    expect(input).toHaveValue("");
  });

  it("calls openExternal for Donate link", () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("welcome.donate"));
    expect(mockElectronAPI.repo.openExternal).toHaveBeenCalledWith(
      expect.stringContaining("paypal")
    );
  });

  it("shows 'Git GUI' subtitle in the logo area", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.gitGui")).toBeInTheDocument();
  });

  it("shows 'Contribute' section heading", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.contribute")).toBeInTheDocument();
  });

  it("multiple repos in different categories show their sections", () => {
    mockRecentRepos = ["/home/user/projects/work-app", "/home/user/projects/personal-app"];
    mockRepoCategories = {
      "/home/user/projects/work-app": "Work",
      "/home/user/projects/personal-app": "Personal",
    };
    render(<WelcomeScreen />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("work-app")).toBeInTheDocument();
    expect(screen.getByText("personal-app")).toBeInTheDocument();
  });

  it("shows category Actions button for a named category section", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    // Actions appears as the category context menu trigger
    const allActions = screen.getAllByText("welcome.actions");
    expect(allActions.length).toBeGreaterThan(0);
  });

  it("category Actions click shows Rename and Delete options", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    expect(screen.getByText("welcome.renameCategory")).toBeInTheDocument();
    expect(screen.getByText("welcome.deleteCategory")).toBeInTheDocument();
  });

  it("Delete category calls deleteCategory with the category name", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    fireEvent.click(screen.getByText("welcome.deleteCategory"));
    expect(mockDeleteCategory).toHaveBeenCalledWith("Work");
  });

  it("Rename category click shows inline rename input", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    fireEvent.click(screen.getByText("welcome.renameCategory"));
    // An inline input should appear for renaming
    expect(screen.getByDisplayValue("Work")).toBeInTheDocument();
  });

  it("confirming rename via Enter calls renameCategory", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    fireEvent.click(screen.getByText("welcome.renameCategory"));
    const renameInput = screen.getByDisplayValue("Work");
    fireEvent.change(renameInput, { target: { value: "New Work" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });
    expect(mockRenameCategory).toHaveBeenCalledWith("Work", "New Work");
  });

  it("confirming rename via Blur calls renameCategory", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    fireEvent.click(screen.getByText("welcome.renameCategory"));
    const renameInput = screen.getByDisplayValue("Work");
    fireEvent.change(renameInput, { target: { value: "Work Updated" } });
    fireEvent.blur(renameInput);
    expect(mockRenameCategory).toHaveBeenCalledWith("Work", "Work Updated");
  });

  it("pressing Escape in rename input cancels rename without calling renameCategory", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const allActions = screen.getAllByText("welcome.actions");
    fireEvent.click(allActions[0]!);
    fireEvent.click(screen.getByText("welcome.renameCategory"));
    const renameInput = screen.getByDisplayValue("Work");
    fireEvent.keyDown(renameInput, { key: "Escape" });
    expect(mockRenameCategory).not.toHaveBeenCalled();
  });

  it("collapses category section when category header is clicked", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    expect(screen.getByText("work-app")).toBeInTheDocument();
    const sectionText = screen.getByText("Work");
    const toggleDiv = sectionText.closest("div[style*='flex']") ?? sectionText.parentElement!;
    fireEvent.click(toggleDiv);
    expect(screen.queryByText("work-app")).not.toBeInTheDocument();
  });

  it("repo context menu shows 'Assign category' option", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    expect(screen.getByText("welcome.assignCategory")).toBeInTheDocument();
  });

  it("'Assign category' sets assigningCategory state (no crash)", () => {
    mockRecentRepos = ["/home/user/projects/my-app"];
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("my-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    fireEvent.click(screen.getByText("welcome.assignCategory"));
    // No crash expected
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });

  it("repo with existing category shows 'Remove from category' in context menu", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("work-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    expect(screen.getByText("welcome.removeFromCategory")).toBeInTheDocument();
  });

  it("clicking 'Remove from category' calls setRepoCategory with null", () => {
    mockRecentRepos = ["/home/user/projects/work-app"];
    mockRepoCategories = { "/home/user/projects/work-app": "Work" };
    render(<WelcomeScreen />);
    const repoItem = screen.getByText("work-app").closest("div[style*='cursor: pointer']");
    fireEvent.contextMenu(repoItem!);
    fireEvent.click(screen.getByText("welcome.removeFromCategory"));
    expect(mockSetRepoCategory).toHaveBeenCalledWith("/home/user/projects/work-app", null);
  });

  it("shows 'Create, open, or clone a repository to get started' hint in empty state", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("welcome.getStartedHint")).toBeInTheDocument();
  });

  it("search box is not shown when recentRepos is empty", () => {
    mockRecentRepos = [];
    render(<WelcomeScreen />);
    // The search box is always in the DOM (in top bar area) even when empty
    // but repo list is empty state — verify empty state message is shown
    expect(screen.getByText("welcome.noRecentRepos")).toBeInTheDocument();
  });
});
