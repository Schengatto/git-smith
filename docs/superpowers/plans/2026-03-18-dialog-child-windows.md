# Dialog Child Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open 5 complex dialogs (MergeConflictDialog, CommitInfoWindow, StashDialog, SettingsDialog, InteractiveRebaseDialog) as separate Electron BrowserWindows instead of in-window React overlays.

**Architecture:** Child windows load the same Vite renderer URL with a `?dialog=<Name>` query parameter. The React entry point branches on this param to render only the requested dialog via a `DialogRouter` component. Communication uses standard IPC through the main process.

**Tech Stack:** Electron BrowserWindow, React, TypeScript, IPC (ipcMain/ipcRenderer)

**Spec:** `docs/superpowers/specs/2026-03-18-dialog-child-windows-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/shared/dialog-types.ts` | Dialog config type, dialog names enum, window options per dialog |
| `src/main/window-manager.ts` | Create/track/close child BrowserWindows, store init data, forward results |
| `src/main/ipc/dialog.ipc.ts` | IPC handlers for DIALOG.OPEN, CLOSE, GET_INIT_DATA, RESULT |
| `src/renderer/components/DialogRouter.tsx` | Route `?dialog=` param to correct dialog component, error boundary |
| `src/main/window-manager.test.ts` | Unit tests for WindowManager |
| `src/main/ipc/dialog.ipc.test.ts` | Unit tests for dialog IPC handlers |
| `src/renderer/components/DialogRouter.test.tsx` | Unit tests for DialogRouter routing |
| `src/renderer/utils/open-dialog.ts` | Utility to open dialogs in child windows via IPC |

### Modified Files

| File | Change |
|------|--------|
| `src/shared/ipc-channels.ts` | Add `DIALOG` section with 5 channels |
| `src/preload/index.ts` | Add `dialog` namespace to electronAPI |
| `src/main/ipc/index.ts` | Register dialog handlers |
| `src/main/index.ts` | Export `mainWindow` getter for window-manager |
| `src/renderer/components/layout/AppShell.tsx` | Add ON_RESULT listener for dialog results |
| `src/renderer/index.tsx` | Branch on `?dialog=` to render DialogRouter vs App |
| `src/renderer/components/dialogs/MergeConflictDialog.tsx` | Add `mode` prop, skip overlay in window mode |
| `src/renderer/components/dialogs/CommitInfoWindow.tsx` | Add `mode` prop, skip overlay, replace onNavigateToCommit with IPC |
| `src/renderer/components/dialogs/StashDialog.tsx` | Add `mode` prop, skip overlay, remove Zustand deps in window mode |
| `src/renderer/components/dialogs/SettingsDialog.tsx` | Add `mode` prop, skip overlay, remove Zustand deps in window mode |
| `src/renderer/components/dialogs/InteractiveRebaseDialog.tsx` | Add `mode` prop, skip overlay, remove Zustand deps in window mode |

---

## Task 1: IPC Channels and Shared Types

**Files:**
- Modify: `src/shared/ipc-channels.ts:183` (before closing `as const`)
- Create: `src/shared/dialog-types.ts`

- [ ] **Step 1: Add DIALOG channels to ipc-channels.ts**

In `src/shared/ipc-channels.ts`, add before the closing `} as const;` (line 183):

```typescript
  DIALOG: {
    OPEN: "dialog:open",
    CLOSE: "dialog:close",
    GET_INIT_DATA: "dialog:get-init-data",
    RESULT: "dialog:result",
    ON_RESULT: "dialog:on-result",
  },
```

- [ ] **Step 2: Create dialog-types.ts**

Create `src/shared/dialog-types.ts`:

```typescript
export type DialogName =
  | "MergeConflictDialog"
  | "CommitInfoWindow"
  | "StashDialog"
  | "SettingsDialog"
  | "InteractiveRebaseDialog";

export interface DialogWindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  modal: boolean;
}

export const DIALOG_CONFIGS: Record<DialogName, DialogWindowConfig> = {
  MergeConflictDialog:     { width: 1200, height: 800, minWidth: 800, minHeight: 500, modal: false },
  CommitInfoWindow:        { width: 900,  height: 700, minWidth: 600, minHeight: 400, modal: false },
  StashDialog:             { width: 850,  height: 600, minWidth: 600, minHeight: 400, modal: true },
  SettingsDialog:          { width: 800,  height: 600, minWidth: 600, minHeight: 400, modal: true },
  InteractiveRebaseDialog: { width: 900,  height: 650, minWidth: 700, minHeight: 400, modal: true },
};

export interface DialogOpenRequest {
  dialog: DialogName;
  data?: Record<string, unknown>;
}

export interface DialogResult {
  dialogName: DialogName;
  action: "resolved" | "cancelled" | "navigate" | "closed";
  data?: Record<string, unknown>;
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc-channels.ts src/shared/dialog-types.ts
git commit -m "feat(dialog-windows): add IPC channels and shared types"
```

