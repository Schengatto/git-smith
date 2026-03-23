# Editor Integration (VS Code / External Editor)

**Date:** 2026-03-23
**Status:** Approved

## Overview

Add configurable external editor support to GitSmith. Users can specify an editor (VS Code, VS Code Insiders, Cursor, or custom) and open the repository root or individual files from the app.

## Settings — New "Editor" Tab

New tab in SettingsDialog between "Merge Tool" and "Advanced".

### Preset System

Dropdown with presets that auto-fill path and args:

| Preset | Windows Path | macOS Path | Linux Path |
|--------|-------------|------------|------------|
| VS Code | `C:\Program Files\Microsoft VS Code\Code.exe` | `/usr/local/bin/code` | `/usr/bin/code` |
| VS Code Insiders | `C:\Program Files\Microsoft VS Code Insiders\Code - Insiders.exe` | `/usr/local/bin/code-insiders` | `/usr/bin/code-insiders` |
| Cursor | `C:\Users\{user}\AppData\Local\Programs\Cursor\Cursor.exe` | `/usr/local/bin/cursor` | `/usr/bin/cursor` |
| Custom | *(empty)* | *(empty)* | *(empty)* |

### New Fields in `AppSettings`

```typescript
editorName: string;  // preset name or "custom", default: ""
editorPath: string;  // absolute path to executable, default: ""
editorArgs: string;  // args for file opening, default: "$FILE"
```

### UI Components

- **Preset dropdown** — selecting a preset fills path/args for current platform
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

## Main Process — `src/main/ipc/editor.ipc.ts` (new file)

### `EDITOR.LAUNCH` Handler

- Receives: repo path (string)
- Reads `editorPath` from settings
- Validates executable exists
- Spawns: `editorPath <repoPath>` with `detached: true`, `stdio: 'ignore'`, then `unref()`
- Fire-and-forget — does not wait for editor to close

### `EDITOR.LAUNCH_FILE` Handler

- Receives: absolute file path (string)
- Reads `editorPath` and `editorArgs` from settings
- Replaces `$FILE` in args with actual path
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
- onClick: calls `window.electronAPI.editor.launchFile(absoluteFilePath)`
- Hidden if no editor configured

## i18n Keys

```json
{
  "editor.openInEditor": "Open in {{editorName}}",
  "editor.notConfigured": "No editor configured",
  "settings.editor": "Editor",
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
| `src/shared/ipc-channels.ts` | +`EDITOR.LAUNCH`, `EDITOR.LAUNCH_FILE` |
| `src/main/ipc/editor.ipc.ts` | **New** — IPC handlers for spawning editor |
| `src/main/index.ts` | Import and register editor IPC handlers |
| `src/preload/index.ts` | +`editor.launch()`, `editor.launchFile()` |
| `src/renderer/components/dialogs/SettingsDialog.tsx` | +EditorTab component |
| `src/renderer/components/layout/MenuBar.tsx` | +menu item in Tools |
| `src/renderer/components/layout/Toolbar.tsx` | +editor button |
| File context menus (various) | +`"Open in {editor}"` item |
| `src/renderer/i18n/en.json` | +editor i18n keys |
| `src/renderer/i18n/it.json` | +editor i18n keys |

## What Does NOT Change

- `git-service.ts` — not a git operation
- No new Zustand store — reads from existing settings
- No new electron-store schema — uses existing `AppSettings`
