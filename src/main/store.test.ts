import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// Mock electron modules before importing store
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/test-app-data"),
    on: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

// Mock fs so we control what "on disk" looks like
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock("fs", () => ({
  default: {
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  },
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

// Helper: reset module cache so cachedStore is cleared between tests.
// vi.mock calls are hoisted automatically by vitest, so we only need to
// reset modules and re-import to get a fresh cachedStore = null.
async function freshStore() {
  vi.resetModules();
  return await import("./store");
}

// Simulate a missing/corrupt config file → returns defaults
function simulateNoFile() {
  mockReadFileSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
}

// Simulate a config file on disk
function simulateFile(data: object) {
  mockReadFileSync.mockReturnValue(JSON.stringify(data));
}

describe("main/store — getRecentRepos / addRecentRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when config file does not exist", async () => {
    simulateNoFile();
    const { getRecentRepos } = await freshStore();
    expect(getRecentRepos()).toEqual([]);
  });

  it("returns repos stored in config file", async () => {
    simulateFile({ recentRepos: ["/home/user/project-a", "/home/user/project-b"] });
    const { getRecentRepos } = await freshStore();
    expect(getRecentRepos()).toEqual(["/home/user/project-a", "/home/user/project-b"]);
  });

  it("addRecentRepo prepends to the list", async () => {
    simulateFile({ recentRepos: ["/home/user/existing"] });
    const { addRecentRepo, getRecentRepos } = await freshStore();
    addRecentRepo("/home/user/new-repo");
    expect(getRecentRepos()[0]).toBe("/home/user/new-repo");
  });

  it("addRecentRepo deduplicates — moves existing entry to front", async () => {
    simulateFile({ recentRepos: ["/home/user/a", "/home/user/b"] });
    const { addRecentRepo, getRecentRepos } = await freshStore();
    addRecentRepo("/home/user/b");
    const repos = getRecentRepos();
    expect(repos[0]).toBe("/home/user/b");
    expect(repos).toHaveLength(2);
  });

  it("addRecentRepo caps the list at 100 entries", async () => {
    const existing = Array.from({ length: 100 }, (_, i) => `/repo/${i}`);
    simulateFile({ recentRepos: existing });
    const { addRecentRepo, getRecentRepos } = await freshStore();
    addRecentRepo("/repo/new");
    expect(getRecentRepos()).toHaveLength(100);
  });
});

describe("main/store — removeRecentRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the given repo from the list", async () => {
    simulateFile({ recentRepos: ["/a", "/b", "/c"] });
    const { removeRecentRepo, getRecentRepos } = await freshStore();
    removeRecentRepo("/b");
    expect(getRecentRepos()).toEqual(["/a", "/c"]);
  });

  it("is a no-op when repo is not in the list", async () => {
    simulateFile({ recentRepos: ["/a", "/c"] });
    const { removeRecentRepo, getRecentRepos } = await freshStore();
    removeRecentRepo("/nonexistent");
    expect(getRecentRepos()).toEqual(["/a", "/c"]);
  });
});

describe("main/store — clearRecentRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empties the recent repos list", async () => {
    simulateFile({ recentRepos: ["/a", "/b"] });
    const { clearRecentRepos, getRecentRepos } = await freshStore();
    clearRecentRepos();
    expect(getRecentRepos()).toEqual([]);
  });

  it("also clears repoCategories", async () => {
    simulateFile({ recentRepos: ["/a"], repoCategories: { "/a": "work" } });
    const { clearRecentRepos, getRepoCategories } = await freshStore();
    clearRecentRepos();
    expect(getRepoCategories()).toEqual({});
  });
});

describe("main/store — lastOpenedRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not set", async () => {
    simulateNoFile();
    const { getLastOpenedRepo } = await freshStore();
    expect(getLastOpenedRepo()).toBeNull();
  });

  it("setLastOpenedRepo persists the path", async () => {
    simulateNoFile();
    const { setLastOpenedRepo, getLastOpenedRepo } = await freshStore();
    setLastOpenedRepo("/home/user/repo");
    expect(getLastOpenedRepo()).toBe("/home/user/repo");
  });

  it("setLastOpenedRepo accepts null to clear", async () => {
    simulateFile({ lastOpenedRepo: "/home/user/repo" });
    const { setLastOpenedRepo, getLastOpenedRepo } = await freshStore();
    setLastOpenedRepo(null);
    expect(getLastOpenedRepo()).toBeNull();
  });
});

