import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const {
  mockGetMainWindow,
  mockWebContentsSend,
  mockChildLoad,
  mockChildLoadFile,
  mockChildFocus,
  mockChildClose,
} = vi.hoisted(() => ({
  mockGetMainWindow: vi.fn(() => null as unknown),
  mockWebContentsSend: vi.fn(),
  mockChildLoad: vi.fn(),
  mockChildLoadFile: vi.fn(),
  mockChildFocus: vi.fn(),
  mockChildClose: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("./index", () => ({
  getMainWindow: mockGetMainWindow,
}));

// BrowserWindow is mocked as a constructor. We use a class so `new` works.
// createdWindows is declared here (module scope) so tests can inspect it.
let _browserWindowCallCount = 0;
const _createdWindows: ReturnType<typeof _makeFakeWindow>[] = [];

function _makeFakeWindow(id: number) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const onceListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  return {
    id,
    isDestroyed: vi.fn(() => false),
    close: mockChildClose,
    focus: mockChildFocus,
    loadURL: mockChildLoad,
    loadFile: mockChildLoadFile,
    webContents: { send: mockWebContentsSend, id },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event]!.push(cb);
    }),
    once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!onceListeners[event]) onceListeners[event] = [];
      onceListeners[event]!.push(cb);
    }),
    emit(event: string, ...args: unknown[]) {
      listeners[event]?.forEach((cb) => cb(...args));
      onceListeners[event]?.forEach((cb) => cb(...args));
    },
  };
}

vi.mock("electron", () => {
  class MockBrowserWindow {
    constructor(_opts: unknown) {
      _browserWindowCallCount++;
      const win = _makeFakeWindow(_browserWindowCallCount * 10);
      _createdWindows.push(win);
      Object.assign(this, win);
    }
  }
  return {
    BrowserWindow: MockBrowserWindow,
    ipcMain: { handle: vi.fn(), on: vi.fn() },
  };
});

