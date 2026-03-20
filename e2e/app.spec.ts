import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "path";
import { execSync } from "child_process";

let app: ElectronApplication;
let page: Page;
const TEST_REPO = "/tmp/git-expansion-test-repo";

/**
 * Open a test repository by:
 * 1. Calling electronAPI.repo.open() to register it in recent repos
 * 2. Reloading the page so it appears in the welcome screen
 * 3. Clicking on the repo entry in the welcome screen to trigger the Zustand store
 */
async function openTestRepo(page: Page, repoPath: string) {
  // Register the repo on the backend (adds to recent, sets lastOpened)
  await page.evaluate(async (rp) => {
    await window.electronAPI.repo.open(rp);
  }, repoPath);

  // Reload to get updated recent repos list
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  // Click the test repo in the welcome screen to open it via the Zustand store
  const repoEntry = page.locator(`text=git-expansion-test-repo`).first();
  await repoEntry.click();

  // Wait for repo to fully load (toolbar, sidebar, graph)
  await page.waitForTimeout(3000);
}

function generateTestRepo() {
  execSync(
    path.join(__dirname, "../scripts/generate-test-repo.sh") + ` ${TEST_REPO}`,
    { stdio: "pipe" }
  );
}

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const a = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, NODE_ENV: "test" },
  });
  const p = await a.firstWindow();
  await p.waitForLoadState("domcontentloaded");
  await p.waitForTimeout(1000);
  return { app: a, page: p };
}