describe("main/store — settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default settings when config file is missing", async () => {
    simulateNoFile();
    const { getSettings, defaultSettings } = await freshStore();
    expect(getSettings()).toMatchObject(defaultSettings);
  });

  it("merges stored settings with defaults", async () => {
    simulateFile({ settings: { theme: "light" } });
    const { getSettings } = await freshStore();
    const s = getSettings();
    expect(s.theme).toBe("light");
    // Other defaults still present
    expect(typeof s.autoFetchInterval).toBe("number");
  });

  it("updateSettings merges partial update into existing settings", async () => {
    simulateNoFile();
    const { updateSettings, getSettings } = await freshStore();
    updateSettings({ theme: "light", autoFetchEnabled: false });
    const s = getSettings();
    expect(s.theme).toBe("light");
    expect(s.autoFetchEnabled).toBe(false);
  });

  it("updateSettings returns the updated settings object", async () => {
    simulateNoFile();
    const { updateSettings } = await freshStore();
    const result = updateSettings({ theme: "light" });
    expect(result.theme).toBe("light");
  });

  it("updateSettings preserves unmodified fields", async () => {
    simulateNoFile();
    const { updateSettings, getSettings, defaultSettings } = await freshStore();
    updateSettings({ theme: "light" });
    expect(getSettings().autoFetchInterval).toBe(defaultSettings.autoFetchInterval);
  });
});

describe("main/store — repoCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setRepoCategory stores a category for a repo path", async () => {
    simulateNoFile();
    const { setRepoCategory, getRepoCategories } = await freshStore();
    setRepoCategory("/home/user/work-repo", "work");
    expect(getRepoCategories()["/home/user/work-repo"]).toBe("work");
  });

  it("setRepoCategory with null removes the category", async () => {
    simulateFile({ repoCategories: { "/home/user/work-repo": "work" } });
    const { setRepoCategory, getRepoCategories } = await freshStore();
    setRepoCategory("/home/user/work-repo", null);
    expect(getRepoCategories()["/home/user/work-repo"]).toBeUndefined();
  });

  it("renameCategory updates all repos in that category", async () => {
    simulateFile({
      repoCategories: {
        "/repo/a": "oldName",
        "/repo/b": "oldName",
        "/repo/c": "other",
      },
    });
    const { renameCategory, getRepoCategories } = await freshStore();
    renameCategory("oldName", "newName");
    const cats = getRepoCategories();
    expect(cats["/repo/a"]).toBe("newName");
    expect(cats["/repo/b"]).toBe("newName");
    expect(cats["/repo/c"]).toBe("other");
  });

  it("deleteCategory removes all repos in that category", async () => {
    simulateFile({
      repoCategories: {
        "/repo/a": "work",
        "/repo/b": "work",
        "/repo/c": "personal",
      },
    });
    const { deleteCategory, getRepoCategories } = await freshStore();
    deleteCategory("work");
    const cats = getRepoCategories();
    expect(cats["/repo/a"]).toBeUndefined();
    expect(cats["/repo/b"]).toBeUndefined();
    expect(cats["/repo/c"]).toBe("personal");
  });
});

describe("main/store — recentCommitMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when config is missing", async () => {
    simulateNoFile();
    const { getRecentCommitMessages } = await freshStore();
    expect(getRecentCommitMessages()).toEqual([]);
  });

  it("addRecentCommitMessage prepends the message", async () => {
    simulateNoFile();
    const { addRecentCommitMessage, getRecentCommitMessages } = await freshStore();
    addRecentCommitMessage("feat: initial");
    addRecentCommitMessage("fix: bug");
    expect(getRecentCommitMessages()[0]).toBe("fix: bug");
  });

  it("addRecentCommitMessage deduplicates messages", async () => {
    simulateFile({ recentCommitMessages: ["feat: a", "fix: b"] });
    const { addRecentCommitMessage, getRecentCommitMessages } = await freshStore();
    addRecentCommitMessage("feat: a");
    expect(getRecentCommitMessages()[0]).toBe("feat: a");
    expect(getRecentCommitMessages()).toHaveLength(2);
  });

  it("addRecentCommitMessage caps at 10 messages", async () => {
    simulateFile({
      recentCommitMessages: Array.from({ length: 10 }, (_, i) => `msg ${i}`),
    });
    const { addRecentCommitMessage, getRecentCommitMessages } = await freshStore();
    addRecentCommitMessage("msg new");
    expect(getRecentCommitMessages()).toHaveLength(10);
    expect(getRecentCommitMessages()[0]).toBe("msg new");
  });
});

