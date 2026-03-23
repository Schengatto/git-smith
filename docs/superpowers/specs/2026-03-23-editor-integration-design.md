# Editor Integration (VS Code / External Editor)

**Date:** 2026-03-23
**Status:** Approved

## Overview

Add configurable external editor support to GitSmith. Users can specify an editor (VS Code, VS Code Insiders, Cursor, or custom) and open the repository root or individual files from the app.

## Settings — New "Editor" Tab

New tab in SettingsDialog between "Merge Tool" and "Advanced".

### Preset System

Dropdown with presets that auto-fill path. Presets use bare executable names (available on PATH after standard installation):

| Preset | Executable |
|--------|-----------|
| VS Code | `code` |
| VS Code Insiders | `code-insiders` |
| Cursor | `cursor` |
| Custom | *(empty — user provides full path)* |

When "Custom" is selected, the user provides the full absolute path via a Browse button.

### New Fields in `AppSettings`

```typescript
editorName: string;  // preset name or "custom", default: ""
editorPath: string;  // executable name or absolute path, default: ""
editorArgs: string;  // args for file opening, default: "$FILE"
```

### UI Components

- **Preset dropdown** — selecting a preset fills path for current platform
- **Executable path** — text input + Browse button (file dialog)
- **Arguments** — text input with placeholder hint (`$FILE` replaced at runtime)

## IPC Channels

New channels in `ipc-channels.ts`:

```typescript
EDITOR: {
  LAUNCH: "git:editor:launch",          // open repo root folder
  LAUNCH_FILE: "git:editor:launch-file", // open specific file
}
```

Also remove the existing unused `SHELL.OPEN_FILE_IN_EDITOR` channel to avoid confusion.

## Validation & Security

Before spawning, the handler must:

1. **Validate `editorPath`**: must be either a bare executable name (preset) or an absolute path. If absolute, verify it exists with `fs.accessSync(path, fs.constants.X_OK)` (or `F_OK` on Windows).
2. **Validate `editorArgs`**: must pass the same allowlist regex used by the merge tool (`/^[\w\s"'\-/\\.=:$]*$/`). Reject shell metacharacters (`;`, `|`, `&`, `` ` ``, `$(...)`, etc.).
3. **Supported placeholders**: `$FILE` only. Unknown `$` tokens are left as-is (not expanded).
4. **Spawning**: always use `child_process.spawn` with array args (not shell string), `detached: true`, `stdio: 'ignore'`, then `unref()`.

## Error Handling

- If `editorPath` is missing or invalid, reject the IPC promise with a descriptive error.
- The renderer catches the rejection and shows a toast notification with the error message.
- After `spawn`, listen for the `error` event (e.g., ENOENT) and log to console — do not reject since the process is already unref'd.

## Main Process — `src/main/ipc/editor.ipc.ts` (new file)

### `EDITOR.LAUNCH` Handler

- Receives: repo path (string) — comes from current repo, not user input
- Reads `editorPath` from settings
- Validates executable (see Validation above)
- Spawns: `editorPath <repoPath>` as positional argument (no args template for repo-level open — all supported editors accept a folder path as positional arg)
- Fire-and-forget — does not wait for editor to close

### `EDITOR.LAUNCH_FILE` Handler

- Receives: relative file path (string) — resolved against current repo path in main process (same pattern as `shell.ipc.ts`)
- Reads `editorPath` and `editorArgs` from settings
- Replaces `$FILE` in args with resolved absolute path
- Validates args (see Validation above)
- Spawns detached process same as above

## Preload API — `src/preload/index.ts`

```typescript
editor: {
  launch: (repoPath: string) => Promise<void>,
  launchFile: (filePath: string) => Promise<void>,
}
```

## UI Integration Points

### Menu Tools (`MenuBar.tsx`)

New item after "Git Bash":
- Label: `"Open in {editorName}"` (dynamic based on configured editor)
- Disabled if: no repo open OR no editor configured
- onClick: calls `window.electronAPI.editor.launch(repoPath)`

### Toolbar (`Toolbar.tsx`)

New button in action area:
- Icon: code/editor icon
- Tooltip: `"Open in {editorName}"`
- Disabled if: no repo open OR no editor configured
- onClick: same as menu Tools action

### File Context Menu (various components)

New item near "Open in File Manager" / "Copy Path":
- Label: `"Open in {editorName}"`
- onClick: calls `window.electronAPI.editor.launchFile(relativeFilePath)`
- Hidden if no editor configured

## i18n Keys

```json
{
  "editor.openInEditor": "Open in {{editorName}}",
  "editor.notConfigured": "No editor configured",
  "editor.launchError": "Failed to open editor: {{error}}",
  "editor.pathInvalid": "Editor executable not found",
  "settings.editor": "Editor",
  "settings.editorDescription": "Configure an external code editor to open repositories and files",
  "settings.editorPreset": "Editor preset",
  "settings.editorPath": "Executable path",
  "settings.editorArgs": "Arguments",
  "settings.editorBrowse": "Browse...",
  "settings.editorPresetCustom": "Custom"
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/shared/settings-types.ts` | +3 fields: `editorName`, `editorPath`, `editorArgs` |
| `src/main/store.ts` | Default values for new fields |
| `src/shared/ipc-channels.ts` | +`EDITOR.LAUNCH`, `EDITOR.LAUNCH_FILE`; remove unused `SHELL.OPEN_FILE_IN_EDITOR` |
| `src/main/ipc/editor.ipc.ts` | **New** — IPC handlers for spawning editor |
| `src/main/index.ts` | Import and register editor IPC handlers |
| `src/preload/index.ts` | +`editor.launch()`, `editor.launchFile()` |
| `src/renderer/components/dialogs/SettingsDialog.tsx` | +EditorTab component |
| `src/renderer/components/layout/MenuBar.tsx` | +menu item in Tools |
| `src/renderer/components/layout/Toolbar.tsx` | +editor button |
| File context menus (various) | +`"Open in {editor}"` item |
| `src/renderer/i18n/en.json` | +editor i18n keys |
| `src/renderer/i18n/it.json` | +editor i18n keys |
| `src/renderer/i18n/de.json` | +editor i18n keys |
| `src/renderer/i18n/fr.json` | +editor i18n keys |
| `src/renderer/i18n/es.json` | +editor i18n keys |

## What Does NOT Change

- `git-service.ts` — not a git operation
- No new Zustand store — reads from existing settings
- No new electron-store schema — uses existing `AppSettings`
