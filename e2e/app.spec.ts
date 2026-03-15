import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "path";
import { execSync } from "child_process";

let app: ElectronApplication;
let page: Page;
const TEST_REPO = "/tmp/git-expansion-test-repo";

test.beforeAll(async () => {
  // Generate test repo
  execSync(
    path.join(__dirname, "../scripts/generate-test-repo.sh") + ` ${TEST_REPO}`,
    { stdio: "pipe" }
  );

  // Launch app
  app = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, NODE_ENV: "test" },
  });

  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close();
});

test("window opens with welcome screen", async () => {
  const title = await page.title();
  expect(title).toBe("Git Expansion");

  // Welcome screen should be visible
  const heading = page.locator("text=Git Expansion");
  await expect(heading.first()).toBeVisible();
});

test("open repository button exists", async () => {
  const openBtn = page.locator("text=Open Repository");
  await expect(openBtn.first()).toBeVisible();
});

test("toolbar is visible", async () => {
  const openBtn = page.locator("button", { hasText: "Open" });
  await expect(openBtn.first()).toBeVisible();

  const cloneBtn = page.locator("button", { hasText: "Clone" });
  await expect(cloneBtn.first()).toBeVisible();
});

test("theme toggle works", async () => {
  // Find the theme toggle button (sun/moon icon)
  const themeBtn = page.locator('button[title*="Switch to"]');
  await expect(themeBtn).toBeVisible();

  // Click to toggle theme
  await themeBtn.click();

  // Check that data-theme attribute changed
  const theme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
  expect(["light", "dark"]).toContain(theme);

  // Toggle back
  await themeBtn.click();
});