test.describe.serial("Welcome screen", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("window opens with correct title", async () => {
    const title = await page.title();
    expect(title).toBe("Git Expansion");
  });

  test("welcome screen shows app heading", async () => {
    const heading = page.locator("text=Git Expansion");
    await expect(heading.first()).toBeVisible();
  });

  test("welcome screen shows action buttons", async () => {
    await expect(page.locator("button", { hasText: "Open repository" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Clone repository" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Create new repository" })).toBeVisible();
  });

  test("search repositories input exists", async () => {
    const searchInput = page.locator('input[placeholder="Search repositories..."]');
    await expect(searchInput).toBeVisible();
  });

  test("status bar shows 'No repository open'", async () => {
    await expect(page.locator("text=No repository open")).toBeVisible();
  });

  test("menu bar shows all menus", async () => {
    await expect(page.locator("button", { hasText: "Start" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Dashboard" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Tools" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Help" })).toBeVisible();
  });

  test("Start menu opens with items", async () => {
    await page.locator("button", { hasText: "Start" }).click();
    await page.waitForTimeout(300);

    await expect(page.locator("text=Create new repository...").first()).toBeVisible();
    await expect(page.locator("text=Open repository...").first()).toBeVisible();
    await expect(page.locator("text=Clone repository...").first()).toBeVisible();

    await page.keyboard.press("Escape");
  });
});

test.describe.serial("Repository operations", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("status bar shows current branch", async () => {
    await expect(page.locator("text=main").first()).toBeVisible({ timeout: 10000 });
  });

  test("status bar shows change count", async () => {
    const changesIndicator = page.locator("text=change");
    await expect(changesIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test("toolbar is visible with all buttons", async () => {
    await expect(page.locator("button", { hasText: "Refresh" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Fetch" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Pull" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Commit" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Push" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Stash" }).first()).toBeVisible();
  });

  test("theme toggle works", async () => {
    const themeBtn = page.locator('button[title*="Switch to"]');
    await expect(themeBtn).toBeVisible();

    await themeBtn.click();
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(["light", "dark"]).toContain(theme);

    await themeBtn.click();
  });

  test("sidebar shows branches section", async () => {
    await expect(page.locator("text=Branches").first()).toBeVisible();
  });

  test("sidebar shows main branch as current", async () => {
    const mainBranch = page.locator('.list-item-active:has-text("main")');
    await expect(mainBranch).toBeVisible();
  });

  test("sidebar shows feature/dashboard branch", async () => {
    await expect(page.locator("text=feature/dashboard").first()).toBeVisible();
  });

  test("sidebar shows tags section with tags", async () => {
    await expect(page.locator("text=Tags").first()).toBeVisible();
    await expect(page.locator("text=v1.0.0").first()).toBeVisible();
    await expect(page.locator("text=v0.1.0").first()).toBeVisible();
  });

  test("sidebar filter works", async () => {
    const filterInput = page.locator('input[placeholder="Filter..."]');
    await expect(filterInput).toBeVisible();

    await filterInput.fill("dashboard");
    await page.waitForTimeout(300);
    await expect(page.locator("text=feature/dashboard").first()).toBeVisible();

    await filterInput.fill("");
    await page.waitForTimeout(300);
  });

  test("commit graph panel has commit data", async () => {
    // Commit graph uses react-virtuoso (virtual scrolling), so text may not be in the viewport.
    // Instead, verify via the API that commits are loaded.
    const log = await page.evaluate(async () => {
      return window.electronAPI.log.getCommits(5);
    });
    expect(log.length).toBeGreaterThan(0);
  });

  test("repo selector shows repo name", async () => {
    await expect(
      page.locator("button", { hasText: "git-expansion-test-repo" })
    ).toBeVisible();
  });
});

test.describe.serial("Staging and committing", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("open commit dialog via toolbar", async () => {
    const commitBtn = page.locator("button", { hasText: "Commit" }).first();
    await commitBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Commit to main").first()).toBeVisible({ timeout: 10000 });
  });

  test("commit dialog shows changed files", async () => {
    await expect(page.locator("text=Changes").first()).toBeVisible();
    await expect(page.locator("text=index.js").first()).toBeVisible();
    await expect(page.locator("text=new-file.txt").first()).toBeVisible();
  });

  test("diff viewer shows content for selected file", async () => {
    await page.locator("text=index.js").first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Uncommitted change").first()).toBeVisible({ timeout: 5000 });
  });

  test("stage all files", async () => {
    const stageAllBtn = page.locator('button[title="Stage all"]');
    await stageAllBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Staged").first()).toBeVisible();
  });

  test("commit with message", async () => {
    const messageInput = page.locator('textarea[placeholder="Enter commit message..."]');
    await messageInput.fill("test: e2e test commit");

    // Use Ctrl+Enter to commit (avoids pointer interception issues with overlay)
    await messageInput.press("Control+Enter");

    // Wait for commit to complete and dialog to close
    await page.waitForTimeout(3000);
  });

  test("status bar shows clean after commit", async () => {
    await expect(page.locator("text=clean").first()).toBeVisible({ timeout: 10000 });
  });

  test("new commit visible via API", async () => {
    const log = await page.evaluate(async () => {
      return window.electronAPI.log.getCommits(1);
    });
    const subject = log[0]?.subject || log[0]?.message || "";
    expect(subject).toContain("e2e test commit");
  });
});

test.describe.serial("Branch operations", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("checkout branch via context menu", async () => {
    const branch = page.locator('.list-item:has-text("feature/dashboard")');
    await branch.click({ button: "right" });
    await page.waitForTimeout(500);

    await page.locator("text=Checkout").first().click();
    await page.waitForTimeout(500);

    // Checkout dialog may appear — confirm it
    const confirmBtn = page.locator("button", { hasText: "Checkout" }).last();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(2000);

    await expect(page.locator('.list-item-active:has-text("feature/dashboard")')).toBeVisible({
      timeout: 10000,
    });
  });

  test("create branch via context menu", async () => {
    const branchesHeader = page.locator("text=Branches").first();
    await branchesHeader.click({ button: "right" });
    await page.waitForTimeout(500);

    await page.locator("text=Create New Branch...").click();
    await page.waitForTimeout(500);

    const branchInput = page.locator('input[placeholder="feature/my-branch"]');
    await branchInput.fill("test/e2e-branch");

    const createBtn = page.locator("button", { hasText: "Create" }).first();
    await createBtn.click();
    await page.waitForTimeout(2000);

    await expect(page.locator("text=test/e2e-branch").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe.serial("Stash operations", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("stashes section shows existing stash", async () => {
    const stashesHeader = page.locator("text=Stashes").first();
    await stashesHeader.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=WIP: some feature").first()).toBeVisible({ timeout: 5000 });
  });

  test("stash changes via toolbar", async () => {
    // First verify we have changes to stash
    const statusBefore = await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    const modifiedBefore = statusBefore.unstaged.length;
    expect(modifiedBefore).toBeGreaterThan(0);

    const stashDropdown = page.locator("button", { hasText: "Stash" }).first();
    await stashDropdown.click();
    await page.waitForTimeout(500);

    await page.locator("text=Stash all modified files").first().click();
    await page.waitForTimeout(2000);

    // Verify stash was created (modified files should be gone, untracked may remain)
    const statusAfter = await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    expect(statusAfter.unstaged.length).toBeLessThan(modifiedBefore);
  });

  test("stash pop via toolbar", async () => {
    const stashDropdown = page.locator("button", { hasText: "Stash" }).first();
    await stashDropdown.click();
    await page.waitForTimeout(500);

    await page.locator("text=Restore the most recent stash").first().click();
    await page.waitForTimeout(2000);

    // Verify changes are restored
    const status = await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    expect(status.unstaged.length).toBeGreaterThan(0);
  });
});

test.describe.serial("Keyboard shortcuts", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("Ctrl+K opens commit dialog", async () => {
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Commit to").first()).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("F5 refreshes without errors", async () => {
    await page.keyboard.press("F5");
    await page.waitForTimeout(1500);

    await expect(page.locator("text=Branches").first()).toBeVisible();
  });
});

test.describe.serial("Close and reopen repository", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("close repository via repo selector", async () => {
    // Open repo selector dropdown
    const repoBtn = page.locator("button", { hasText: "git-expansion-test-repo" });
    await repoBtn.click();
    await page.waitForTimeout(500);

    // Click close button (X icon in the current repo section)
    const closeBtn = page.locator('button[title="Close repository"]');
    await closeBtn.click();
    await page.waitForTimeout(1500);

    // Welcome screen should be back
    await expect(page.locator("text=No repository open").first()).toBeVisible({ timeout: 10000 });
  });

  test("reopen repository from welcome screen", async () => {
    // Click on the test repo in recent repos
    const repoEntry = page.locator("text=git-expansion-test-repo").first();
    await repoEntry.click();
    await page.waitForTimeout(3000);

    // Toolbar and sidebar should be back
    await expect(page.locator("button", { hasText: "Commit" }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Branches").first()).toBeVisible();
  });
});

test.describe.serial("Git operations via electronAPI", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("branch list returns expected branches", async () => {
    const branches = await page.evaluate(async () => {
      return window.electronAPI.branch.list();
    });

    const branchNames = branches.map((b: { name: string }) => b.name);
    expect(branchNames).toContain("main");
    expect(branchNames).toContain("feature/dashboard");
    expect(branchNames).toContain("feature/auth");
  });

  test("tag list returns expected tags", async () => {
    const tags = await page.evaluate(async () => {
      return window.electronAPI.tag.list();
    });

    const tagNames = tags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain("v1.0.0");
    expect(tagNames).toContain("v0.1.0");
  });

  test("stash list returns expected stash", async () => {
    const stashes = await page.evaluate(async () => {
      return window.electronAPI.stash.list();
    });

    expect(stashes.length).toBeGreaterThanOrEqual(1);
    expect(stashes[0].message).toContain("WIP: some feature");
  });

  test("status shows uncommitted changes", async () => {
    const status = await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });

    expect(status.unstaged.length + status.untracked.length).toBeGreaterThan(0);
  });

  test("stage and unstage a file", async () => {
    const afterStage = await page.evaluate(async () => {
      return window.electronAPI.status.stage(["index.js"]);
    });

    expect(afterStage.staged.some((f: { path: string }) => f.path === "index.js")).toBe(true);

    const afterUnstage = await page.evaluate(async () => {
      return window.electronAPI.status.unstage(["index.js"]);
    });

    expect(afterUnstage.staged.some((f: { path: string }) => f.path === "index.js")).toBe(false);
  });

  test("create and delete a tag", async () => {
    await page.evaluate(async () => {
      return window.electronAPI.tag.create("v2.0.0-test", "HEAD", "Test tag");
    });

    let tags = await page.evaluate(async () => {
      return window.electronAPI.tag.list();
    });
    expect(tags.map((t: { name: string }) => t.name)).toContain("v2.0.0-test");

    await page.evaluate(async () => {
      return window.electronAPI.tag.delete("v2.0.0-test");
    });

    tags = await page.evaluate(async () => {
      return window.electronAPI.tag.list();
    });
    expect(tags.map((t: { name: string }) => t.name)).not.toContain("v2.0.0-test");
  });

  test("commit log returns expected history", async () => {
    const log = await page.evaluate(async () => {
      return window.electronAPI.log.getCommits(20);
    });

    // Check that commits have subject field
    expect(log.length).toBeGreaterThan(0);
    const subjects = log.map((c: { subject?: string; message?: string }) => c.subject || c.message);
    expect(subjects.some((s: string) => s && s.includes("Update styles"))).toBe(true);
    expect(subjects.some((s: string) => s && s.includes("Initial commit"))).toBe(true);
  });

  test("create branch, checkout, and delete", async () => {
    await page.evaluate(async () => {
      return window.electronAPI.branch.create("e2e-api-test-branch");
    });

    let branches = await page.evaluate(async () => {
      return window.electronAPI.branch.list();
    });
    expect(branches.map((b: { name: string }) => b.name)).toContain("e2e-api-test-branch");

    await page.evaluate(async () => {
      return window.electronAPI.branch.checkout("e2e-api-test-branch");
    });

    const info = await page.evaluate(async () => {
      return window.electronAPI.repo.getInfo();
    });
    expect(info?.currentBranch).toBe("e2e-api-test-branch");

    await page.evaluate(async () => {
      return window.electronAPI.branch.checkout("main");
    });

    await page.evaluate(async () => {
      return window.electronAPI.branch.delete("e2e-api-test-branch");
    });

    branches = await page.evaluate(async () => {
      return window.electronAPI.branch.list();
    });
    expect(branches.map((b: { name: string }) => b.name)).not.toContain("e2e-api-test-branch");
  });

  test("full commit workflow via API", async () => {
    await page.evaluate(async () => {
      return window.electronAPI.status.stage(["index.js", "new-file.txt"]);
    });

    await page.evaluate(async () => {
      return window.electronAPI.commit.create("test: api commit from e2e");
    });

    const log = await page.evaluate(async () => {
      return window.electronAPI.log.getCommits(1);
    });
    const firstSubject = log[0]?.subject || log[0]?.message;
    expect(firstSubject).toContain("api commit from e2e");

    const status = await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    expect(status.staged.length).toBe(0);
    expect(status.unstaged.length).toBe(0);
    expect(status.untracked.length).toBe(0);
  });
});
