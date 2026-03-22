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
const mockInit = vi.fn();
const mockClose = vi.fn();
const mockGetInfo = vi.fn();
const mockGetStatus = vi.fn();
const mockGetRecent = vi.fn();
const mockGetCategories = vi.fn();
const mockRemoveRecent = vi.fn();
const mockClearRecent = vi.fn();
const mockRemoveMissing = vi.fn();
const mockSetCategory = vi.fn();
const mockRenameCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockFetchAll = vi.fn();

vi.stubGlobal("window", {
  ...globalThis.window,
  electronAPI: {
    repo: {
      open: mockOpen,
      openDialog: mockOpenDialog,
      init: mockInit,
      close: mockClose,
      getInfo: mockGetInfo,
      getRecent: mockGetRecent,
      getCategories: mockGetCategories,
      removeRecent: mockRemoveRecent,
      clearRecent: mockClearRecent,
      removeMissing: mockRemoveMissing,
      setCategory: mockSetCategory,
      renameCategory: mockRenameCategory,
      deleteCategory: mockDeleteCategory,
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

const SAMPLE_REPO = {
  name: "test-repo",
  branch: "main",
  headCommit: "abc123",
  path: "/test",
};
const SAMPLE_STATUS = { staged: [], unstaged: [], untracked: [] };

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

describe("repo-store — openRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetStatus.mockResolvedValue(SAMPLE_STATUS);
    mockGetInfo.mockResolvedValue(SAMPLE_REPO);
    mockFetchAll.mockResolvedValue(undefined);
  });

  it("sets repo and clears loading on success", async () => {
    mockOpen.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().openRepo("/test");
    expect(useRepoStore.getState().repo).toEqual(SAMPLE_REPO);
    expect(useRepoStore.getState().loading).toBe(false);
    expect(useRepoStore.getState().error).toBeNull();
  });

  it("calls electronAPI.repo.open with the given path", async () => {
    mockOpen.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().openRepo("/some/path");
    expect(mockOpen).toHaveBeenCalledWith("/some/path");
  });

  it("triggers background fetchAll after opening a repo", async () => {
    const mockLoadGraph = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({
      loadGraph: mockLoadGraph,
    } as never);

    mockOpen.mockResolvedValue(SAMPLE_REPO);
    mockFetchAll.mockResolvedValue(undefined);

    await useRepoStore.getState().openRepo("/test");

    expect(mockFetchAll).toHaveBeenCalledOnce();

    await vi.waitFor(() => {
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });

  it("does not fail if background fetch errors", async () => {
    mockOpen.mockResolvedValue(SAMPLE_REPO);
    mockFetchAll.mockRejectedValue(new Error("network error"));

    await useRepoStore.getState().openRepo("/test");

    expect(useRepoStore.getState().repo).not.toBeNull();
    expect(useRepoStore.getState().error).toBeNull();
  });

  it("sets error and clears loading when open throws", async () => {
    mockOpen.mockRejectedValue(new Error("path not found"));
    await useRepoStore.getState().openRepo("/bad/path");
    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().loading).toBe(false);
    expect(useRepoStore.getState().error).toBe("path not found");
  });

  it("sets error as string when non-Error is thrown", async () => {
    mockOpen.mockRejectedValue("raw string error");
    await useRepoStore.getState().openRepo("/bad/path");
    expect(useRepoStore.getState().error).toBe("raw string error");
  });

  it("calls refreshStatus after opening", async () => {
    mockOpen.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().openRepo("/test");
    expect(mockGetStatus).toHaveBeenCalled();
  });
});

describe("repo-store — openRepoDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetStatus.mockResolvedValue(SAMPLE_STATUS);
    mockGetInfo.mockResolvedValue(SAMPLE_REPO);
    mockFetchAll.mockResolvedValue(undefined);
  });

  it("sets repo and clears loading when dialog returns a repo", async () => {
    mockOpenDialog.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().openRepoDialog();
    expect(useRepoStore.getState().repo).toEqual(SAMPLE_REPO);
    expect(useRepoStore.getState().loading).toBe(false);
  });

  it("triggers background fetchAll after openRepoDialog", async () => {
    const mockLoadGraph = vi.fn();
    vi.mocked(useGraphStore.getState).mockReturnValue({
      loadGraph: mockLoadGraph,
    } as never);

    mockOpenDialog.mockResolvedValue(SAMPLE_REPO);
    mockFetchAll.mockResolvedValue(undefined);

    await useRepoStore.getState().openRepoDialog();

    expect(mockFetchAll).toHaveBeenCalledOnce();

    await vi.waitFor(() => {
      expect(mockLoadGraph).toHaveBeenCalled();
    });
  });

  it("clears loading and leaves repo null when dialog returns null (cancelled)", async () => {
    mockOpenDialog.mockResolvedValue(null);
    await useRepoStore.getState().openRepoDialog();
    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().loading).toBe(false);
    expect(useRepoStore.getState().error).toBeNull();
  });

  it("does not call fetchAll when dialog is cancelled", async () => {
    mockOpenDialog.mockResolvedValue(null);
    await useRepoStore.getState().openRepoDialog();
    expect(mockFetchAll).not.toHaveBeenCalled();
  });

  it("sets error when openDialog throws", async () => {
    mockOpenDialog.mockRejectedValue(new Error("dialog failed"));
    await useRepoStore.getState().openRepoDialog();
    expect(useRepoStore.getState().error).toBe("dialog failed");
    expect(useRepoStore.getState().loading).toBe(false);
  });
});

