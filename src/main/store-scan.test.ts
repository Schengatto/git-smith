import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock electron app before importing store
vi.mock("electron", () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}));

import {
  scanForRepos,
  cancelScan,
  addMultipleRecentRepos,
  getRecentRepos,
  clearRecentRepos,
  getRecentCommitMessages,
  addRecentCommitMessage,
  getRepoViewSettings,
  setRepoViewSettings,
  defaultRepoViewSettings,
} from "./store";

describe("scanForRepos", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test-"));
    // Clear recent repos to avoid interference
    clearRecentRepos();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds git repositories at root level", async () => {
    // Create a fake git repo
    const repoDir = path.join(tmpDir, "my-repo");
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });

    const progressCalls: unknown[] = [];
    const found = await scanForRepos(tmpDir, 3, (p) => progressCalls.push(p));

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(repoDir);
    expect(progressCalls.length).toBeGreaterThan(0);
    // Last progress should be "done"
    expect(progressCalls[progressCalls.length - 1]).toMatchObject({ phase: "done" });
  });

  it("finds nested git repositories", async () => {
    const nested = path.join(tmpDir, "projects", "sub", "repo");
    fs.mkdirSync(path.join(nested, ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 5, () => {});

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(nested);
  });

  it("does not recurse into git repos", async () => {
    // Create a repo with a nested repo inside
    const outerRepo = path.join(tmpDir, "outer");
    fs.mkdirSync(path.join(outerRepo, ".git"), { recursive: true });
    const innerRepo = path.join(outerRepo, "submodule");
    fs.mkdirSync(path.join(innerRepo, ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 5, () => {});

    // Should only find the outer repo, not recurse into it
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(outerRepo);
  });

  it("skips node_modules directories", async () => {
    const nmRepo = path.join(tmpDir, "node_modules", "some-pkg");
    fs.mkdirSync(path.join(nmRepo, ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 5, () => {});

    expect(found).toHaveLength(0);
  });

  it("respects max depth", async () => {
    // Create repo at depth 3
    const deepRepo = path.join(tmpDir, "a", "b", "c", "repo");
    fs.mkdirSync(path.join(deepRepo, ".git"), { recursive: true });

    // With depth 2, should not find it (depth 0=tmpDir, 1=a, 2=b - won't reach c)
    const found = await scanForRepos(tmpDir, 2, () => {});
    expect(found).toHaveLength(0);

    // With depth 4, should find it
    const found2 = await scanForRepos(tmpDir, 4, () => {});
    expect(found2).toHaveLength(1);
  });

  it("finds multiple repositories", async () => {
    fs.mkdirSync(path.join(tmpDir, "repo1", ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "repo2", ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "subdir", "repo3", ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 3, () => {});

    expect(found).toHaveLength(3);
  });

  it("does not duplicate already-existing repos", async () => {
    const repoDir = path.join(tmpDir, "existing-repo");
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });

    // Add it as an existing recent repo first
    addMultipleRecentRepos([repoDir]);

    const found = await scanForRepos(tmpDir, 3, () => {});
    expect(found).toHaveLength(0);
  });

  it("returns empty for directory with no git repos", async () => {
    fs.mkdirSync(path.join(tmpDir, "just-a-dir", "subdir"), { recursive: true });

    const found = await scanForRepos(tmpDir, 3, () => {});
    expect(found).toHaveLength(0);
  });

  it("skips macOS/Linux heavy directories like Library", async () => {
    const libRepo = path.join(tmpDir, "Library", "deep", "repo");
    fs.mkdirSync(path.join(libRepo, ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 5, () => {});
    expect(found).toHaveLength(0);
  });

  it("skips Applications directory", async () => {
    const appRepo = path.join(tmpDir, "Applications", "MyApp", "repo");
    fs.mkdirSync(path.join(appRepo, ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 5, () => {});
    expect(found).toHaveLength(0);
  });

  it("detects symlink loops without hanging", async () => {
    const dirA = path.join(tmpDir, "dirA");
    fs.mkdirSync(dirA);
    // Create a symlink that points back to the parent (loop)
    try {
      fs.symlinkSync(tmpDir, path.join(dirA, "loop"), "dir");
    } catch {
      // Symlinks may not be supported (e.g. Windows without elevation)
      return;
    }
    // Create a repo elsewhere so we know the scan completes
    fs.mkdirSync(path.join(tmpDir, "real-repo", ".git"), { recursive: true });

    const found = await scanForRepos(tmpDir, 10, () => {});
    expect(found).toHaveLength(1);
  });

  it("can be cancelled mid-scan", async () => {
    // Create many nested dirs to ensure scan takes some time
    for (let i = 0; i < 20; i++) {
      fs.mkdirSync(path.join(tmpDir, `dir${i}`, "sub", "deep"), { recursive: true });
    }
    fs.mkdirSync(path.join(tmpDir, "dir19", "sub", "deep", "repo", ".git"), { recursive: true });

    const progressCalls: unknown[] = [];
    const scanPromise = scanForRepos(tmpDir, 5, (p) => progressCalls.push(p));

    // Cancel almost immediately
    cancelScan();

    const found = await scanPromise;
    // The scan should have stopped — last progress should be "done"
    const lastProgress = progressCalls[progressCalls.length - 1] as { phase: string };
    expect(lastProgress.phase).toBe("done");
    // It may or may not have found the repo depending on timing, but it should finish
    expect(found.length).toBeLessThanOrEqual(1);
  });
});

describe("addMultipleRecentRepos", () => {
  beforeEach(() => {
    clearRecentRepos();
  });

  it("adds multiple repos at once", () => {
    addMultipleRecentRepos(["/path/a", "/path/b", "/path/c"]);
    const repos = getRecentRepos();
    expect(repos).toContain("/path/a");
    expect(repos).toContain("/path/b");
    expect(repos).toContain("/path/c");
  });

  it("does not add duplicates", () => {
    addMultipleRecentRepos(["/path/a", "/path/b"]);
    addMultipleRecentRepos(["/path/b", "/path/c"]);
    const repos = getRecentRepos();
    const countB = repos.filter((r) => r === "/path/b").length;
    expect(countB).toBe(1);
  });
});

describe("recentCommitMessages", () => {
  it("stores and retrieves recent commit messages", () => {
    addRecentCommitMessage("feat: first commit");
    addRecentCommitMessage("fix: second commit");
    const messages = getRecentCommitMessages();
    expect(messages[0]).toBe("fix: second commit");
    expect(messages[1]).toBe("feat: first commit");
  });

  it("deduplicates messages and moves to front", () => {
    addRecentCommitMessage("feat: first");
    addRecentCommitMessage("fix: second");
    addRecentCommitMessage("feat: first");
    const messages = getRecentCommitMessages();
    expect(messages[0]).toBe("feat: first");
    expect(messages.filter((m) => m === "feat: first")).toHaveLength(1);
  });

  it("limits to 10 messages", () => {
    for (let i = 0; i < 15; i++) {
      addRecentCommitMessage(`commit ${i}`);
    }
    const messages = getRecentCommitMessages();
    expect(messages).toHaveLength(10);
    expect(messages[0]).toBe("commit 14");
  });
});

describe("repoViewSettings", () => {
  it("returns defaults for unknown repo", () => {
    const settings = getRepoViewSettings("/unknown/repo");
    expect(settings).toEqual(defaultRepoViewSettings);
  });

  it("saves and retrieves branchFilter", () => {
    setRepoViewSettings("/test/repo", { branchFilter: "main" });
    const settings = getRepoViewSettings("/test/repo");
    expect(settings.branchFilter).toBe("main");
    expect(settings.branchVisibility).toBeNull();
    expect(settings.dockviewLayout).toBeNull();
  });

  it("saves and retrieves branchVisibility", () => {
    const visibility = { mode: "include" as const, branches: ["main", "develop"] };
    setRepoViewSettings("/test/repo2", { branchVisibility: visibility });
    const settings = getRepoViewSettings("/test/repo2");
    expect(settings.branchVisibility).toEqual(visibility);
  });

  it("merges partial updates without overwriting existing fields", () => {
    setRepoViewSettings("/test/repo3", { branchFilter: "feature" });
    setRepoViewSettings("/test/repo3", {
      branchVisibility: { mode: "exclude", branches: ["wip"] },
    });
    const settings = getRepoViewSettings("/test/repo3");
    expect(settings.branchFilter).toBe("feature");
    expect(settings.branchVisibility).toEqual({ mode: "exclude", branches: ["wip"] });
  });

  it("saves and retrieves dockview layout", () => {
    const layout = { grid: { root: {}, width: 1000, height: 800 }, panels: {} };
    setRepoViewSettings("/test/repo4", { dockviewLayout: layout });
    const settings = getRepoViewSettings("/test/repo4");
    expect(settings.dockviewLayout).toEqual(layout);
  });

  it("keeps settings isolated per repo", () => {
    setRepoViewSettings("/repo/a", { branchFilter: "alpha" });
    setRepoViewSettings("/repo/b", { branchFilter: "beta" });
    expect(getRepoViewSettings("/repo/a").branchFilter).toBe("alpha");
    expect(getRepoViewSettings("/repo/b").branchFilter).toBe("beta");
  });
});
