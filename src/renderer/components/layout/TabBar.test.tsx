// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockSetActiveTab = vi.fn();
const mockRemoveTab = vi.fn();
const mockOpenRepo = vi.fn().mockResolvedValue(undefined);
const mockLoadGraph = vi.fn().mockResolvedValue(undefined);

type Tab = { id: string; repoPath: string; repoName: string; isDirty: boolean };

let mockTabs: Tab[] = [];
let mockActiveTabId: string | null = null;

vi.mock("../../store/workspace-store", () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = {
        tabs: mockTabs,
        activeTabId: mockActiveTabId,
        setActiveTab: mockSetActiveTab,
        removeTab: mockRemoveTab,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        tabs: mockTabs,
        activeTabId: mockActiveTabId,
      }),
      subscribe: () => () => {},
    }
  ),
  // WorkspaceTab type re-export is not needed for tests
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(() => ({ openRepo: mockOpenRepo }), {
    getState: () => ({ tabs: mockTabs, activeTabId: mockActiveTabId }),
    subscribe: () => () => {},
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: Object.assign(() => ({ loadGraph: mockLoadGraph }), {
    getState: () => ({ loadGraph: mockLoadGraph }),
    subscribe: () => () => {},
  }),
}));

import { TabBar } from "./TabBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const makeTabs = (count: number): Tab[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `tab-${i + 1}`,
    repoPath: `/repos/repo${i + 1}`,
    repoName: `Repo ${i + 1}`,
    isDirty: false,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  mockTabs = makeTabs(2);
  mockActiveTabId = "tab-1";
});

describe("TabBar", () => {
  it("renders tab names when there are multiple tabs", () => {
    render(<TabBar />);
    expect(screen.getByText("Repo 1")).toBeInTheDocument();
    expect(screen.getByText("Repo 2")).toBeInTheDocument();
  });

  it("renders close buttons for each tab", () => {
    render(<TabBar />);
    const closeButtons = screen.getAllByTitle("tabBar.closeTab");
    expect(closeButtons).toHaveLength(2);
  });

  it("calls setActiveTab when clicking an inactive tab", () => {
    render(<TabBar />);
    fireEvent.click(screen.getByText("Repo 2"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
  });

  it("does not call setActiveTab when clicking the already active tab", () => {
    render(<TabBar />);
    fireEvent.click(screen.getByText("Repo 1"));
    expect(mockSetActiveTab).not.toHaveBeenCalled();
  });

  it("calls removeTab when close button is clicked", () => {
    render(<TabBar />);
    const closeButtons = screen.getAllByTitle("tabBar.closeTab");
    fireEvent.click(closeButtons[0]!);
    expect(mockRemoveTab).toHaveBeenCalledWith("tab-1");
  });

  it("returns null (renders nothing) when there is only one tab", () => {
    mockTabs = makeTabs(1);
    mockActiveTabId = "tab-1";
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dirty indicator dot for dirty tabs", () => {
    mockTabs = [
      { id: "tab-1", repoPath: "/repos/a", repoName: "Repo A", isDirty: true },
      { id: "tab-2", repoPath: "/repos/b", repoName: "Repo B", isDirty: false },
    ];
    mockActiveTabId = "tab-1";
    const { container } = render(<TabBar />);
    // Dirty indicator is a small circle span — look for its distinctive inline style
    const dots = container.querySelectorAll("span[style*='border-radius: 50%']");
    expect(dots.length).toBe(1);
  });
});
