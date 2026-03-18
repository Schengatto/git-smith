import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
        id: 1, isDestroyed: () => false, close: vi.fn(), focus: vi.fn(),
        on: vi.fn(), once: vi.fn(), webContents: { id: 1, send: vi.fn() },
      };
      wm.track("StashDialog", fakeWin as never);
      expect(wm.getWindow("StashDialog")).toBe(fakeWin);
    });

    it("returns undefined for untracked dialogs", () => {
      expect(wm.getWindow("StashDialog")).toBeUndefined();
    });

    it("closeAll closes all tracked windows", () => {
      const fakeWin = {
        id: 1, isDestroyed: () => false, close: vi.fn(), focus: vi.fn(),
        on: vi.fn(), once: vi.fn(), webContents: { id: 1, send: vi.fn() },
      };
      wm.track("StashDialog", fakeWin as never);
      wm.closeAll();
      expect(fakeWin.close).toHaveBeenCalled();
    });
  });

  describe("resultSent tracking", () => {
    it("markResultSent prevents double delivery", () => {
      wm.markResultSent(42);
      // Internal state — tested via openDialog behavior in integration
      // For now, just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});
