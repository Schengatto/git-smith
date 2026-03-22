import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CommitInfo } from "../../shared/git-types";

// Mock graph-builder before any store import
vi.mock("../../shared/graph-builder", () => ({
  buildGraph: vi.fn((commits: CommitInfo[]) =>
    commits.map((c, _i) => ({
      commit: c,
      laneIndex: 0,
      edges: [],
      activeLaneCount: 1,
    }))
  ),
}));

// Mock repo-store so we can control the repo path returned by getState()
vi.mock("./repo-store", () => ({
  useRepoStore: {
    getState: vi.fn(() => ({ repo: { path: "/test/repo" } })),
  },
}));

import { buildGraph } from "../../shared/graph-builder";
import { useRepoStore } from "./repo-store";

const mockGetCommits = vi.fn();
const mockDetails = vi.fn();
const mockGetViewSettings = vi.fn();
const mockSetViewSettings = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    log: {
      getCommits: mockGetCommits,
      details: mockDetails,
    },
    repo: {
      getViewSettings: mockGetViewSettings,
      setViewSettings: mockSetViewSettings,
    },
  },
});

import { useGraphStore } from "./graph-store";

const makeCommit = (hash: string, parentHashes: string[] = []): CommitInfo => ({
  hash,
  abbreviatedHash: hash.slice(0, 7),
  subject: `commit ${hash}`,
  body: "",
  authorName: "Test User",
  authorEmail: "test@example.com",
  authorDate: "2024-01-01T00:00:00Z",
  committerDate: "2024-01-01T00:00:00Z",
  parentHashes,
  refs: [],
});

const resetStore = () => {
  useGraphStore.setState({
    rows: [],
    rowMap: new Map(),
    selectedCommit: null,
    loading: false,
    hasMore: true,
    totalLoaded: 0,
    branchFilter: "",
    branchVisibility: null,
    allCommits: [],
    viewSettingsRestored: false,
    authorFilter: null,
    authorFilterMode: "highlight",
  });
};

