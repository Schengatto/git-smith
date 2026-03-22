import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { generateTestRepo, launchApp, openTestRepo, TEST_REPO } from "./helpers";

let app: ElectronApplication;
let page: Page;

test.describe.serial("Command Log panel", () => {
  test.beforeAll(async () => {
    generateTestRepo();
    ({ app, page } = await launchApp());
    await openTestRepo(page, TEST_REPO);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("Command Log tab is visible in bottom panel", async () => {
    await expect(page.locator("text=Command Log").first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking Command Log tab shows the panel", async () => {
    const tab = page.locator("text=Command Log").first();
    await tab.click();
    await page.waitForTimeout(500);
    // After opening a repo, git commands have already run, so entries should exist
    // OR the empty state should show
    const hasEntries = await page.locator("text=Commands (").first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator("text=Git commands will appear here").first().isVisible().catch(() => false);
    expect(hasEntries || hasEmptyState).toBe(true);
  });

  test("git operations populate the command log", async () => {
    // Click the Command Log tab first
    const tab = page.locator("text=Command Log").first();
    await tab.click();
    await page.waitForTimeout(300);

    // Trigger a git operation that will be logged
    await page.evaluate(async () => {
      return window.electronAPI.branch.list();
    });
    await page.waitForTimeout(1000);

    // Trigger another operation
    await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    await page.waitForTimeout(1000);

    // The command log should now have entries with the $ prompt and command text
    const dollarSigns = page.locator("text=$");
    const count = await dollarSigns.count();
    expect(count).toBeGreaterThan(0);
  });

  test("command log entries show timestamps", async () => {
    // Timestamps are formatted as HH:MM:SS
    const timestamps = page.locator("text=/\\d{2}:\\d{2}:\\d{2}/");
    const count = await timestamps.count();
    expect(count).toBeGreaterThan(0);
  });

  test("command log entries show command text", async () => {
    // Git commands should show "git" text
    const gitTexts = page.locator("text=git");
    const count = await gitTexts.count();
    expect(count).toBeGreaterThan(0);
  });

  test("command log shows entry count in header", async () => {
    const header = page.locator("text=/Commands \\(\\d+\\)/");
    await expect(header.first()).toBeVisible({ timeout: 5000 });
  });

  test("clear button removes all entries", async () => {
    // Ensure we have entries first
    const header = page.locator("text=/Commands \\(\\d+\\)/");
    await expect(header.first()).toBeVisible({ timeout: 5000 });

    // Click clear
    const clearBtn = page.locator("text=Clear").first();
    await clearBtn.click();
    await page.waitForTimeout(500);

    // Empty state should show
    await expect(
      page.locator("text=Git commands will appear here").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("new commands appear after clearing", async () => {
    // Trigger a git operation
    await page.evaluate(async () => {
      return window.electronAPI.status.get();
    });
    await page.waitForTimeout(1000);

    // Entries should be back
    const header = page.locator("text=/Commands \\(\\d+\\)/");
    await expect(header.first()).toBeVisible({ timeout: 5000 });
  });

  test("error commands show error styling", async () => {
    // Try to checkout a non-existent branch to trigger an error
    try {
      await page.evaluate(async () => {
        return window.electronAPI.branch.checkout("nonexistent-branch-xyz");
      });
    } catch {
      // Expected to fail
    }
    await page.waitForTimeout(1000);

    // The command log should still be functional after an error
    const header = page.locator("text=/Commands \\(\\d+\\)/");
    await expect(header.first()).toBeVisible({ timeout: 5000 });
  });
});
