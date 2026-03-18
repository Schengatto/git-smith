# Release & Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Git Expansion professionally releasable with auto-update support via Electron Forge Publisher + electron-updater.

**Architecture:** Install `@electron-forge/publisher-github` for uploading builds to GitHub Releases as drafts. Add a `postMake` hook to generate `latest.yml` metadata files. Harden the existing `auto-updater.ts` with dev-mode guard, IPC constants, and `cancelId`. Add `electron-squirrel-startup` for Windows installer lifecycle.

**Tech Stack:** Electron Forge, electron-updater, electron-squirrel-startup, standard-version

**Spec:** `docs/superpowers/specs/2026-03-18-release-auto-update-design.md`

---

### Task 1: Add IPC channel constants for auto-updater

**Files:**
- Modify: `src/shared/ipc-channels.ts:174-182` (add APP namespace before EVENTS)

- [ ] **Step 1: Add APP namespace to IPC constants**

In `src/shared/ipc-channels.ts`, add a new `APP` namespace before the `EVENTS` block:

```ts
APP: {
  CHECK_FOR_UPDATES: "app:check-for-updates",
  GET_VERSION: "app:get-version",
  UPDATE_STATUS: "app:update-status",
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc-channels.ts
git commit -m "feat(release): add APP IPC channel constants for auto-updater"
```

---

### Task 2: Harden existing auto-updater module

**Files:**
- Modify: `src/main/auto-updater.ts`

- [ ] **Step 1: Write test for initAutoUpdater dev-mode guard**

Create `src/main/auto-updater.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron modules before importing auto-updater
vi.mock("electron", () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    currentVersion: { version: "0.2.0" },
  },
}));

import { initAutoUpdater } from "./auto-updater";
import { autoUpdater } from "electron-updater";
import { app, ipcMain } from "electron";

describe("initAutoUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip setup when app is not packaged", () => {
    Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
    initAutoUpdater({} as any);
    expect(autoUpdater.on).not.toHaveBeenCalled();
    expect(ipcMain.handle).not.toHaveBeenCalled();
  });

  it("should register event handlers when app is packaged", () => {
    Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    const mockWin = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    initAutoUpdater(mockWin as any);
    expect(autoUpdater.on).toHaveBeenCalled();
    expect(ipcMain.handle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/auto-updater.test.ts`
Expected: FAIL — initAutoUpdater currently has no `isPackaged` guard

- [ ] **Step 3: Update auto-updater.ts with all improvements**

Replace the content of `src/main/auto-updater.ts`:

```ts
import { autoUpdater, UpdateInfo } from "electron-updater";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { IPC } from "../shared/ipc-channels";

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow) {
  if (!app.isPackaged) return;

  mainWindow = win;

  // Configure
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendStatus("checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendStatus("available", info.version);

    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available.`,
        detail: "Would you like to download it now?",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus("up-to-date");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendStatus("downloading", `${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    sendStatus("downloaded", info.version);

    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded.`,
        detail: "Restart the application to apply the update.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    sendStatus("error", err.message);
  });

  // IPC handlers
  ipcMain.handle(IPC.APP.CHECK_FOR_UPDATES, async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // silent — may fail without internet
    }
  });

  ipcMain.handle(IPC.APP.GET_VERSION, () => {
    return autoUpdater.currentVersion.version;
  });

  // Check on startup (after a delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10000);
}

function sendStatus(status: string, detail?: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP.UPDATE_STATUS, { status, detail });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/auto-updater.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/main/auto-updater.ts src/main/auto-updater.test.ts
git commit -m "feat(release): harden auto-updater with isPackaged guard and IPC constants"
```

---

### Task 3: Add Squirrel.Windows lifecycle handling

**Files:**
- Modify: `src/main/index.ts:1-2` (add import at very top)

- [ ] **Step 1: Install electron-squirrel-startup**

Run: `npm install electron-squirrel-startup`

- [ ] **Step 2: Add Squirrel check at top of index.ts**

Add these two lines as the very first lines of `src/main/index.ts`, before all other imports:

```ts
import started from "electron-squirrel-startup";
if (started) app.quit();
```

Note: `app` is imported on the existing line 1. The Squirrel check must come right after the imports, before any other code runs.

The final top of the file should look like:

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
if (started) app.quit();

import path from "path";
// ... rest of imports
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Will fail because `electron-squirrel-startup` has no type declarations.

- [ ] **Step 3b: Add type declaration for electron-squirrel-startup**

Create `src/main/electron-squirrel-startup.d.ts`:

```ts
declare module "electron-squirrel-startup" {
  const started: boolean;
  export default started;
}
```

- [ ] **Step 3c: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts package.json package-lock.json
git commit -m "feat(release): add Squirrel.Windows lifecycle event handling"
```