describe("main/store — repoViewSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when no settings are stored for the repo", async () => {
    simulateNoFile();
    const { getRepoViewSettings, defaultRepoViewSettings } = await freshStore();
    expect(getRepoViewSettings("/some/repo")).toEqual(defaultRepoViewSettings);
  });

  it("setRepoViewSettings stores partial settings, merged with defaults", async () => {
    simulateNoFile();
    const { setRepoViewSettings, getRepoViewSettings } = await freshStore();
    setRepoViewSettings("/my/repo", { branchFilter: "main" });
    const s = getRepoViewSettings("/my/repo");
    expect(s.branchFilter).toBe("main");
    expect(s.branchVisibility).toBeNull();
  });

  it("setRepoViewSettings merges with existing settings", async () => {
    simulateFile({
      repoViewSettings: {
        "/my/repo": {
          branchFilter: "main",
          branchVisibility: null,
          dockviewLayout: null,
        },
      },
    });
    const { setRepoViewSettings, getRepoViewSettings } = await freshStore();
    setRepoViewSettings("/my/repo", { branchFilter: "develop" });
    expect(getRepoViewSettings("/my/repo").branchFilter).toBe("develop");
    expect(getRepoViewSettings("/my/repo").branchVisibility).toBeNull();
  });
});

describe("main/store — gitAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no accounts stored", async () => {
    simulateNoFile();
    const { getGitAccounts } = await freshStore();
    expect(getGitAccounts()).toEqual([]);
  });

  it("addGitAccount appends account to the list", async () => {
    simulateNoFile();
    const { addGitAccount, getGitAccounts } = await freshStore();
    const acc = { id: "acc-1", label: "Work", name: "Alice", email: "alice@example.com" };
    addGitAccount(acc);
    expect(getGitAccounts()).toEqual([acc]);
  });

  it("updateGitAccount modifies the matching account", async () => {
    const acc = { id: "acc-1", label: "Work", name: "Alice", email: "alice@example.com" };
    simulateFile({ gitAccounts: [acc] });
    const { updateGitAccount, getGitAccounts } = await freshStore();
    updateGitAccount("acc-1", { name: "Alice Updated" });
    expect(getGitAccounts()[0]!.name).toBe("Alice Updated");
    expect(getGitAccounts()[0]!.email).toBe("alice@example.com");
  });

  it("updateGitAccount is a no-op when id does not match", async () => {
    const acc = { id: "acc-1", label: "Work", name: "Alice", email: "alice@example.com" };
    simulateFile({ gitAccounts: [acc] });
    const { updateGitAccount, getGitAccounts } = await freshStore();
    updateGitAccount("nonexistent", { name: "Bob" });
    expect(getGitAccounts()[0]!.name).toBe("Alice");
  });

  it("deleteGitAccount removes the account", async () => {
    const acc1 = {
      id: "acc-1",
      label: "Work",
      name: "Alice",
      email: "alice@example.com",
    };
    const acc2 = {
      id: "acc-2",
      label: "Personal",
      name: "Bob",
      email: "bob@example.com",
    };
    simulateFile({ gitAccounts: [acc1, acc2] });
    const { deleteGitAccount, getGitAccounts } = await freshStore();
    deleteGitAccount("acc-1");
    expect(getGitAccounts()).toHaveLength(1);
    expect(getGitAccounts()[0]!.id).toBe("acc-2");
  });

  it("deleteGitAccount clears defaultAccountId when it matches", async () => {
    const acc = { id: "acc-1", label: "Work", name: "Alice", email: "alice@example.com" };
    simulateFile({ gitAccounts: [acc], defaultAccountId: "acc-1" });
    const { deleteGitAccount, getDefaultAccountId } = await freshStore();
    deleteGitAccount("acc-1");
    expect(getDefaultAccountId()).toBeNull();
  });

  it("deleteGitAccount cleans up repoAccountMap references", async () => {
    const acc = { id: "acc-1", label: "Work", name: "Alice", email: "alice@example.com" };
    simulateFile({
      gitAccounts: [acc],
      repoAccountMap: { "/repo/a": "acc-1", "/repo/b": "acc-2" },
    });
    const { deleteGitAccount, getRepoAccount } = await freshStore();
    deleteGitAccount("acc-1");
    expect(getRepoAccount("/repo/a")).toBeNull();
    expect(getRepoAccount("/repo/b")).toBe("acc-2");
  });
});

