import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock graph store before importing repo-store
vi.mock("./graph-store", () => ({
  useGraphStore: {
    getState: vi.fn(() => ({
      loadGraph: vi.fn(),
    })),
  },
}));

import { useGraphStore } from "./graph-store";

const mockOpen = vi.fn();
const mockOpenDialog = vi.fn();
const mockGetInfo = vi.fn();
const mockGetStatus = vi.fn();
const mockFetchAll = vi.fn();

vi.stubGlobal("window", {
  ...globalThis.window,
  electronAPI: {
    repo: {
      open: mockOpen,
      openDialog: mockOpenDialog,
      getInfo: mockGetInfo,
      close: vi.fn(),
    },
    status: {
      get: mockGetStatus,
    },
    remote: {
      fetchAll: mockFetchAll,
    },
  },
});

import { useRepoStore } from "./repo-store";

const resetStore = () => {
  useRepoStore.setState({
    repo: null,
    status: null,
    recentRepos: [],
    repoCategories: {},
    loading: false,
    error: null,
  });
};

describe("repo-store auto-fetch on open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetStatus.mockResolvedValue({ staged: [], unstaged: [], untracked: [] });
    mockGetInfo.mockResolvedValue({ name: "test-repo", branch: "main", headCommit: "abc123", path: "/test" });
  });

  it("triggers background fetchAll after opening a repo", async () => {
    const mockLoadGraph = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({ loadGraph: mockLoadGraph } as never);

    mockOpen.mockResolvedValue({ name: "test-repo", branch: "main", headCommit: "abc123", path: "/test" });
    mockFetchAll.mockResolvedValue(undefined);

    await useRepoStore.getState().openRepo("/test");

    // fetchAll should have been called
    expect(mockFetchAll).toHaveBeenCalledOnce();

    // Wait for the background fetch promise chain to resolve
    await vi.waitFor(() => {
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });

  it("does not fail if background fetch errors", async () => {
    mockOpen.mockResolvedValue({ name: "test-repo", branch: "main", headCommit: "abc123", path: "/test" });
    mockFetchAll.mockRejectedValue(new Error("network error"));

    // Should not throw
    await useRepoStore.getState().openRepo("/test");

    expect(useRepoStore.getState().repo).not.toBeNull();
    expect(useRepoStore.getState().error).toBeNull();
  });

  it("triggers background fetchAll after openRepoDialog", async () => {
    const mockLoadGraph = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({ loadGraph: mockLoadGraph } as never);

    mockOpenDialog.mockResolvedValue({ name: "test-repo", branch: "main", headCommit: "abc123", path: "/test" });
    mockFetchAll.mockResolvedValue(undefined);

    await useRepoStore.getState().openRepoDialog();

    expect(mockFetchAll).toHaveBeenCalledOnce();

    await vi.waitFor(() => {
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });
});