---

## Task 2: Window Manager (main process)

**Files:**
- Modify: `src/main/index.ts:23` (mainWindow export)
- Create: `src/main/window-manager.ts`
- Create: `src/main/window-manager.test.ts`

- [ ] **Step 1: Export mainWindow getter from index.ts**

In `src/main/index.ts`, add after `let mainWindow: BrowserWindow | null = null;` (line 23):

```typescript
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
```

- [ ] **Step 2: Write failing test for window-manager**

Create `src/main/window-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock("./index", () => ({
  getMainWindow: vi.fn(() => null),
}));

import { WindowManager } from "./window-manager";

describe("WindowManager", () => {
  let wm: WindowManager;

  beforeEach(() => {
    wm = new WindowManager();
  });

  afterEach(() => {
    wm.closeAll();
  });

  describe("getInitData / setInitData", () => {
    it("stores and retrieves init data by window id", () => {
      wm.setInitData(42, { filePath: "test.txt" });
      const data = wm.getInitData(42);
      expect(data).toEqual({ filePath: "test.txt" });
    });

    it("removes data after retrieval", () => {
      wm.setInitData(42, { filePath: "test.txt" });
      wm.getInitData(42);
      expect(wm.getInitData(42)).toBeUndefined();
    });
  });

  describe("tracking", () => {
    it("tracks open dialog windows", () => {
      const fakeWin = {
        id: 1,
        isDestroyed: () => false,
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { id: 1, send: vi.fn() },
      };
      wm.track("StashDialog", fakeWin as never);
      expect(wm.getWindow("StashDialog")).toBe(fakeWin);
    });

    it("returns undefined for untracked dialogs", () => {
      expect(wm.getWindow("StashDialog")).toBeUndefined();
    });

    it("closeAll closes all tracked windows", () => {
      const fakeWin = {
        id: 1,
        isDestroyed: () => false,
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { id: 1, send: vi.fn() },
      };
      wm.track("StashDialog", fakeWin as never);
      wm.closeAll();
      expect(fakeWin.close).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/main/window-manager.test.ts`
Expected: FAIL — `window-manager` module not found

- [ ] **Step 4: Implement WindowManager**

Create `src/main/window-manager.ts`:

```typescript
import { BrowserWindow } from "electron";
import path from "path";
import type { DialogName, DialogResult } from "../shared/dialog-types";
import { DIALOG_CONFIGS } from "../shared/dialog-types";
import { IPC } from "../shared/ipc-channels";
import { getMainWindow } from "./index";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private initDataMap = new Map<number, Record<string, unknown>>();
  /** Tracks windows that already sent an explicit result (to avoid double delivery) */
  private resultSent = new Set<number>();

  /** Store init data for a child window (keyed by window id) */
  setInitData(windowId: number, data: Record<string, unknown>): void {
    this.initDataMap.set(windowId, data);
  }

  /** Retrieve and remove init data for a child window */
  getInitData(windowId: number): Record<string, unknown> | undefined {
    const data = this.initDataMap.get(windowId);
    if (data !== undefined) this.initDataMap.delete(windowId);
    return data;
  }

  /** Track a dialog window. Key = dialogName (or dialogName:subkey for multi-instance). */
  track(key: string, win: BrowserWindow): void {
    this.windows.set(key, win);
    win.on("closed", () => {
      this.windows.delete(key);
    });
  }

  /** Get an existing tracked window */
  getWindow(key: string): BrowserWindow | undefined {
    const win = this.windows.get(key);
    if (win && !win.isDestroyed()) return win;
    this.windows.delete(key);
    return undefined;
  }

  /** Open a dialog in a child BrowserWindow */
  openDialog(
    dialogName: DialogName,
    data?: Record<string, unknown>,
  ): BrowserWindow {
    const config = DIALOG_CONFIGS[dialogName];

    // For CommitInfoWindow, allow multiple instances keyed by commit hash
    const trackKey =
      dialogName === "CommitInfoWindow" && data?.commitHash
        ? `CommitInfoWindow:${data.commitHash}`
        : dialogName;

    // Focus existing window if already open
    const existing = this.getWindow(trackKey);
    if (existing) {
      existing.focus();
      return existing;
    }

    const mainWindow = getMainWindow();

    const child = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      parent: mainWindow || undefined,
      modal: config.modal,
      show: false,
      title: dialogName.replace(/([A-Z])/g, " $1").trim(),
      backgroundColor: "#1e1e2e",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    if (data) {
      this.setInitData(child.id, data);
    }

    child.once("ready-to-show", () => child.show());

    // When child closes, send "closed" result ONLY if no explicit result was already sent
    child.on("closed", () => {
      if (this.resultSent.has(child.id)) {
        this.resultSent.delete(child.id);
        return; // Explicit result already sent by DialogRouter — skip
      }
      const main = getMainWindow();
      if (main && !main.isDestroyed()) {
        main.webContents.send(IPC.DIALOG.ON_RESULT, {
          dialogName,
          action: "closed",
        } satisfies DialogResult);
      }
    });

    this.track(trackKey, child);

    // Load the same renderer URL with ?dialog= param
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      child.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?dialog=${dialogName}`);
    } else {
      child.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { search: `dialog=${dialogName}` },
      );
    }

    return child;
  }

  /** Mark that an explicit result was sent for this window (prevents double delivery) */
  markResultSent(windowId: number): void {
    this.resultSent.add(windowId);
  }

  /** Close a specific dialog window */
  closeDialog(key: string): void {
    const win = this.getWindow(key);
    if (win) win.close();
  }

  /** Close all dialog windows */
  closeAll(): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) win.close();
    }
    this.windows.clear();
  }
}