---

### Task 4: Externalize electron-updater in Vite config

**Files:**
- Modify: `vite.main.config.ts:10`

- [ ] **Step 1: Add electron-updater to externals**

In `vite.main.config.ts`, change line 10 from:

```ts
external: ["node-pty", "@modelcontextprotocol/sdk", "zod"],
```

to:

```ts
external: ["node-pty", "@modelcontextprotocol/sdk", "zod", "electron-updater", "electron-squirrel-startup"],
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add vite.main.config.ts
git commit -m "fix(build): externalize electron-updater in Vite config"
```

---

### Task 5: Configure Forge Publisher + postMake hook

**Files:**
- Modify: `forge.config.ts` (add publisher + postMake hook)
- Modify: `package.json` (add publish script)

- [ ] **Step 1: Install @electron-forge/publisher-github**

Run: `npm install --save-dev @electron-forge/publisher-github`

- [ ] **Step 2: Add publisher and postMake hook to forge.config.ts**

Replace the entire `forge.config.ts`:

```ts
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGitHub } from "@electron-forge/publisher-github";
import { createHash } from "crypto";
import { readFile, writeFile, stat } from "fs/promises";
import path from "path";

async function computeSha512(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha512").update(data).digest("base64");
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Git Expansion",
    executableName: "git-expansion",
    appBundleId: "com.git-expansion.app",
    icon: "./assets/icon",
  },
  rebuildConfig: {
    // node-pty ships with prebuilt NAPI binaries — skip native rebuild
    onlyModules: [],
  },
  makers: [
    new MakerSquirrel({
      name: "git-expansion",
      setupExe: "GitExpansion-Setup.exe",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDeb({
      options: {
        name: "git-expansion",
        productName: "Git Expansion",
        genericName: "Git GUI",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
        mimeType: ["x-scheme-handler/git-expansion"],
      },
    }),
    new MakerRpm({
      options: {
        name: "git-expansion",
        productName: "Git Expansion",
        license: "MIT",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
      },
    }),
  ],
  publishers: [
    new PublisherGitHub({
      repository: { owner: "Schengatto", name: "git-expansion" },
      prerelease: false,
      draft: true,
    }),
  ],
  hooks: {
    postMake: async (_forgeConfig, makeResults) => {
      const releaseDate = new Date().toISOString();

      for (const result of makeResults) {
        const version = result.packageJSON.version;
        // Determine which latest-*.yml to generate based on platform
        let ymlName: string | null = null;
        if (result.platform === "win32") ymlName = "latest.yml";
        else if (result.platform === "darwin") ymlName = "latest-mac.yml";
        else if (result.platform === "linux") ymlName = "latest-linux.yml";

        if (!ymlName) continue;

        // Find the primary distributable artifact (exe, zip, deb)
        const artifact = result.artifacts.find(
          (a) =>
            a.endsWith(".exe") ||
            a.endsWith(".zip") ||
            a.endsWith(".deb") ||
            a.endsWith(".rpm")
        );
        if (!artifact) continue;

        const { size } = await stat(artifact);
        const sha512 = await computeSha512(artifact);
        const fileName = path.basename(artifact);

        const yml = [
          `version: ${version}`,
          `files:`,
          `  - url: ${fileName}`,
          `    sha512: ${sha512}`,
          `    size: ${size}`,
          `path: ${fileName}`,
          `sha512: ${sha512}`,
          `releaseDate: '${releaseDate}'`,
        ].join("\n");

        const ymlPath = path.join(path.dirname(artifact), ymlName);
        await writeFile(ymlPath, yml, "utf-8");

        // Add to artifacts so publisher uploads it
        result.artifacts.push(ymlPath);
      }

      return makeResults;
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
```

- [ ] **Step 3: Add publish script to package.json**

In `package.json` scripts, add:

```json
"publish": "electron-forge publish"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Test that `npm run make` still works**

Run: `npm run make`
Expected: Build succeeds and produces artifacts in `out/make/`. Verify that a `latest.yml` file was generated alongside the Windows artifact.

- [ ] **Step 6: Commit**

```bash
git add forge.config.ts package.json package-lock.json
git commit -m "feat(release): configure Forge publisher-github with latest.yml generation"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run dev mode**

Run: `npm start`
Expected: App launches, no auto-updater errors in console (skipped because `!app.isPackaged`)

- [ ] **Step 4: Run make**

Run: `npm run make`
Expected: Build succeeds, `latest.yml` generated in output directory alongside artifacts