// Silence Vite globals
Object.defineProperty(globalThis, "MAIN_WINDOW_VITE_DEV_SERVER_URL", {
  value: undefined,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "MAIN_WINDOW_VITE_NAME", {
  value: "main_window",
  writable: true,
  configurable: true,
});

// ── Imports ────────────────────────────────────────────────────────────────

import { WindowManager } from "./window-manager";
import { IPC } from "../shared/ipc-channels";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("WindowManager", () => {
  let wm: WindowManager;

  beforeEach(() => {
    // Reset fn mocks but NOT the BrowserWindow class (we use a class, not vi.fn)
    mockGetMainWindow.mockReset().mockReturnValue(null);
    mockWebContentsSend.mockReset();
    mockChildLoad.mockReset();
    mockChildLoadFile.mockReset();
    mockChildFocus.mockReset();
    mockChildClose.mockReset();

    _browserWindowCallCount = 0;
    _createdWindows.length = 0;
    wm = new WindowManager();
  });

  // ── setInitData / getInitData ─────────────────────────────────────────────

  describe("setInitData / getInitData", () => {
    it("stores and retrieves init data for a window id", () => {
      wm.setInitData(42, { filePath: "test.txt" });
      expect(wm.getInitData(42)).toEqual({ filePath: "test.txt" });
    });

    it("deletes the entry after first retrieval (one-shot)", () => {
      wm.setInitData(1, { x: 1 });
      wm.getInitData(1);
      expect(wm.getInitData(1)).toBeUndefined();
    });

    it("returns undefined for unknown window id", () => {
      expect(wm.getInitData(999)).toBeUndefined();
    });

    it("can store multiple different window ids independently", () => {
      wm.setInitData(1, { a: 1 });
      wm.setInitData(2, { b: 2 });
      expect(wm.getInitData(2)).toEqual({ b: 2 });
      expect(wm.getInitData(1)).toEqual({ a: 1 });
    });
  });

  // ── track / getWindow ─────────────────────────────────────────────────────

  describe("track / getWindow", () => {
    function fakeWin(id: number) {
      let closedCb: (() => void) | undefined;
      const w = {
        id,
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "closed") closedCb = cb;
        }),
        once: vi.fn(),
        webContents: { send: vi.fn(), id },
        triggerClose() {
          closedCb?.();
        },
      };
      return w;
    }

    it("returns tracked window", () => {
      const w = fakeWin(1);
      wm.track("SettingsDialog", w as never);
      expect(wm.getWindow("SettingsDialog")).toBe(w);
    });

    it("returns undefined for untracked key", () => {
      expect(wm.getWindow("UnknownDialog")).toBeUndefined();
    });

    it("returns undefined and cleans up for destroyed window", () => {
      const w = fakeWin(2);
      wm.track("StashDialog", w as never);
      w.isDestroyed.mockReturnValue(true);
      expect(wm.getWindow("StashDialog")).toBeUndefined();
    });

    it("removes window from map when 'closed' event fires", () => {
      const w = fakeWin(3);
      wm.track("SomeDialog", w as never);
      expect(wm.getWindow("SomeDialog")).toBe(w);
      w.triggerClose();
      expect(wm.getWindow("SomeDialog")).toBeUndefined();
    });
  });

  // ── markResultSent ────────────────────────────────────────────────────────

  describe("markResultSent", () => {
    it("does not throw when called", () => {
      expect(() => wm.markResultSent(42)).not.toThrow();
    });

    it("tracks multiple window ids", () => {
      wm.markResultSent(1);
      wm.markResultSent(2);
      expect(wm["resultSent"].has(1)).toBe(true);
      expect(wm["resultSent"].has(2)).toBe(true);
    });
  });

  // ── openDialog ────────────────────────────────────────────────────────────

  describe("openDialog", () => {
    it("creates a BrowserWindow", () => {
      wm.openDialog("SettingsDialog");
      expect(_createdWindows).toHaveLength(1);
    });

    it("returns existing window if same dialog is already open", () => {
      const win1 = wm.openDialog("SettingsDialog");
      const win2 = wm.openDialog("SettingsDialog");
      expect(win1).toBe(win2);
      expect(mockChildFocus).toHaveBeenCalledTimes(1);
    });

    it("stores init data when data is provided", () => {
      wm.openDialog("CommitInfoWindow", { commitHash: "abc123" });
      const win = _createdWindows[_createdWindows.length - 1]!;
      expect(wm.getInitData(win.id)).toEqual({ commitHash: "abc123" });
    });

    it("does not store init data when none provided", () => {
      wm.openDialog("SettingsDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;
      expect(wm.getInitData(win.id)).toBeUndefined();
    });

    it("uses commitHash in track key for CommitInfoWindow", () => {
      wm.openDialog("CommitInfoWindow", { commitHash: "deadbeef" });
      expect(wm.getWindow("CommitInfoWindow:deadbeef")).toBeDefined();
    });

    it("uses dialogName as track key for non-CommitInfoWindow dialogs", () => {
      wm.openDialog("SettingsDialog");
      expect(wm.getWindow("SettingsDialog")).toBeDefined();
    });

    it("uses dialogName as track key for CommitInfoWindow without commitHash", () => {
      wm.openDialog("CommitInfoWindow");
      expect(wm.getWindow("CommitInfoWindow")).toBeDefined();
    });

    it("sends 'closed' result to main window on child close (no explicit result)", () => {
      const mainWin = {
        webContents: { send: mockWebContentsSend },
        isDestroyed: vi.fn(() => false),
      };
      mockGetMainWindow.mockReturnValue(mainWin);

      wm.openDialog("StashDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;
      win.emit("closed");

      expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.DIALOG.ON_RESULT, {
        dialogName: "StashDialog",
        action: "closed",
      });
    });

    it("does NOT send 'closed' result when markResultSent was called", () => {
      const mainWin = {
        webContents: { send: mockWebContentsSend },
        isDestroyed: vi.fn(() => false),
      };
      mockGetMainWindow.mockReturnValue(mainWin);

      wm.openDialog("StashDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;

      wm.markResultSent(win.id);
      win.emit("closed");

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("cleans up resultSent set after skipping the result", () => {
      mockGetMainWindow.mockReturnValue(null);
      wm.openDialog("SettingsDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;

      wm.markResultSent(win.id);
      win.emit("closed");

      expect(wm["resultSent"].has(win.id)).toBe(false);
    });

    it("does NOT send 'closed' result when mainWindow is null", () => {
      mockGetMainWindow.mockReturnValue(null);
      wm.openDialog("SettingsDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;
      win.emit("closed");

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("does NOT send 'closed' result when mainWindow is destroyed", () => {
      const mainWin = {
        webContents: { send: mockWebContentsSend },
        isDestroyed: vi.fn(() => true),
      };
      mockGetMainWindow.mockReturnValue(mainWin);

      wm.openDialog("SettingsDialog");
      const win = _createdWindows[_createdWindows.length - 1]!;
      win.emit("closed");

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("loads file path when MAIN_WINDOW_VITE_DEV_SERVER_URL is undefined", () => {
      (globalThis as Record<string, unknown>)["MAIN_WINDOW_VITE_DEV_SERVER_URL"] =
        undefined;
      wm.openDialog("SettingsDialog");
      expect(mockChildLoadFile).toHaveBeenCalled();
    });

    it("loads URL when MAIN_WINDOW_VITE_DEV_SERVER_URL is defined", () => {
      (globalThis as Record<string, unknown>)["MAIN_WINDOW_VITE_DEV_SERVER_URL"] =
        "http://localhost:5173";

      wm.openDialog("SettingsDialog");
      expect(mockChildLoad).toHaveBeenCalledWith(
        "http://localhost:5173?dialog=SettingsDialog"
      );

      (globalThis as Record<string, unknown>)["MAIN_WINDOW_VITE_DEV_SERVER_URL"] =
        undefined;
    });

    it("opens multiple distinct dialogs simultaneously", () => {
      wm.openDialog("SettingsDialog");
      wm.openDialog("StashDialog");
      expect(wm.getWindow("SettingsDialog")).toBeDefined();
      expect(wm.getWindow("StashDialog")).toBeDefined();
    });
  });

  // ── closeDialog ────────────────────────────────────────────────────────────

  describe("closeDialog", () => {
    it("calls close() on the tracked window", () => {
      const w = {
        id: 99,
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { send: vi.fn(), id: 99 },
      };
      wm.track("SettingsDialog", w as never);
      wm.closeDialog("SettingsDialog");
      expect(w.close).toHaveBeenCalledTimes(1);
    });

    it("does nothing for untracked dialog key", () => {
      expect(() => wm.closeDialog("NonExistentDialog")).not.toThrow();
    });
  });

  // ── closeAll ──────────────────────────────────────────────────────────────

  describe("closeAll", () => {
    it("closes all tracked windows", () => {
      const w1 = {
        id: 1,
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { send: vi.fn(), id: 1 },
      };
      const w2 = {
        id: 2,
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { send: vi.fn(), id: 2 },
      };
      wm.track("A", w1 as never);
      wm.track("B", w2 as never);

      wm.closeAll();

      expect(w1.close).toHaveBeenCalled();
      expect(w2.close).toHaveBeenCalled();
    });

    it("does not call close() on destroyed windows", () => {
      const w = {
        id: 5,
        isDestroyed: vi.fn(() => true),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { send: vi.fn(), id: 5 },
      };
      wm.track("SomeDialog", w as never);
      wm.closeAll();
      expect(w.close).not.toHaveBeenCalled();
    });

    it("is safe to call when no windows are tracked", () => {
      expect(() => wm.closeAll()).not.toThrow();
    });

    it("clears the windows map after close", () => {
      const w = {
        id: 3,
        isDestroyed: vi.fn(() => false),
        close: vi.fn(),
        focus: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        webContents: { send: vi.fn(), id: 3 },
      };
      wm.track("MergeConflictDialog", w as never);
      wm.closeAll();
      expect(wm["windows"].size).toBe(0);
    });
  });
});