describe("main/store — repoAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRepoAccount returns null when no mapping exists", async () => {
    simulateNoFile();
    const { getRepoAccount } = await freshStore();
    expect(getRepoAccount("/some/repo")).toBeNull();
  });

  it("setRepoAccount maps a repo to an account id", async () => {
    simulateNoFile();
    const { setRepoAccount, getRepoAccount } = await freshStore();
    setRepoAccount("/my/repo", "acc-1");
    expect(getRepoAccount("/my/repo")).toBe("acc-1");
  });

  it("setRepoAccount with null clears the mapping", async () => {
    simulateFile({ repoAccountMap: { "/my/repo": "acc-1" } });
    const { setRepoAccount, getRepoAccount } = await freshStore();
    setRepoAccount("/my/repo", null);
    expect(getRepoAccount("/my/repo")).toBeNull();
  });
});

describe("main/store — defaultAccountId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not set", async () => {
    simulateNoFile();
    const { getDefaultAccountId } = await freshStore();
    expect(getDefaultAccountId()).toBeNull();
  });

  it("setDefaultAccountId persists the value", async () => {
    simulateNoFile();
    const { setDefaultAccountId, getDefaultAccountId } = await freshStore();
    setDefaultAccountId("acc-1");
    expect(getDefaultAccountId()).toBe("acc-1");
  });

  it("setDefaultAccountId accepts null to clear", async () => {
    simulateFile({ defaultAccountId: "acc-1" });
    const { setDefaultAccountId, getDefaultAccountId } = await freshStore();
    setDefaultAccountId(null);
    expect(getDefaultAccountId()).toBeNull();
  });
});

describe("main/store — addMultipleRecentRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds repos not already in the list", async () => {
    simulateFile({ recentRepos: ["/existing"] });
    const { addMultipleRecentRepos, getRecentRepos } = await freshStore();
    addMultipleRecentRepos(["/new-a", "/new-b"]);
    expect(getRecentRepos()).toContain("/new-a");
    expect(getRecentRepos()).toContain("/new-b");
    expect(getRecentRepos()).toContain("/existing");
  });

  it("does not add duplicate repos", async () => {
    simulateFile({ recentRepos: ["/existing"] });
    const { addMultipleRecentRepos, getRecentRepos } = await freshStore();
    addMultipleRecentRepos(["/existing", "/also-existing"]);
    const repos = getRecentRepos();
    const count = repos.filter((r) => r === "/existing").length;
    expect(count).toBe(1);
  });
});

describe("main/store — removeMissingRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes repos whose paths do not exist on disk", async () => {
    simulateFile({ recentRepos: ["/exists", "/missing"] });
    const { removeMissingRepos, getRecentRepos } = await freshStore();
    mockExistsSync.mockImplementation((p: string) => p === "/exists");
    const removed = removeMissingRepos();
    expect(removed).toEqual(["/missing"]);
    expect(getRecentRepos()).toEqual(["/exists"]);
  });

  it("returns empty array when all repos exist", async () => {
    simulateFile({ recentRepos: ["/a", "/b"] });
    const { removeMissingRepos } = await freshStore();
    mockExistsSync.mockReturnValue(true);
    expect(removeMissingRepos()).toEqual([]);
  });
});