describe("repo-store — initRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetStatus.mockResolvedValue(SAMPLE_STATUS);
    mockGetRecent.mockResolvedValue([]);
    mockGetCategories.mockResolvedValue({});
  });

  it("sets repo and clears loading on success", async () => {
    mockInit.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().initRepo();
    expect(useRepoStore.getState().repo).toEqual(SAMPLE_REPO);
    expect(useRepoStore.getState().loading).toBe(false);
  });

  it("calls refreshStatus after init", async () => {
    mockInit.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().initRepo();
    expect(mockGetStatus).toHaveBeenCalled();
  });

  it("calls loadRecentRepos after init", async () => {
    mockInit.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().initRepo();
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("clears loading and leaves repo null when init returns null (cancelled)", async () => {
    mockInit.mockResolvedValue(null);
    await useRepoStore.getState().initRepo();
    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().loading).toBe(false);
    expect(useRepoStore.getState().error).toBeNull();
  });

  it("does not call refreshStatus when init is cancelled", async () => {
    mockInit.mockResolvedValue(null);
    await useRepoStore.getState().initRepo();
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it("sets error when initRepo throws", async () => {
    mockInit.mockRejectedValue(new Error("init failed"));
    await useRepoStore.getState().initRepo();
    expect(useRepoStore.getState().error).toBe("init failed");
    expect(useRepoStore.getState().loading).toBe(false);
  });
});

describe("repo-store — closeRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("clears repo and status", () => {
    useRepoStore.setState({ repo: SAMPLE_REPO as never, status: SAMPLE_STATUS as never });
    useRepoStore.getState().closeRepo();
    expect(useRepoStore.getState().repo).toBeNull();
    expect(useRepoStore.getState().status).toBeNull();
  });

  it("calls electronAPI.repo.close", () => {
    useRepoStore.getState().closeRepo();
    expect(mockClose).toHaveBeenCalledOnce();
  });
});

describe("repo-store — refreshInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("updates repo when getInfo returns data", async () => {
    mockGetInfo.mockResolvedValue(SAMPLE_REPO);
    await useRepoStore.getState().refreshInfo();
    expect(useRepoStore.getState().repo).toEqual(SAMPLE_REPO);
  });

  it("does not update repo when getInfo returns null", async () => {
    useRepoStore.setState({ repo: SAMPLE_REPO as never });
    mockGetInfo.mockResolvedValue(null);
    await useRepoStore.getState().refreshInfo();
    // repo stays unchanged because null is falsy
    expect(useRepoStore.getState().repo).toEqual(SAMPLE_REPO);
  });

  it("does not throw when getInfo rejects", async () => {
    mockGetInfo.mockRejectedValue(new Error("io error"));
    await expect(useRepoStore.getState().refreshInfo()).resolves.toBeUndefined();
  });
});

describe("repo-store — refreshStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("sets status from API response", async () => {
    mockGetStatus.mockResolvedValue(SAMPLE_STATUS);
    await useRepoStore.getState().refreshStatus();
    expect(useRepoStore.getState().status).toEqual(SAMPLE_STATUS);
  });

  it("does not throw when status API rejects", async () => {
    mockGetStatus.mockRejectedValue(new Error("git error"));
    await expect(useRepoStore.getState().refreshStatus()).resolves.toBeUndefined();
  });
});

describe("repo-store — loadRecentRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("sets recentRepos and repoCategories from API", async () => {
    mockGetRecent.mockResolvedValue(["/repo/a", "/repo/b"]);
    mockGetCategories.mockResolvedValue({ "/repo/a": "work" });
    await useRepoStore.getState().loadRecentRepos();
    expect(useRepoStore.getState().recentRepos).toEqual(["/repo/a", "/repo/b"]);
    expect(useRepoStore.getState().repoCategories).toEqual({ "/repo/a": "work" });
  });

  it("calls both getRecent and getCategories in parallel", async () => {
    mockGetRecent.mockResolvedValue([]);
    mockGetCategories.mockResolvedValue({});
    await useRepoStore.getState().loadRecentRepos();
    expect(mockGetRecent).toHaveBeenCalledOnce();
    expect(mockGetCategories).toHaveBeenCalledOnce();
  });
});

