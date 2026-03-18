# Release & Auto-Update System Design

## Overview

Professional release workflow and in-app auto-update for Git Expansion using Electron Forge Publisher + electron-updater. Manual release flow triggered by the developer, with native dialog prompts for users when updates are available.

## Existing State

The app already has:
- `electron-updater` 6.8.3 installed as dependency
- `src/main/auto-updater.ts` — functional auto-updater with native dialogs, IPC handlers, and status reporting
- `initAutoUpdater()` already called from `src/main/index.ts:158`
- `build.publish` block in `package.json` pointing to GitHub (`Schengatto/git-expansion`)
- `standard-version` scripts for versioning and changelog generation

What's **missing** to make this production-ready:
1. Forge publisher to upload builds to GitHub Releases
2. Squirrel.Windows lifecycle event handling
3. `electron-updater` externalized in Vite config
4. `latest.yml` generation for electron-updater version checks
5. Minor hardening of the existing auto-updater module

## Decisions

- **Release mode:** Manual — developer runs commands locally, no CI/CD
- **Update notification:** Native Electron dialog (modal) — already implemented
- **Code signing:** Not included (SmartScreen/Gatekeeper warnings accepted for now)
- **Update check frequency:** Once at app startup (10s delay) — already implemented
- **Draft releases:** Forge publishes as draft → developer reviews and publishes on GitHub
- **`autoInstallOnAppQuit`:** Keep `true` (existing behavior) — if user clicks "Later", update applies silently on next quit

## Architecture

### 1. Forge Publisher Configuration

Install `@electron-forge/publisher-github` and add to `forge.config.ts`:

```ts
import { PublisherGitHub } from "@electron-forge/publisher-github";

// in config.publishers:
publishers: [
  new PublisherGitHub({
    repository: { owner: "Schengatto", name: "git-expansion" },
    prerelease: false,
    draft: true,
  }),
]
```

Add script to `package.json`:

```json
"publish": "electron-forge publish"
```

**GitHub token:** Required as `GITHUB_TOKEN` env var at publish time. Not stored in repo.

### 2. `latest.yml` Generation (postMake hook)

**Problem:** `electron-updater` expects `latest.yml` / `latest-mac.yml` / `latest-linux.yml` files in the GitHub Release assets to perform version checks. Electron Forge does NOT generate these — they are an `electron-builder` concept.

**Solution:** Add a `postMake` hook in `forge.config.ts` that generates the appropriate `.yml` file from the make output. The hook computes the SHA-512 hash of each artifact and writes a YAML file in electron-updater's expected format:

```yaml
version: 0.2.1
files:
  - url: GitExpansion-Setup.exe
    sha512: <base64-sha512>
    size: <bytes>
path: GitExpansion-Setup.exe
sha512: <base64-sha512>
releaseDate: 2026-03-18T12:00:00.000Z
```

The hook generates:
- `latest.yml` — from Windows (Squirrel) artifacts
- `latest-mac.yml` — from macOS (ZIP) artifacts
- `latest-linux.yml` — from Linux (DEB) artifacts

**Critical:** The `postMake` hook receives `MakeResult[]` and must **return modified `MakeResult[]`** with the generated `.yml` file path appended to each platform's `artifacts` array. Simply placing the file in the output directory is not enough — Forge's publisher only uploads files listed in `MakeResult.artifacts`.

```ts
hooks: {
  postMake: async (forgeConfig, makeResults) => {
    for (const result of makeResults) {
      // generate latest.yml for this platform...
      result.artifacts.push(ymlPath);
    }
    return makeResults;
  }
}
```

### 3. Squirrel.Windows Lifecycle Events

Install `electron-squirrel-startup` and add at the **very top** of `src/main/index.ts`, before any other code:

```ts
import started from "electron-squirrel-startup";
if (started) app.quit();
```