describe("main/store — scanForRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds git repos in a directory tree", async () => {
    simulateNoFile();
    const { scanForRepos } = await freshStore();

    // Simulate: /root has a subdir "project" that contains ".git"
    const root = path.resolve("/root");
    const project = path.join(root, "project");
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === root) {
        return [{ name: "project", isDirectory: () => true, isFile: () => false }];
      }
      if (dir === project) {
        return [{ name: ".git", isDirectory: () => true, isFile: () => false }];
      }
      return [];
    });

    const onProgress = vi.fn();
    const found = await scanForRepos(root, 2, onProgress);
    expect(found).toContain(project);
    expect(onProgress).toHaveBeenCalled();
  });

  it("does not recurse into node_modules", async () => {
    simulateNoFile();
    const { scanForRepos } = await freshStore();

    const root = path.resolve("/root");
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === root) {
        return [{ name: "node_modules", isDirectory: () => true, isFile: () => false }];
      }
      return [];
    });

    const found = await scanForRepos(root, 2, vi.fn());
    expect(found).toHaveLength(0);
  });

  it("skips repos already in recentRepos", async () => {
    const root = path.resolve("/root");
    const project = path.join(root, "project");
    simulateFile({ recentRepos: [project] });
    const { scanForRepos } = await freshStore();

    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === root) {
        return [{ name: "project", isDirectory: () => true, isFile: () => false }];
      }
      if (dir === project) {
        return [{ name: ".git", isDirectory: () => true, isFile: () => false }];
      }
      return [];
    });

    const found = await scanForRepos(root, 2, vi.fn());
    expect(found).toHaveLength(0);
  });

  it("does not recurse beyond maxDepth", async () => {
    simulateNoFile();
    const { scanForRepos } = await freshStore();

    // At depth 0 → subdir, at depth 1 → another subdir (no .git)
    let callCount = 0;
    mockReaddirSync.mockImplementation(() => {
      callCount++;
      return [{ name: "subdir", isDirectory: () => true, isFile: () => false }];
    });

    await scanForRepos("/root", 0, vi.fn());
    // With maxDepth=0 only /root itself is walked; the subdir at depth 1 should not be entered
    expect(callCount).toBe(1);
  });
});

describe("main/store — windowBounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default window bounds when config is missing", async () => {
    simulateNoFile();
    const { getWindowBounds } = await freshStore();
    const bounds = getWindowBounds();
    expect(bounds.width).toBe(1280);
    expect(bounds.height).toBe(800);
  });

  it("setWindowBounds persists and returns updated bounds", async () => {
    simulateNoFile();
    const { setWindowBounds, getWindowBounds } = await freshStore();
    setWindowBounds({ width: 1920, height: 1080, x: 0, y: 0 });
    expect(getWindowBounds()).toEqual({ width: 1920, height: 1080, x: 0, y: 0 });
  });
});

describe("main/store — defaultSettings / defaultCommitTemplates", () => {
  it("defaultSettings has expected required fields", async () => {
    simulateNoFile();
    const { defaultSettings } = await freshStore();
    expect(defaultSettings.theme).toBe("dark");
    expect(defaultSettings.language).toBe("en");
    expect(defaultSettings.autoFetchEnabled).toBe(true);
    expect(Array.isArray(defaultSettings.commitTemplates)).toBe(true);
    expect(defaultSettings.commitTemplates.length).toBeGreaterThan(0);
  });

  it("defaultCommitTemplates contains at least feat, fix, docs", async () => {
    simulateNoFile();
    const { defaultCommitTemplates } = await freshStore();
    const prefixes = defaultCommitTemplates.map((t) => t.prefix);
    expect(prefixes).toContain("feat: ");
    expect(prefixes).toContain("fix: ");
    expect(prefixes).toContain("docs: ");
  });
});

describe("main/store — getAutoFetchInterval / setAutoFetchInterval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default interval (300 seconds) when not configured", async () => {
    simulateNoFile();
    const { getAutoFetchInterval } = await freshStore();
    expect(getAutoFetchInterval()).toBe(300);
  });

  it("setAutoFetchInterval updates the setting", async () => {
    simulateNoFile();
    const { setAutoFetchInterval, getAutoFetchInterval } = await freshStore();
    setAutoFetchInterval(600);
    expect(getAutoFetchInterval()).toBe(600);
  });
});
