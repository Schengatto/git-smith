import { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "path";
import { execSync } from "child_process";

export const TEST_REPO = "/tmp/gitsmith-test-repo";

export function generateTestRepo() {
  execSync(
    path.join(__dirname, "../scripts/generate-test-repo.sh") + ` ${TEST_REPO}`,
    { stdio: "pipe" }
  );
}

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const a = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, NODE_ENV: "test" },
  });
  const p = await a.firstWindow();
  await p.waitForLoadState("domcontentloaded");
  await p.waitForTimeout(1000);
  return { app: a, page: p };
}

export async function openTestRepo(page: Page, repoPath: string) {
  await page.evaluate(async (rp) => {
    await window.electronAPI.repo.open(rp);
  }, repoPath);

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  const repoEntry = page.locator("text=gitsmith-test-repo").first();
  await repoEntry.click();

  await page.waitForTimeout(3000);
}
