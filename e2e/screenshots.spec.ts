import { test, ElectronApplication, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { generateTestRepo, launchApp, openTestRepo, TEST_REPO } from "./helpers";

let app: ElectronApplication;
let page: Page;
const SCREENSHOTS_DIR = path.join(__dirname, "../website/images/screenshots");

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