This handles `--squirrel-install`, `--squirrel-updated`, `--squirrel-uninstall`, and `--squirrel-obsolete` events. Without this, the app's full GUI would launch during install/update/uninstall operations on Windows, causing visible errors and broken shortcuts.

**Note:** Electron Forge's Squirrel maker already depends on this package — it just needs to be used in the app code.

### 4. Vite External Configuration

Add `electron-updater` to the externals list in `vite.main.config.ts`:

```ts
external: ["node-pty", "@modelcontextprotocol/sdk", "zod", "electron-updater"],
```

`electron-updater` has dynamic requires and reads `app-update.yml` from the filesystem at runtime. Bundling it with Vite would break these behaviors.

### 5. Auto-Updater Module Improvements

The existing `src/main/auto-updater.ts` is mostly complete. Changes needed:

- Add `app.isPackaged` guard at the top of `initAutoUpdater()` to skip in dev mode
- Add `cancelId: 1` to both `dialog.showMessageBox` calls (Escape → "Later")
- Add `mainWindow.isDestroyed()` check before the "update-downloaded" dialog (already done for "update-available")
- Migrate hardcoded IPC strings (`"app:check-for-updates"`, `"app:get-version"`, `"app:update-status"`) to `src/shared/ipc-channels.ts` constants

### 6. Main Process Integration

Already done at `src/main/index.ts:158`. No changes needed.

### 7. Release Workflow

```bash
# 1. Bump version + generate CHANGELOG
npm run release          # patch (0.2.0 → 0.2.1)
npm run release:minor    # minor (0.2.0 → 0.3.0)
npm run release:major    # major (0.2.0 → 1.0.0)

# 2. Push commit + tag
git push --follow-tags

# 3. Build all platforms + upload as draft release
GITHUB_TOKEN=ghp_xxx npm run publish

# 4. Review draft on GitHub → Releases → Publish
```

## Runtime Provider Configuration

`electron-updater` reads the `build.publish` block from `package.json` at runtime to know which GitHub repo to check for updates. This block already exists and is correctly configured:

```json
"build": {
  "publish": [{ "provider": "github", "owner": "Schengatto", "repo": "git-expansion" }]
}
```

No `app-update.yml` file is needed — the `package.json` fallback is sufficient when using Forge instead of electron-builder.

## Platform Constraints

- **macOS:** Auto-update via electron-updater requires **ZIP** format (not DMG). Current config uses `MakerZIP` for darwin — this must not be changed.
- **Windows:** Squirrel.Windows is the update mechanism. `electron-squirrel-startup` is required.
- **Linux:** electron-updater supports AppImage for auto-update, but DEB/RPM do not auto-update. Linux users update via package manager. The `latest-linux.yml` is generated for completeness but auto-update won't work with DEB/RPM.
- **Cross-platform builds:** `npm run publish` only builds for the current OS. To publish for all platforms, run the command on each OS separately (or set up CI in the future). For now, Windows is the primary target.

## Files Modified

| File | Change |
|------|--------|
| `forge.config.ts` | Add PublisherGitHub, add postMake hook for latest.yml |
| `package.json` | Add `"publish"` script |
| `vite.main.config.ts` | Add `electron-updater` to externals |
| `src/main/index.ts` | Add `electron-squirrel-startup` check at top |
| `src/main/auto-updater.ts` | Add isPackaged guard, cancelId, use IPC constants |
| `src/shared/ipc-channels.ts` | Add APP update channel constants |

## Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `@electron-forge/publisher-github` | devDependency | Publish builds to GitHub Releases |
| `electron-squirrel-startup` | dependency | Handle Squirrel.Windows lifecycle events |
| `electron-updater` | dependency | Already installed (6.8.3) |

## Out of Scope

- CI/CD automation (GitHub Actions)
- Code signing (Windows Authenticode / macOS notarization)
- Periodic update checks while app is running
- Custom update UI (React component) — uses native Electron dialogs
- Delta/differential updates
- Linux auto-update (DEB/RPM don't support it)