describe("graph-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    vi.mocked(useRepoStore.getState).mockReturnValue({
      repo: { path: "/test/repo" },
    } as never);
  });

  describe("initial state", () => {
    it("starts with no rows", () => {
      expect(useGraphStore.getState().rows).toEqual([]);
    });

    it("starts with loading false", () => {
      expect(useGraphStore.getState().loading).toBe(false);
    });

    it("starts with hasMore true", () => {
      expect(useGraphStore.getState().hasMore).toBe(true);
    });

    it("starts with empty branchFilter", () => {
      expect(useGraphStore.getState().branchFilter).toBe("");
    });

    it("starts with null branchVisibility", () => {
      expect(useGraphStore.getState().branchVisibility).toBeNull();
    });

    it("starts with null authorFilter", () => {
      expect(useGraphStore.getState().authorFilter).toBeNull();
    });

    it("starts with authorFilterMode = highlight", () => {
      expect(useGraphStore.getState().authorFilterMode).toBe("highlight");
    });
  });

  describe("loadGraph", () => {
    it("calls getCommits and sets rows", async () => {
      const commits = [makeCommit("aaa", []), makeCommit("bbb", ["aaa"])];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph();
      expect(mockGetCommits).toHaveBeenCalledOnce();
      expect(useGraphStore.getState().rows).toHaveLength(2);
    });

    it("sets loading to false after success", async () => {
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadGraph();
      expect(useGraphStore.getState().loading).toBe(false);
    });

    it("calls buildGraph with the fetched commits", async () => {
      const commits = [makeCommit("aaa")];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph();
      expect(buildGraph).toHaveBeenCalledWith(commits);
    });

    it("sets hasMore to true when commits.length >= maxCount", async () => {
      const commits = Array.from({ length: 500 }, (_, i) => makeCommit(`hash${i}`));
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph(500);
      expect(useGraphStore.getState().hasMore).toBe(true);
    });

    it("sets hasMore to false when commits.length < maxCount", async () => {
      const commits = [makeCommit("only-one")];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph(500);
      expect(useGraphStore.getState().hasMore).toBe(false);
    });

    it("passes branchFilter to getCommits when set", async () => {
      useGraphStore.setState({ branchFilter: "main" });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadGraph();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, "main", undefined);
    });

    it("passes undefined for branchFilter when empty string", async () => {
      useGraphStore.setState({ branchFilter: "" });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadGraph();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, undefined, undefined);
    });

    it("passes branchVisibility to getCommits when branches are non-empty", async () => {
      const vis = { mode: "include" as const, branches: ["main"] };
      useGraphStore.setState({ branchVisibility: vis });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadGraph();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, undefined, vis);
    });

    it("passes undefined for branchVisibility when branches list is empty", async () => {
      const vis = { mode: "include" as const, branches: [] };
      useGraphStore.setState({ branchVisibility: vis });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadGraph();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, undefined, undefined);
    });

    it("sets totalLoaded to the number of commits fetched", async () => {
      const commits = [makeCommit("a"), makeCommit("b"), makeCommit("c")];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph();
      expect(useGraphStore.getState().totalLoaded).toBe(3);
    });

    it("populates rowMap with hash to index mapping", async () => {
      const commits = [makeCommit("aaa"), makeCommit("bbb")];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph();
      const { rowMap } = useGraphStore.getState();
      expect(rowMap.get("aaa")).toBe(0);
      expect(rowMap.get("bbb")).toBe(1);
    });

    it("sets loading to false on error", async () => {
      mockGetCommits.mockRejectedValue(new Error("git error"));
      await useGraphStore.getState().loadGraph();
      expect(useGraphStore.getState().loading).toBe(false);
    });

    it("stores allCommits", async () => {
      const commits = [makeCommit("aaa")];
      mockGetCommits.mockResolvedValue(commits);
      await useGraphStore.getState().loadGraph();
      expect(useGraphStore.getState().allCommits).toEqual(commits);
    });
  });

  describe("loadMore", () => {
    it("does nothing if loading is true", async () => {
      useGraphStore.setState({ loading: true, hasMore: true });
      await useGraphStore.getState().loadMore();
      expect(mockGetCommits).not.toHaveBeenCalled();
    });

    it("does nothing if hasMore is false", async () => {
      useGraphStore.setState({ loading: false, hasMore: false });
      await useGraphStore.getState().loadMore();
      expect(mockGetCommits).not.toHaveBeenCalled();
    });

    it("appends new commits to allCommits", async () => {
      const existing = [makeCommit("aaa")];
      const more = [makeCommit("bbb")];
      useGraphStore.setState({
        allCommits: existing,
        totalLoaded: 1,
        hasMore: true,
        loading: false,
      });
      mockGetCommits.mockResolvedValue(more);
      await useGraphStore.getState().loadMore();
      expect(useGraphStore.getState().allCommits).toEqual([...existing, ...more]);
    });

    it("sets loading to false after success", async () => {
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 1,
        allCommits: [],
      });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadMore();
      expect(useGraphStore.getState().loading).toBe(false);
    });

    it("updates totalLoaded by adding new commits count", async () => {
      const more = [makeCommit("bbb"), makeCommit("ccc")];
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 5,
        allCommits: [],
      });
      mockGetCommits.mockResolvedValue(more);
      await useGraphStore.getState().loadMore();
      expect(useGraphStore.getState().totalLoaded).toBe(7);
    });

    it("sets hasMore false when fewer commits than CHUNK_SIZE are returned", async () => {
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 0,
        allCommits: [],
      });
      mockGetCommits.mockResolvedValue([makeCommit("only")]);
      await useGraphStore.getState().loadMore();
      expect(useGraphStore.getState().hasMore).toBe(false);
    });

    it("sets loading to false on error", async () => {
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 0,
        allCommits: [],
      });
      mockGetCommits.mockRejectedValue(new Error("network error"));
      await useGraphStore.getState().loadMore();
      expect(useGraphStore.getState().loading).toBe(false);
    });

    it("passes branchVisibility to getCommits when branches are non-empty", async () => {
      const vis = { mode: "exclude" as const, branches: ["feature"] };
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 0,
        allCommits: [],
        branchVisibility: vis,
      });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadMore();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, undefined, vis);
    });

    it("passes undefined for branchVisibility when branches list is empty", async () => {
      const vis = { mode: "exclude" as const, branches: [] };
      useGraphStore.setState({
        loading: false,
        hasMore: true,
        totalLoaded: 0,
        allCommits: [],
        branchVisibility: vis,
      });
      mockGetCommits.mockResolvedValue([]);
      await useGraphStore.getState().loadMore();
      expect(mockGetCommits).toHaveBeenCalledWith(expect.any(Number), 0, undefined, undefined);
    });

    it("rebuilds rowMap after loading more commits", async () => {
      const existing = [makeCommit("aaa")];
      const more = [makeCommit("bbb")];
      useGraphStore.setState({
        allCommits: existing,
        totalLoaded: 1,
        hasMore: true,
        loading: false,
      });
      mockGetCommits.mockResolvedValue(more);
      await useGraphStore.getState().loadMore();
      const { rowMap } = useGraphStore.getState();
      expect(rowMap.has("aaa")).toBe(true);
      expect(rowMap.has("bbb")).toBe(true);
    });
  });

  describe("selectCommit", () => {
    it("fetches commit details and sets selectedCommit", async () => {
      const commit = makeCommit("abc123");
      mockDetails.mockResolvedValue(commit);
      await useGraphStore.getState().selectCommit("abc123");
      expect(mockDetails).toHaveBeenCalledWith("abc123");
      expect(useGraphStore.getState().selectedCommit).toEqual(commit);
    });

    it("does not throw on error", async () => {
      mockDetails.mockRejectedValue(new Error("not found"));
      await expect(useGraphStore.getState().selectCommit("bad")).resolves.toBeUndefined();
    });

    it("leaves selectedCommit unchanged on error", async () => {
      const existing = makeCommit("prev");
      useGraphStore.setState({ selectedCommit: existing });
      mockDetails.mockRejectedValue(new Error("fail"));
      await useGraphStore.getState().selectCommit("bad");
      expect(useGraphStore.getState().selectedCommit).toEqual(existing);
    });
  });

  describe("clearSelection", () => {
    it("sets selectedCommit to null", () => {
      useGraphStore.setState({ selectedCommit: makeCommit("abc") });
      useGraphStore.getState().clearSelection();
      expect(useGraphStore.getState().selectedCommit).toBeNull();
    });
  });

  describe("setBranchFilter", () => {
    it("updates branchFilter in state", () => {
      useGraphStore.getState().setBranchFilter("feature/x");
      expect(useGraphStore.getState().branchFilter).toBe("feature/x");
    });

    it("calls setViewSettings with the new filter when repo path is set", () => {
      mockSetViewSettings.mockResolvedValue(undefined);
      useGraphStore.getState().setBranchFilter("main");
      expect(mockSetViewSettings).toHaveBeenCalledWith("/test/repo", {
        branchFilter: "main",
      });
    });

    it("does not call setViewSettings when repo is null", () => {
      vi.mocked(useRepoStore.getState).mockReturnValue({ repo: null } as never);
      useGraphStore.getState().setBranchFilter("main");
      expect(mockSetViewSettings).not.toHaveBeenCalled();
    });
  });

  describe("setBranchVisibility", () => {
    it("updates branchVisibility in state", () => {
      const vis = { mode: "include" as const, branches: ["main"] };
      useGraphStore.getState().setBranchVisibility(vis);
      expect(useGraphStore.getState().branchVisibility).toEqual(vis);
    });

    it("accepts null to clear visibility", () => {
      useGraphStore.setState({
        branchVisibility: { mode: "include", branches: ["main"] },
      });
      useGraphStore.getState().setBranchVisibility(null);
      expect(useGraphStore.getState().branchVisibility).toBeNull();
    });

    it("calls setViewSettings with the new visibility when repo path is set", () => {
      mockSetViewSettings.mockResolvedValue(undefined);
      const vis = { mode: "exclude" as const, branches: ["old-branch"] };
      useGraphStore.getState().setBranchVisibility(vis);
      expect(mockSetViewSettings).toHaveBeenCalledWith("/test/repo", {
        branchVisibility: vis,
      });
    });

    it("does not call setViewSettings when repo is null", () => {
      vi.mocked(useRepoStore.getState).mockReturnValue({ repo: null } as never);
      useGraphStore.getState().setBranchVisibility(null);
      expect(mockSetViewSettings).not.toHaveBeenCalled();
    });
  });

  describe("setAuthorFilter", () => {
    it("sets authorFilter to the given value", () => {
      useGraphStore.getState().setAuthorFilter("alice@example.com");
      expect(useGraphStore.getState().authorFilter).toBe("alice@example.com");
    });

    it("sets authorFilter to null to clear it", () => {
      useGraphStore.setState({ authorFilter: "alice@example.com" });
      useGraphStore.getState().setAuthorFilter(null);
      expect(useGraphStore.getState().authorFilter).toBeNull();
    });
  });

  describe("setAuthorFilterMode", () => {
    it("sets mode to filter", () => {
      useGraphStore.getState().setAuthorFilterMode("filter");
      expect(useGraphStore.getState().authorFilterMode).toBe("filter");
    });

    it("sets mode back to highlight", () => {
      useGraphStore.setState({ authorFilterMode: "filter" });
      useGraphStore.getState().setAuthorFilterMode("highlight");
      expect(useGraphStore.getState().authorFilterMode).toBe("highlight");
    });
  });

  describe("restoreViewSettings", () => {
    it("does nothing when repo path is null", async () => {
      vi.mocked(useRepoStore.getState).mockReturnValue({ repo: null } as never);
      await useGraphStore.getState().restoreViewSettings();
      expect(mockGetViewSettings).not.toHaveBeenCalled();
      expect(useGraphStore.getState().viewSettingsRestored).toBe(false);
    });

    it("restores branchFilter and branchVisibility from saved settings", async () => {
      const saved = {
        branchFilter: "main",
        branchVisibility: { mode: "include", branches: ["main"] },
      };
      mockGetViewSettings.mockResolvedValue(saved);
      await useGraphStore.getState().restoreViewSettings();
      expect(useGraphStore.getState().branchFilter).toBe("main");
      expect(useGraphStore.getState().branchVisibility).toEqual(saved.branchVisibility);
      expect(useGraphStore.getState().viewSettingsRestored).toBe(true);
    });

    it("sets viewSettingsRestored to true even when API throws", async () => {
      mockGetViewSettings.mockRejectedValue(new Error("io error"));
      await useGraphStore.getState().restoreViewSettings();
      expect(useGraphStore.getState().viewSettingsRestored).toBe(true);
    });

    it("defaults branchFilter to empty string when not in saved settings", async () => {
      mockGetViewSettings.mockResolvedValue({});
      await useGraphStore.getState().restoreViewSettings();
      expect(useGraphStore.getState().branchFilter).toBe("");
    });

    it("defaults branchVisibility to null when not in saved settings", async () => {
      mockGetViewSettings.mockResolvedValue({});
      await useGraphStore.getState().restoreViewSettings();
      expect(useGraphStore.getState().branchVisibility).toBeNull();
    });
  });
});
