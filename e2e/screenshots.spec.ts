import { test, ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";

let app: ElectronApplication;
let page: Page;
const TEST_REPO = "/tmp/gitsmith-test-repo";
const SCREENSHOTS_DIR = path.join(__dirname, "../website/images/screenshots");

async function openTestRepo(page: Page, repoPath: string) {
  await page.evaluate(async (rp) => {
    await window.electronAPI.repo.open(rp);
  }, repoPath);

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  const repoEntry = page.locator(`text=gitsmith-test-repo`).first();
  await repoEntry.click();

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

test.describe.serial("Capture screenshots for website", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    generateTestRepo();
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("welcome screen", async () => {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "welcome.png"),
    });
  });

  test("main view with commit graph", async () => {
    await openTestRepo(page, TEST_REPO);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "main-view.png"),
    });
  });

  test("commit dialog", async () => {
    // Open commit dialog via keyboard shortcut
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "commit-dialog.png"),
    });
    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("sidebar branches", async () => {
    // Sidebar should already be visible with branches
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "sidebar.png"),
    });
  });
});
