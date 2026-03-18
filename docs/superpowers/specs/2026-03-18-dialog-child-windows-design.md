# Dialog Child Windows — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Problem

The complex dialogs (MergeConflictDialog, CommitInfoWindow, StashDialog, SettingsDialog, InteractiveRebaseDialog) appear too small as in-window overlays. File content, 3-pane merge editors, and large forms are hard to use at constrained sizes.

## Solution

Open these 5 complex dialogs as **real Electron BrowserWindow instances** instead of React overlays. Each dialog gets a native OS window: resizable, movable, can go on a second monitor.

## Architecture

### Approach: Shared Renderer URL with Query Parameter

Child windows load the **same Vite renderer URL** as the main window, appending `?dialog=<DialogName>`. The React entry point (`index.tsx`) checks for this parameter and renders only the requested dialog via a `DialogRouter` component.

**Benefits:**
- Zero changes to `forge.config.ts` — no second renderer entry needed
- Dialogs reuse the same preload, CSS, theme, and electronAPI
- All existing IPC calls work identically in child windows

### Data Flow

```
Renderer (user action, e.g. "Resolve Conflicts")
  → IPC: DIALOG.OPEN { dialog: "MergeConflictDialog", data: {...}, modal: false }
  → Main process (WindowManager): creates BrowserWindow
    - Loads same URL + ?dialog=MergeConflictDialog
    - Sets parent/modal based on config
  → Child window renderer: index.tsx sees ?dialog param
    - Renders <DialogRouter dialog="MergeConflictDialog" />
    - Requests initial data via IPC: DIALOG.GET_INIT_DATA
  → Child operates using standard electronAPI (conflict.list, etc.)
  → On completion: IPC DIALOG.RESULT → main → forwards to mainWindow
  → Main window renderer: listener updates state (e.g. refreshes graph)
```

### Window Configuration

| Dialog                   | Default Size | Min Size | Modal | Rationale                                    |
|--------------------------|-------------|----------|-------|----------------------------------------------|
| MergeConflictDialog      | 1200×800    | 800×500  | No    | User may consult repo while resolving        |
| CommitInfoWindow         | 900×700     | 600×400  | No    | Informational — doesn't block workflow        |
| StashDialog              | 850×600     | 600×400  | Yes   | Modifies git state, avoid concurrent actions  |
| SettingsDialog           | 800×600     | 600×400  | Yes   | Global configuration                         |
| InteractiveRebaseDialog  | 900×650     | 700×400  | Yes   | Destructive git operation                    |

### IPC Channels

New channels in `src/shared/ipc-channels.ts`:

```typescript
DIALOG: {
  OPEN: "dialog:open",           // renderer → main: open a dialog window
  CLOSE: "dialog:close",         // renderer → main: close a dialog window
  GET_INIT_DATA: "dialog:get-init-data", // child → main: get initial data
  RESULT: "dialog:result",       // child → main: send result back
  ON_RESULT: "dialog:on-result", // main → parent renderer: forward result
}
```

### Initial Data Passing (main → child)

The main process stores initial data in an in-memory map keyed by `windowId`. When the child window mounts, it requests the data via `DIALOG.GET_INIT_DATA`. The main process returns the data and removes it from the map.

```
Main: dialogDataMap.set(childWindow.id, { filePath, conflicts, ... })
Child: IPC GET_INIT_DATA → main returns data, deletes from map
```

### Result Communication (child → main → parent)

```
Child: IPC DIALOG.RESULT { dialogName, result: "resolved"|"cancelled", data? }
Main: forwards to mainWindow via webContents.send(DIALOG.ON_RESULT, ...)
Parent renderer: listener triggers state refresh
```

### URL Construction (dev vs production)

The window-manager must branch on the Vite dev server URL, mirroring `src/main/index.ts`:

```typescript
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  // Dev: append query param to HTTP URL
  childWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?dialog=${dialogName}`);
} else {
  // Production: use loadFile with search option
  childWindow.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    { search: `dialog=${dialogName}` }
  );
}
```

### Zustand Store Strategy in Child Windows

Child windows get a **fresh JavaScript context** — Zustand stores start empty. The strategy is:

- **Dialogs in `mode="window"` must NOT depend on Zustand stores.** They communicate entirely via IPC (electronAPI).
- `GET_INIT_DATA` provides the initial payload needed for the dialog to render.
- Any action that would normally update a Zustand store (e.g. refresh status, set theme) instead sends an IPC message via `DIALOG.RESULT` so the main window updates its own stores.

**Per-dialog store dependencies to remove in window mode:**

| Dialog | Current store deps | Window mode replacement |
|--------|-------------------|------------------------|
| MergeConflictDialog | None (already IPC-only) | No changes needed |
| CommitInfoWindow | `onNavigateToCommit` callback | IPC channel `DIALOG.NAVIGATE_COMMIT` → main forwards to parent renderer |
| StashDialog | `useRepoStore` (refreshInfo, refreshStatus) | On close/result, parent renderer refreshes via `ON_RESULT` listener |
| SettingsDialog | `useUIStore` (setTheme) | IPC-only; theme changes applied via `DIALOG.RESULT` with theme data |
| InteractiveRebaseDialog | `useRepoStore` (refreshInfo) | On close/result, parent renderer refreshes |

### Cross-Window Navigation

CommitInfoWindow's `onNavigateToCommit` callback cannot cross BrowserWindow boundaries. In window mode:

- Child sends IPC `DIALOG.RESULT` with `{ action: "navigate", hash: "abc123" }`
- Main process forwards to parent renderer
- Parent renderer scrolls the commit graph to that hash

New IPC event added to `DIALOG.ON_RESULT` payload: `{ dialogName, action: "navigate"|"resolved"|"cancelled", data? }`

### Lifecycle Rules

- **`parent` is always set** on child BrowserWindows (both modal and non-modal). This ensures closing the main window always closes all children.
- Closing the child window via native X button = "cancelled" result
- Modal windows block interaction with the parent (native OS behavior)
- **Single instance per dialog type**: WindowManager tracks open windows in a `Map<string, BrowserWindow>`. Reopening focuses the existing window. For CommitInfoWindow specifically, the key includes the commit hash to allow multiple instances for different commits.

### Splash Screen Handling

The `index.html` splash screen (`<div id="splash">`) must be **immediately hidden** when loading as a child dialog window. The `index.tsx` branching logic removes the splash element synchronously before React renders when `?dialog=` is present.

### Error Handling

`DialogRouter` includes:
- An **error boundary** that catches render errors, shows a brief message, and closes the window after 3 seconds
- A **fallback for unknown dialog names** that logs a warning and closes the window immediately

## New Files

| File | Purpose |
|------|---------|
| `src/main/window-manager.ts` | Create/manage child BrowserWindows, store init data map, forward results |
| `src/main/ipc/dialog.ipc.ts` | IPC handlers for DIALOG.OPEN, CLOSE, GET_INIT_DATA, RESULT |
| `src/renderer/components/DialogRouter.tsx` | Map dialog name → React component, fullscreen layout without overlay |

## Modified Files

| File | Change |
|------|--------|
| `src/shared/ipc-channels.ts` | Add `DIALOG` section |
| `src/preload/index.ts` | Expose `dialog.*` API (open, close, getInitData, sendResult, onResult) |
| `src/main/ipc/index.ts` | Register dialog handlers |
| `src/main/index.ts` | Export `mainWindow` reference for window-manager |
| `src/renderer/index.tsx` | Branch on `?dialog=` to render DialogRouter vs App |
| `src/renderer/components/dialogs/MergeConflictDialog.tsx` | Add `mode` prop; skip overlay when `mode="window"` |
| `src/renderer/components/dialogs/CommitInfoWindow.tsx` | Same adaptation |
| `src/renderer/components/dialogs/StashDialog.tsx` | Same adaptation |
| `src/renderer/components/dialogs/SettingsDialog.tsx` | Same adaptation |
| `src/renderer/components/dialogs/InteractiveRebaseDialog.tsx` | Same adaptation |

## Unchanged

Small form dialogs (CheckoutDialog, MergeDialog, CloneDialog, TagDialog, etc.) remain as in-window overlays. They are not content-heavy and work well at their current sizes.

## Testing

- Unit tests for `window-manager.ts` (window creation, data map, cleanup)
- Unit tests for `dialog.ipc.ts` (handler registration, IPC flow)
- Unit tests for `DialogRouter.tsx` (routing logic, component mapping)
- Each adapted dialog tested in both `mode="overlay"` and `mode="window"`

## Compatibility

All 5 dialogs retain the ability to work as in-window overlays (default `mode="overlay"`). The child window path sets `mode="window"`. This provides a fallback and keeps existing code paths functional.
