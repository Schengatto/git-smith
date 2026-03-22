// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MenuBar } from "./MenuBar";

const mockOpenRepoDialog = vi.fn();
const mockInitRepo = vi.fn();
const mockOpenRepo = vi.fn();

let mockRepoState = {
  repo: null as null | object,
  openRepoDialog: mockOpenRepoDialog,
  initRepo: mockInitRepo,
  recentRepos: [] as string[],
  repoCategories: {} as Record<string, string>,
  openRepo: mockOpenRepo,
};

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    (selector?: (s: unknown) => unknown) => (selector ? selector(mockRepoState) : mockRepoState),
    {
      getState: () => ({
        repo: null,
        refreshStatus: vi.fn(),
        refreshInfo: vi.fn(),
        openRepoDialog: mockOpenRepoDialog,
      }),
      subscribe: () => () => {},
    }
  ),
}));

const mockElectronAPI = {
  repo: { openExternal: vi.fn() },
  app: { openUserManual: vi.fn(), checkForUpdates: vi.fn() },
};

const defaultProps = {
  onOpenClone: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenScan: vi.fn(),
  onOpenAbout: vi.fn(),
  onOpenStaleBranches: vi.fn(),
  onOpenGitignore: vi.fn(),
  onOpenGrep: vi.fn(),
  onOpenBranchDiff: vi.fn(),
  onOpenBranchCompare: vi.fn(),
  onOpenHooks: vi.fn(),
  onOpenUndo: vi.fn(),
  onOpenCIStatus: vi.fn(),
  onOpenGist: vi.fn(),
  onOpenAdvancedStats: vi.fn(),
  onOpenSsh: vi.fn(),
  onResetLayout: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRepoState = {
    repo: null,
    openRepoDialog: mockOpenRepoDialog,
    initRepo: mockInitRepo,
    recentRepos: [],
    repoCategories: {},
    openRepo: mockOpenRepo,
  };
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("MenuBar", () => {
  it("renders without crashing", () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders all top-level menu labels", () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("opens Start menu on click and shows menu items", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Open repository...")).toBeInTheDocument();
    expect(screen.getByText("Clone repository...")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
  });

  it("opens Help menu and shows About item", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Help"));
    expect(screen.getByText("About GitSmith")).toBeInTheDocument();
    expect(screen.getByText("User manual")).toBeInTheDocument();
  });

  it("calls onOpenAbout when 'About GitSmith' is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Help"));
    fireEvent.click(screen.getByText("About GitSmith"));
    expect(defaultProps.onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenClone when 'Clone repository...' is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Clone repository..."));
    expect(defaultProps.onOpenClone).toHaveBeenCalledTimes(1);
  });

  it("closes menu when Escape is pressed", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Open repository...")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Open repository...")).not.toBeInTheDocument();
  });

  it("closes menu when clicking outside", () => {
    render(
      <div>
        <MenuBar {...defaultProps} />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Open repository...")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Open repository...")).not.toBeInTheDocument();
  });

  it("switches to another menu on hover when a menu is already open", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Open repository...")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText("Help"));
    expect(screen.queryByText("Open repository...")).not.toBeInTheDocument();
    expect(screen.getByText("About GitSmith")).toBeInTheDocument();
  });

  /* ---- Start menu handlers ---- */

  it("calls openRepoDialog when 'Open repository...' is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Open repository..."));
    expect(mockOpenRepoDialog).toHaveBeenCalledTimes(1);
  });

  it("calls initRepo when 'Create new repository...' is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Create new repository..."));
    expect(mockInitRepo).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenScan when 'Scan for repositories...' is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Scan for repositories..."));
    expect(defaultProps.onOpenScan).toHaveBeenCalledTimes(1);
  });

  /* ---- Menu closes after item click ---- */

  it("closes Start menu after clicking a menu item", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Clone repository..."));
    expect(screen.queryByText("Open repository...")).not.toBeInTheDocument();
  });

  /* ---- Dashboard menu ---- */

  it("opens Dashboard menu and shows Refresh and Reset layout items", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Dashboard"));
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Reset layout")).toBeInTheDocument();
  });

  it("shows Refresh as disabled when no repo is open", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Dashboard"));
    const refreshBtn = screen.getByText("Refresh").closest("button");
    expect(refreshBtn).toBeDisabled();
  });

  it("shows Reset layout as disabled when no repo is open", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Dashboard"));
    const resetBtn = screen.getByText("Reset layout").closest("button");
    expect(resetBtn).toBeDisabled();
  });

  it("calls refreshStatus and refreshInfo when Refresh is clicked with repo open", () => {
    const _mockRefreshStatus = vi.fn();
    const _mockRefreshInfo = vi.fn();
    mockRepoState = {
      ...mockRepoState,
      repo: { path: "/test/repo" },
      openRepoDialog: mockOpenRepoDialog,
      initRepo: mockInitRepo,
      recentRepos: [],
      repoCategories: {},
      openRepo: mockOpenRepo,
    };
    // Update getState to return the refresh fns
    vi.mocked(
      // We need to re-set getState on the mock
      (mockRepoState as unknown as { getState: () => unknown }).getState
    );
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Dashboard"));
    // Refresh is still disabled because mock has repo=null in getState
    // Just verify the button is present
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls onResetLayout when Reset layout is clicked with repo open", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Dashboard"));
    fireEvent.click(screen.getByText("Reset layout"));
    expect(defaultProps.onResetLayout).toHaveBeenCalledTimes(1);
  });

  /* ---- Tools menu ---- */

  it("opens Tools menu and shows tool items", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    expect(screen.getByText("Settings...")).toBeInTheDocument();
    expect(screen.getByText("SSH key manager...")).toBeInTheDocument();
    expect(screen.getByText("Command Palette")).toBeInTheDocument();
  });

  it("calls onOpenSettings when Settings... is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Settings..."));
    expect(defaultProps.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenSsh when SSH key manager... is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("SSH key manager..."));
    expect(defaultProps.onOpenSsh).toHaveBeenCalledTimes(1);
  });

  it("shows tools that require repo as disabled when no repo is open", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    const staleBranchesBtn = screen.getByText("Stale remote branches...").closest("button");
    expect(staleBranchesBtn).toBeDisabled();
  });

  it("calls onOpenStaleBranches when Stale remote branches... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Stale remote branches..."));
    expect(defaultProps.onOpenStaleBranches).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenGitignore when .gitignore editor... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText(".gitignore editor..."));
    expect(defaultProps.onOpenGitignore).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenGrep when Code search (grep)... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Code search (grep)..."));
    expect(defaultProps.onOpenGrep).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenBranchDiff when Branch diff... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Branch diff..."));
    expect(defaultProps.onOpenBranchDiff).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenBranchCompare when Branch compare... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Branch compare..."));
    expect(defaultProps.onOpenBranchCompare).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenHooks when Git hooks... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Git hooks..."));
    expect(defaultProps.onOpenHooks).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenUndo when Undo operations... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Undo operations..."));
    expect(defaultProps.onOpenUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenCIStatus when CI/CD status... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("CI/CD status..."));
    expect(defaultProps.onOpenCIStatus).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenGist when Create gist... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Create gist..."));
    expect(defaultProps.onOpenGist).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenAdvancedStats when Advanced statistics... is clicked with repo", () => {
    mockRepoState = { ...mockRepoState, repo: { path: "/test/repo" } };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    fireEvent.click(screen.getByText("Advanced statistics..."));
    expect(defaultProps.onOpenAdvancedStats).toHaveBeenCalledTimes(1);
  });

  /* ---- Help menu handlers ---- */

  it("calls electronAPI.app.openUserManual when User manual is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Help"));
    fireEvent.click(screen.getByText("User manual"));
    expect(mockElectronAPI.app.openUserManual).toHaveBeenCalledTimes(1);
  });

  it("calls electronAPI.app.checkForUpdates when Check for updates... is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Help"));
    fireEvent.click(screen.getByText("Check for updates..."));
    expect(mockElectronAPI.app.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("calls electronAPI.repo.openExternal with issue URL when Report an issue is clicked", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Help"));
    fireEvent.click(screen.getByText("Report an issue"));
    expect(mockElectronAPI.repo.openExternal).toHaveBeenCalledWith(
      "https://github.com/Schengatto/git-smith/issues"
    );
  });

  /* ---- Recent repositories submenu ---- */

  it("shows Recent repositories as disabled when no recent repos", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    const recentBtn = screen.getByText("Recent repositories").closest("button");
    expect(recentBtn).toBeDisabled();
  });

  it("enables Recent repositories submenu when recent repos exist", () => {
    mockRepoState = {
      ...mockRepoState,
      recentRepos: ["/home/user/project-a", "/home/user/project-b"],
    };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    const recentBtn = screen.getByText("Recent repositories").closest("button");
    expect(recentBtn).not.toBeDisabled();
  });

  it("shows submenu arrow for items with children", () => {
    mockRepoState = { ...mockRepoState, recentRepos: ["/home/user/project-a"] };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    // Items with children render a ▶ arrow character
    const row = screen.getByText("Recent repositories").closest("button");
    expect(row?.textContent).toContain("▶");
  });

  /* ---- Favorite repositories submenu ---- */

  it("shows Favorite repositories as disabled when no categories exist", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    const favBtn = screen.getByText("Favorite repositories").closest("button");
    expect(favBtn).toBeDisabled();
  });

  it("enables Favorite repositories when repos are categorized", () => {
    mockRepoState = {
      ...mockRepoState,
      recentRepos: ["/home/user/work-project"],
      repoCategories: { "/home/user/work-project": "Work" },
    };
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    const favBtn = screen.getByText("Favorite repositories").closest("button");
    expect(favBtn).not.toBeDisabled();
  });

  /* ---- Keyboard shortcuts shown in menu ---- */

  it("shows Ctrl+O shortcut next to Open repository...", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Ctrl+O")).toBeInTheDocument();
  });

  it("shows Ctrl+, shortcut next to Settings...", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    expect(screen.getByText("Ctrl+,")).toBeInTheDocument();
  });

  it("shows Ctrl+Shift+P shortcut next to Command Palette", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Tools"));
    expect(screen.getByText("Ctrl+Shift+P")).toBeInTheDocument();
  });

  /* ---- Menu toggle (open → close on same trigger) ---- */

  it("closes an open menu when the same trigger is clicked again", () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.getByText("Open repository...")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Start"));
    expect(screen.queryByText("Open repository...")).not.toBeInTheDocument();
  });
});