export const windowManager = new WindowManager();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/main/window-manager.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/window-manager.ts src/main/window-manager.test.ts
git commit -m "feat(dialog-windows): add WindowManager for child BrowserWindows"
```

---

## Task 3: Dialog IPC Handlers

**Files:**
- Create: `src/main/ipc/dialog.ipc.ts`
- Create: `src/main/ipc/dialog.ipc.test.ts`
- Modify: `src/main/ipc/index.ts:17-35` (register dialog handlers)

- [ ] **Step 1: Write failing test for dialog IPC**

Create `src/main/ipc/dialog.ipc.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock("../window-manager", () => ({
  windowManager: {
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    getInitData: vi.fn(),
  },
}));

vi.mock("../index", () => ({
  getMainWindow: vi.fn(() => ({
    webContents: { send: vi.fn() },
    isDestroyed: () => false,
  })),
}));

import { registerDialogHandlers } from "./dialog.ipc";

describe("dialog IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers all dialog IPC channels", () => {
    registerDialogHandlers();
    const handleCalls = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(handleCalls).toContain(IPC.DIALOG.OPEN);
    expect(handleCalls).toContain(IPC.DIALOG.CLOSE);
    expect(handleCalls).toContain(IPC.DIALOG.GET_INIT_DATA);

    const onCalls = vi.mocked(ipcMain.on).mock.calls.map((c) => c[0]);
    expect(onCalls).toContain(IPC.DIALOG.RESULT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/ipc/dialog.ipc.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement dialog IPC handlers**

Create `src/main/ipc/dialog.ipc.ts`:

```typescript
import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { windowManager } from "../window-manager";
import { getMainWindow } from "../index";
import type { DialogOpenRequest, DialogResult } from "../../shared/dialog-types";

export function registerDialogHandlers(): void {
  // Open a dialog in a child window
  ipcMain.handle(
    IPC.DIALOG.OPEN,
    (_event: IpcMainInvokeEvent, request: DialogOpenRequest) => {
      const win = windowManager.openDialog(request.dialog, request.data);
      return { windowId: win.id };
    },
  );

  // Close a dialog window
  ipcMain.handle(
    IPC.DIALOG.CLOSE,
    (_event: IpcMainInvokeEvent, dialogKey: string) => {
      windowManager.closeDialog(dialogKey);
    },
  );

  // Child window requests its init data
  ipcMain.handle(IPC.DIALOG.GET_INIT_DATA, (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return undefined;
    return windowManager.getInitData(win.id);
  });

  // Child sends result — forward to main window and mark as sent (prevents double delivery)
  ipcMain.on(IPC.DIALOG.RESULT, (event, result: DialogResult) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowManager.markResultSent(win.id);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.DIALOG.ON_RESULT, result);
    }
  });
}
```

- [ ] **Step 4: Register in index.ts**

In `src/main/ipc/index.ts`, add import at line 16:

```typescript
import { registerDialogHandlers } from "./dialog.ipc";
```

Add call inside `registerAllHandlers()` at line 34:

```typescript
  registerDialogHandlers();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/main/ipc/dialog.ipc.test.ts`
Expected: PASS

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/dialog.ipc.ts src/main/ipc/dialog.ipc.test.ts src/main/ipc/index.ts
git commit -m "feat(dialog-windows): add dialog IPC handlers"
```

---

## Task 4: Preload API

**Files:**
- Modify: `src/preload/index.ts:315-401` (add dialog namespace before `shell` or at end)

- [ ] **Step 1: Add dialog namespace to preload API**

In `src/preload/index.ts`, add a `dialog` namespace inside the `electronAPI` object, before the `shell` namespace (around line 316):

```typescript
  dialog: {
    open: (request: import("../shared/dialog-types").DialogOpenRequest): Promise<{ windowId: number }> =>
      ipcRenderer.invoke(IPC.DIALOG.OPEN, request),
    close: (dialogKey: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DIALOG.CLOSE, dialogKey),
    getInitData: (): Promise<Record<string, unknown> | undefined> =>
      ipcRenderer.invoke(IPC.DIALOG.GET_INIT_DATA),
    sendResult: (result: import("../shared/dialog-types").DialogResult): void => {
      ipcRenderer.send(IPC.DIALOG.RESULT, result);
    },
    onResult: (callback: (result: import("../shared/dialog-types").DialogResult) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, result: import("../shared/dialog-types").DialogResult) =>
        callback(result);
      ipcRenderer.on(IPC.DIALOG.ON_RESULT, handler);
      return () => ipcRenderer.removeListener(IPC.DIALOG.ON_RESULT, handler);
    },
  },
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(dialog-windows): expose dialog API in preload"
```

---

## Task 5: Renderer Entry Point and DialogRouter

**Files:**
- Modify: `src/renderer/index.tsx:1-20` (branching logic)
- Create: `src/renderer/components/DialogRouter.tsx`
- Create: `src/renderer/components/DialogRouter.test.tsx`

- [ ] **Step 1: No changes needed to index.html**

The splash screen handling is done entirely in `index.tsx` (Step 5 below). The CSP (`script-src 'self'`) blocks inline scripts, so we handle splash removal in the TypeScript entry point instead. No HTML changes needed.

- [ ] **Step 2: Write failing test for DialogRouter**

Create `src/renderer/components/DialogRouter.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock the dialog components
vi.mock("./dialogs/MergeConflictDialog", () => ({
  MergeConflictDialog: (props: Record<string, unknown>) => (
    <div data-testid="merge-conflict-dialog" data-mode={props.mode}>MergeConflictDialog</div>
  ),
}));
vi.mock("./dialogs/CommitInfoWindow", () => ({
  CommitInfoWindow: (props: Record<string, unknown>) => (
    <div data-testid="commit-info-window" data-mode={props.mode}>CommitInfoWindow</div>
  ),
}));
vi.mock("./dialogs/StashDialog", () => ({
  StashDialog: (props: Record<string, unknown>) => (
    <div data-testid="stash-dialog" data-mode={props.mode}>StashDialog</div>
  ),
}));
vi.mock("./dialogs/SettingsDialog", () => ({
  SettingsDialog: (props: Record<string, unknown>) => (
    <div data-testid="settings-dialog" data-mode={props.mode}>SettingsDialog</div>
  ),
}));
vi.mock("./dialogs/InteractiveRebaseDialog", () => ({
  InteractiveRebaseDialog: (props: Record<string, unknown>) => (
    <div data-testid="interactive-rebase-dialog" data-mode={props.mode}>InteractiveRebaseDialog</div>
  ),
}));

import { DialogRouter } from "./DialogRouter";

describe("DialogRouter", () => {
  it("renders MergeConflictDialog for matching name", () => {
    render(<DialogRouter dialog="MergeConflictDialog" />);
    expect(screen.getByTestId("merge-conflict-dialog")).toBeDefined();
    expect(screen.getByTestId("merge-conflict-dialog").dataset.mode).toBe("window");
  });

  it("renders CommitInfoWindow for matching name", () => {
    render(<DialogRouter dialog="CommitInfoWindow" />);
    expect(screen.getByTestId("commit-info-window")).toBeDefined();
  });

  it("renders StashDialog for matching name", () => {
    render(<DialogRouter dialog="StashDialog" />);
    expect(screen.getByTestId("stash-dialog")).toBeDefined();
  });

  it("renders SettingsDialog for matching name", () => {
    render(<DialogRouter dialog="SettingsDialog" />);
    expect(screen.getByTestId("settings-dialog")).toBeDefined();
  });

  it("renders InteractiveRebaseDialog for matching name", () => {
    render(<DialogRouter dialog="InteractiveRebaseDialog" />);
    expect(screen.getByTestId("interactive-rebase-dialog")).toBeDefined();
  });

  it("shows error for unknown dialog name", () => {
    render(<DialogRouter dialog="UnknownDialog" />);
    expect(screen.getByText(/unknown dialog/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/DialogRouter.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 4: Implement DialogRouter**

Create `src/renderer/components/DialogRouter.tsx`:

```tsx
import React, { Component, useEffect, useState } from "react";
import type { DialogResult } from "../../shared/dialog-types";

// Lazy imports to keep bundle splitting clean
import { MergeConflictDialog } from "./dialogs/MergeConflictDialog";
import { CommitInfoWindow } from "./dialogs/CommitInfoWindow";
import { StashDialog } from "./dialogs/StashDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { InteractiveRebaseDialog } from "./dialogs/InteractiveRebaseDialog";

interface Props {
  dialog: string;
}

/** Error boundary for child window dialogs */
class DialogErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[DialogRouter] Render error:", error);
    // Close window after a short delay
    setTimeout(() => window.close(), 3000);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            color: "var(--text-primary)",
            background: "var(--surface-0)",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "var(--red)", fontSize: 14 }}>
            Dialog error: {this.state.error.message}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
            Window will close automatically...
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const DialogRouter: React.FC<Props> = ({ dialog }) => {
  const [initData, setInitData] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Request init data from main process
    window.electronAPI.dialog
      .getInitData()
      .then((data) => {
        if (data) setInitData(data);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const handleClose = () => {
    window.electronAPI.dialog.sendResult({
      dialogName: dialog as DialogResult["dialogName"],
      action: "cancelled",
    });
    window.close();
  };

  const handleResult = (action: DialogResult["action"], data?: Record<string, unknown>) => {
    window.electronAPI.dialog.sendResult({
      dialogName: dialog as DialogResult["dialogName"],
      action,
      data,
    });
    if (action !== "navigate") window.close();
  };

  if (!ready) {
    return (
      <div
        style={{
          height: "100vh",
          background: "var(--surface-0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading...
      </div>
    );
  }

  const dialogContent = (() => {
    switch (dialog) {
      case "MergeConflictDialog":
        return (
          <MergeConflictDialog
            open={true}
            onClose={handleClose}
            onResolved={() => handleResult("resolved")}
            mode="window"
          />
        );
      case "CommitInfoWindow":
        return (
          <CommitInfoWindow
            open={true}
            onClose={handleClose}
            commitHash={(initData.commitHash as string) || "HEAD"}
            onNavigateToCommit={(hash: string) =>
              handleResult("navigate", { hash })
            }
            mode="window"
          />
        );
      case "StashDialog":
        return (
          <StashDialog
            open={true}
            onClose={handleClose}
            mode="window"
          />
        );
      case "SettingsDialog":
        return (
          <SettingsDialog
            open={true}
            onClose={handleClose}
            mode="window"
          />
        );
      case "InteractiveRebaseDialog":
        return (
          <InteractiveRebaseDialog
            open={true}
            onClose={handleClose}
            onto={(initData.onto as string) || ""}
            mode="window"
          />
        );
      default:
        return (
          <div
            style={{
              padding: 24,
              color: "var(--text-primary)",
              background: "var(--surface-0)",
              height: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: "var(--red)" }}>Unknown dialog: {dialog}</p>
          </div>
        );
    }
  })();

  return <DialogErrorBoundary>{dialogContent}</DialogErrorBoundary>;
};
```

- [ ] **Step 5: Update index.tsx to branch on ?dialog=**

Replace `src/renderer/index.tsx` entirely:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DialogRouter } from "./components/DialogRouter";
import "dockview/dist/styles/dockview.css";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const dialogName = params.get("dialog");

// Remove splash screen immediately for dialog windows, with animation for main
const splash = document.getElementById("splash");
if (splash) {
  if (dialogName) {
    splash.remove();
  } else {
    splash.style.transition = "opacity 0.3s ease";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 300);
  }
}

const root = createRoot(document.getElementById("root")!);

if (dialogName) {
  // Child window: render only the requested dialog
  root.render(
    <React.StrictMode>
      <DialogRouter dialog={dialogName} />
    </React.StrictMode>
  );
} else {
  // Main window: render the full app
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

- [ ] **Step 6: Run DialogRouter tests**

Run: `npx vitest run src/renderer/components/DialogRouter.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: Will show errors about `mode` prop not existing on dialog components yet. **This is expected — proceed anyway.** Tasks 6-10 will add the `mode` prop to each dialog, resolving these errors.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.tsx src/renderer/components/DialogRouter.tsx src/renderer/components/DialogRouter.test.tsx
git commit -m "feat(dialog-windows): add DialogRouter and entry point branching"
```

---

## Task 6: Adapt MergeConflictDialog

**Files:**
- Modify: `src/renderer/components/dialogs/MergeConflictDialog.tsx`

This dialog has NO Zustand dependencies — simplest adaptation.

- [ ] **Step 1: Add `mode` prop to Props interface**

In `MergeConflictDialog.tsx`, update the Props interface (lines 4-8):

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onResolved?: () => void;
  mode?: "overlay" | "window";
}
```

Update the component destructuring to include `mode = "overlay"`:

```typescript
export const MergeConflictDialog: React.FC<Props> = ({ open, onClose, onResolved, mode = "overlay" }) => {
```

- [ ] **Step 2: Wrap overlay conditionally**

Find the outer overlay `<div>` (the one with `position: "fixed", inset: 0, zIndex: 100`). When `mode === "window"`, skip the overlay and render the dialog content directly at full size.

The pattern is: wrap the content in a conditional. In window mode, the outermost element should be:

```typescript
<div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-0)" }}>
```

Instead of the fixed-position overlay with backdrop.

The inner dialog content (header, file list, 3-pane editor, footer) stays the same, but remove max-width/max-height constraints in window mode.

- [ ] **Step 3: Add mode test**

In `MergeConflictDialog.test.tsx`, add a test verifying window mode renders without overlay:

```tsx
it("renders without overlay backdrop in window mode", () => {
  render(<MergeConflictDialog open={true} onClose={vi.fn()} mode="window" />);
  // Should NOT have a fixed-position overlay backdrop
  const container = document.querySelector('[style*="position: fixed"]');
  expect(container).toBeNull();
  // Should have full-viewport container
  const viewport = document.querySelector('[style*="height: 100vh"]');
  expect(viewport).toBeTruthy();
});
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/dialogs/MergeConflictDialog.tsx src/renderer/components/dialogs/MergeConflictDialog.test.tsx
git commit -m "feat(dialog-windows): adapt MergeConflictDialog for window mode"
```

---

## Task 7: Adapt CommitInfoWindow

**Files:**
- Modify: `src/renderer/components/dialogs/CommitInfoWindow.tsx`

This dialog has NO Zustand dependencies. The `onNavigateToCommit` callback already works via props — the DialogRouter passes an IPC-based version.

- [ ] **Step 1: Add `mode` prop to Props interface**

Update Props (lines 9-14):

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  onNavigateToCommit?: (hash: string) => void;
  mode?: "overlay" | "window";
}
```

Update destructuring to include `mode = "overlay"`.

- [ ] **Step 2: Wrap overlay conditionally**

Same pattern as Task 6: when `mode === "window"`, replace the fixed-position overlay with a full-viewport container. Remove max-width/height constraints.

- [ ] **Step 3: Add mode test**

In `CommitInfoWindow.test.tsx`, add a test verifying window mode renders without overlay (same pattern as Task 6 Step 3).

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/dialogs/CommitInfoWindow.tsx src/renderer/components/dialogs/CommitInfoWindow.test.tsx
git commit -m "feat(dialog-windows): adapt CommitInfoWindow for window mode"
```

---

## Task 8: Adapt StashDialog

**Files:**
- Modify: `src/renderer/components/dialogs/StashDialog.tsx`

This dialog imports `useRepoStore` and `useGraphStore`. In window mode, these stores will be empty.

- [ ] **Step 1: Add `mode` prop to Props interface**

Update Props (lines 7-10):

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "overlay" | "window";
}
```

Update destructuring to include `mode = "overlay"`.

- [ ] **Step 2: Conditionally use Zustand stores**

Where `refreshStatus` and `loadGraph` are called (after stash operations), wrap them:

```typescript
if (mode === "overlay") {
  refreshStatus();
  loadGraph();
}
// In window mode, the parent will refresh via ON_RESULT listener
```

Keep the store imports — they just won't be called in window mode.

- [ ] **Step 3: Wrap overlay conditionally**

Same pattern: when `mode === "window"`, full-viewport container instead of overlay.

- [ ] **Step 4: Add mode test**

In `StashDialog.test.tsx`, add a test verifying window mode renders without overlay (same pattern as Task 6 Step 3).

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/dialogs/StashDialog.tsx src/renderer/components/dialogs/StashDialog.test.tsx
git commit -m "feat(dialog-windows): adapt StashDialog for window mode"
```

---

## Task 9: Adapt SettingsDialog

**Files:**
- Modify: `src/renderer/components/dialogs/SettingsDialog.tsx`

This dialog imports `useUIStore` and `useAccountStore`. In window mode, theme changes and account updates should be communicated via IPC.

- [ ] **Step 1: Add `mode` prop to Props interface**

Update Props (lines 42-45):

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "overlay" | "window";
}
```

Update destructuring to include `mode = "overlay"`.

- [ ] **Step 2: Handle Zustand stores in window mode**

**Important:** `useUIStore()` and `useAccountStore()` are React hooks — they MUST be called unconditionally (React rules of hooks). The hooks work fine in child windows (they return empty/default state).

The strategy: call hooks unconditionally, but only use store *actions* that trigger side effects in overlay mode. In practice, SettingsDialog already saves settings via `electronAPI.settings.update()` (IPC) which works in both modes. The stores are mostly used for local UI state updates (e.g. notifying Toolbar of account changes). In window mode, the parent refreshes via `ON_RESULT`.

Where store actions are called after saving settings, guard only the action calls:

```typescript
// Hooks called unconditionally (top of component) — this is fine
const { accounts, loadAccounts } = useAccountStore();

// After a save operation, only refresh overlay-mode stores
if (mode === "overlay") {
  loadAccounts(); // triggers IPC + store update in overlay
}
// In window mode, parent refreshes via ON_RESULT listener
```

- [ ] **Step 3: Wrap overlay conditionally**

Same pattern: full-viewport container in window mode.

- [ ] **Step 4: Add mode test**

In `SettingsDialog.test.tsx` (create if not exists), add a test verifying window mode renders without overlay (same pattern as Task 6 Step 3).

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/dialogs/SettingsDialog.tsx src/renderer/components/dialogs/SettingsDialog.test.tsx
git commit -m "feat(dialog-windows): adapt SettingsDialog for window mode"
```

---

## Task 10: Adapt InteractiveRebaseDialog

**Files:**
- Modify: `src/renderer/components/dialogs/InteractiveRebaseDialog.tsx`

This dialog imports `useRepoStore` and `useGraphStore`. In window mode, the parent refreshes via ON_RESULT.

- [ ] **Step 1: Add `mode` prop to Props interface**

Update Props (lines 14-18):

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onto: string;
  mode?: "overlay" | "window";
}
```

Update destructuring to include `mode = "overlay"`.

- [ ] **Step 2: Conditionally use Zustand stores**

Where `refreshInfo`, `refreshStatus`, and `loadGraph` are called after rebase operations, guard:

```typescript
if (mode === "overlay") {
  refreshInfo();
  refreshStatus();
  loadGraph();
}
```

- [ ] **Step 3: Wrap overlay conditionally**

Same pattern: full-viewport container in window mode.

- [ ] **Step 4: Add mode test**

In `InteractiveRebaseDialog.test.tsx` (create if not exists), add a test verifying window mode renders without overlay (same pattern as Task 6 Step 3).

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/dialogs/InteractiveRebaseDialog.tsx src/renderer/components/dialogs/InteractiveRebaseDialog.test.tsx
git commit -m "feat(dialog-windows): adapt InteractiveRebaseDialog for window mode"
```

---

## Task 11: Wire Up Dialog Opening from UI

**Files:**
- Create: `src/renderer/utils/open-dialog.ts`
- Modify: `src/renderer/components/layout/AppShell.tsx:23,251` (SettingsDialog → window, ON_RESULT listener)
- Modify: `src/renderer/components/graph/CommitGraphPanel.tsx:9,747` (CommitInfoWindow → window)
- Modify: `src/renderer/components/layout/Toolbar.tsx:10,744` (StashDialog → window)
- Modify: `src/renderer/components/commit/CommitDialog.tsx:7,1109` (MergeConflictDialog → window)
- Modify: `src/renderer/components/dialogs/RebaseDialog.tsx:3,510` (MergeConflictDialog → window)
- Modify: `src/renderer/components/sidebar/Sidebar.tsx:17,583` (InteractiveRebaseDialog → window)

**Dialog render locations (where `<XxxDialog open={...}>` is rendered):**

| Dialog | Rendered in | Line |
|--------|-----------|------|
| SettingsDialog | `AppShell.tsx` | 251 |
| CommitInfoWindow | `CommitGraphPanel.tsx` | 747 |
| StashDialog | `Toolbar.tsx` | 744 |
| StashDialog (create) | `Sidebar.tsx` | 598 |
| MergeConflictDialog | `CommitDialog.tsx` | 1109 |
| MergeConflictDialog | `RebaseDialog.tsx` | 510 |
| InteractiveRebaseDialog | `Sidebar.tsx` | 583 |

- [ ] **Step 1: Create open-dialog utility**

Create `src/renderer/utils/open-dialog.ts`:

```typescript
import type { DialogOpenRequest } from "../../shared/dialog-types";

export function openDialogWindow(request: DialogOpenRequest): void {
  window.electronAPI.dialog.open(request);
}
```

- [ ] **Step 2: Replace dialog open triggers**

For each location above, replace the boolean state toggle + inline `<XxxDialog>` with a call to `openDialogWindow()`. Example for SettingsDialog in `AppShell.tsx`:

**Before:**
```tsx
const { settingsDialogOpen, closeSettingsDialog, openSettingsDialog } = useUIStore();
// ...
<SettingsDialog open={settingsDialogOpen} onClose={closeSettingsDialog} />
```

**After:**
```tsx
import { openDialogWindow } from "../utils/open-dialog";
// Replace openSettingsDialog with:
const handleOpenSettings = () => openDialogWindow({ dialog: "SettingsDialog" });
// Remove the <SettingsDialog> JSX element entirely
```

Apply the same pattern to each location. For dialogs that need init data, pass it:

```tsx
// CommitInfoWindow — pass commitHash
openDialogWindow({ dialog: "CommitInfoWindow", data: { commitHash: selectedHash } });

// InteractiveRebaseDialog — pass onto
openDialogWindow({ dialog: "InteractiveRebaseDialog", data: { onto: branch } });
```

**Note:** Keep the dialog component imports and `<XxxDialog>` JSX as dead code initially — remove in Task 12 cleanup if everything works. This makes reverting easy.

- [ ] **Step 3: Add ON_RESULT listener in AppShell.tsx**

In `src/renderer/components/layout/AppShell.tsx`, add a `useEffect` that listens for dialog results and refreshes state:

```typescript
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

// Inside AppShell component:
useEffect(() => {
  const unsubscribe = window.electronAPI.dialog.onResult((result) => {
    if (result.action === "resolved" || result.action === "closed") {
      // Refresh graph and status after any dialog completes
      useRepoStore.getState().refreshInfo();
      useRepoStore.getState().refreshStatus();
      useGraphStore.getState().loadGraph();
    }
    if (result.action === "navigate" && result.data?.hash) {
      // Scroll to commit in graph (CommitInfoWindow navigation)
      useGraphStore.getState().scrollToCommit(result.data.hash as string);
    }
  });
  return unsubscribe;
}, []);
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/utils/open-dialog.ts src/renderer/components/layout/AppShell.tsx src/renderer/components/graph/CommitGraphPanel.tsx src/renderer/components/layout/Toolbar.tsx src/renderer/components/commit/CommitDialog.tsx src/renderer/components/dialogs/RebaseDialog.tsx src/renderer/components/sidebar/Sidebar.tsx
git commit -m "feat(dialog-windows): wire up dialog opening from UI"
```

---

## Task 12: Full Integration Test and Cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Type check entire project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Lint**

Run: `npx eslint src/`
Expected: No new errors (pre-existing warnings are OK)

- [ ] **Step 4: Manual smoke test**

Run: `npm start`

Test each dialog:
1. Open MergeConflictDialog → should open in separate window, non-modal
2. Open CommitInfoWindow → separate window, non-modal, navigate-to-commit works
3. Open StashDialog → separate window, modal (main window blocked)
4. Open SettingsDialog → separate window, modal
5. Open InteractiveRebaseDialog → separate window, modal
6. Close main window → all child windows close
7. Reopen same dialog → focuses existing window instead of creating duplicate

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(dialog-windows): integration cleanup and final adjustments"
```