describe("repo-store — removeRecentRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetRecent.mockResolvedValue(["/repo/b"]);
    mockGetCategories.mockResolvedValue({});
  });

  it("calls removeRecent with the given path", async () => {
    mockRemoveRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().removeRecentRepo("/repo/a");
    expect(mockRemoveRecent).toHaveBeenCalledWith("/repo/a");
  });

  it("reloads recent repos after removing", async () => {
    mockRemoveRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().removeRecentRepo("/repo/a");
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("updates recentRepos state after removal", async () => {
    mockRemoveRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().removeRecentRepo("/repo/a");
    await vi.waitFor(() => {
      expect(useRepoStore.getState().recentRepos).toEqual(["/repo/b"]);
    });
  });
});

describe("repo-store — clearRecentRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    useRepoStore.setState({
      recentRepos: ["/repo/a", "/repo/b"],
      repoCategories: { "/repo/a": "work" },
    });
  });

  it("calls clearRecent API", async () => {
    mockClearRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().clearRecentRepos();
    expect(mockClearRecent).toHaveBeenCalledOnce();
  });

  it("clears recentRepos state", async () => {
    mockClearRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().clearRecentRepos();
    expect(useRepoStore.getState().recentRepos).toEqual([]);
  });

  it("clears repoCategories state", async () => {
    mockClearRecent.mockResolvedValue(undefined);
    await useRepoStore.getState().clearRecentRepos();
    expect(useRepoStore.getState().repoCategories).toEqual({});
  });
});

describe("repo-store — removeMissingRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetRecent.mockResolvedValue(["/repo/b"]);
    mockGetCategories.mockResolvedValue({});
  });

  it("returns the list of removed repos", async () => {
    mockRemoveMissing.mockResolvedValue(["/repo/gone"]);
    const removed = await useRepoStore.getState().removeMissingRepos();
    expect(removed).toEqual(["/repo/gone"]);
  });

  it("calls removeMissing API", async () => {
    mockRemoveMissing.mockResolvedValue([]);
    await useRepoStore.getState().removeMissingRepos();
    expect(mockRemoveMissing).toHaveBeenCalledOnce();
  });

  it("reloads recent repos after removing missing", async () => {
    mockRemoveMissing.mockResolvedValue([]);
    await useRepoStore.getState().removeMissingRepos();
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("updates state with refreshed repo list", async () => {
    mockRemoveMissing.mockResolvedValue(["/repo/a"]);
    await useRepoStore.getState().removeMissingRepos();
    await vi.waitFor(() => {
      expect(useRepoStore.getState().recentRepos).toEqual(["/repo/b"]);
    });
  });
});

describe("repo-store — setRepoCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetRecent.mockResolvedValue(["/repo/a"]);
    mockGetCategories.mockResolvedValue({ "/repo/a": "personal" });
  });

  it("calls setCategory with the repo path and category", async () => {
    mockSetCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().setRepoCategory("/repo/a", "work");
    expect(mockSetCategory).toHaveBeenCalledWith("/repo/a", "work");
  });

  it("accepts null category to remove categorisation", async () => {
    mockSetCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().setRepoCategory("/repo/a", null);
    expect(mockSetCategory).toHaveBeenCalledWith("/repo/a", null);
  });

  it("reloads recent repos after setting category", async () => {
    mockSetCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().setRepoCategory("/repo/a", "work");
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("updates repoCategories after setting", async () => {
    mockSetCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().setRepoCategory("/repo/a", "personal");
    await vi.waitFor(() => {
      expect(useRepoStore.getState().repoCategories).toEqual({ "/repo/a": "personal" });
    });
  });
});

describe("repo-store — renameCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetRecent.mockResolvedValue(["/repo/a"]);
    mockGetCategories.mockResolvedValue({ "/repo/a": "new-name" });
  });

  it("calls renameCategory API with old and new names", async () => {
    mockRenameCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().renameCategory("old-name", "new-name");
    expect(mockRenameCategory).toHaveBeenCalledWith("old-name", "new-name");
  });

  it("reloads recent repos after renaming", async () => {
    mockRenameCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().renameCategory("old-name", "new-name");
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("updates state with renamed category", async () => {
    mockRenameCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().renameCategory("old-name", "new-name");
    await vi.waitFor(() => {
      expect(useRepoStore.getState().repoCategories).toEqual({ "/repo/a": "new-name" });
    });
  });
});

describe("repo-store — deleteCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGetRecent.mockResolvedValue(["/repo/a"]);
    mockGetCategories.mockResolvedValue({});
  });

  it("calls deleteCategory API with the given category name", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().deleteCategory("work");
    expect(mockDeleteCategory).toHaveBeenCalledWith("work");
  });

  it("reloads recent repos after deleting category", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().deleteCategory("work");
    expect(mockGetRecent).toHaveBeenCalled();
  });

  it("reflects cleared categories in state", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);
    await useRepoStore.getState().deleteCategory("work");
    expect(useRepoStore.getState().repoCategories).toEqual({});
  });
});
