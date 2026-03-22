import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const { mockWindowManager, mockGetMainWindow } = vi.hoisted(() => ({
  mockWindowManager: {
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    getInitData: vi.fn(),
    markResultSent: vi.fn(),
  },
  mockGetMainWindow: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock("../window-manager", () => ({
  windowManager: mockWindowManager,
}));

vi.mock("../index", () => ({
  getMainWindow: mockGetMainWindow,
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { BrowserWindow, ipcMain } from "electron";
import { registerDialogHandlers } from "./dialog.ipc";
import { IPC } from "../../shared/ipc-channels";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandleHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`handle() not registered for "${channel}"`);
  return call[1] as (...args: unknown[]) => unknown;
}

function getOnHandler(channel: string) {
  const m = vi.mocked(ipcMain.on);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`on() not registered for "${channel}"`);
  return call[1] as (...args: unknown[]) => void;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("dialog IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDialogHandlers();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe("channel registration", () => {
    it("registers DIALOG.OPEN via ipcMain.handle", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.DIALOG.OPEN);
    });

    it("registers DIALOG.CLOSE via ipcMain.handle", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.DIALOG.CLOSE);
    });

    it("registers DIALOG.GET_INIT_DATA via ipcMain.handle", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.DIALOG.GET_INIT_DATA);
    });

    it("registers DIALOG.RESULT via ipcMain.on", () => {
      const channels = vi.mocked(ipcMain.on).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.DIALOG.RESULT);
    });
  });

  // ── DIALOG.OPEN ───────────────────────────────────────────────────────────

  describe("DIALOG.OPEN handler", () => {
    it("calls windowManager.openDialog and returns windowId", () => {
      const fakeWin = { id: 42 };
      mockWindowManager.openDialog.mockReturnValue(fakeWin);

      const handler = getHandleHandler(IPC.DIALOG.OPEN);
      const result = handler(
        {},
        {
          dialog: "SettingsDialog",
          data: { tab: "general" },
        }
      ) as { windowId: number };

      expect(mockWindowManager.openDialog).toHaveBeenCalledWith("SettingsDialog", {
        tab: "general",
      });
      expect(result.windowId).toBe(42);
    });

    it("passes undefined data when not provided", () => {
      const fakeWin = { id: 10 };
      mockWindowManager.openDialog.mockReturnValue(fakeWin);

      const handler = getHandleHandler(IPC.DIALOG.OPEN);
      handler({}, { dialog: "StashDialog" });

      expect(mockWindowManager.openDialog).toHaveBeenCalledWith("StashDialog", undefined);
    });

    it("returns correct windowId for different dialogs", () => {
      const fakeWin = { id: 99 };
      mockWindowManager.openDialog.mockReturnValue(fakeWin);

      const handler = getHandleHandler(IPC.DIALOG.OPEN);
      const result = handler(
        {},
        { dialog: "CommitInfoWindow", data: { commitHash: "abc123" } }
      ) as { windowId: number };

      expect(result.windowId).toBe(99);
      expect(mockWindowManager.openDialog).toHaveBeenCalledWith("CommitInfoWindow", {
        commitHash: "abc123",
      });
    });
  });

  // ── DIALOG.CLOSE ──────────────────────────────────────────────────────────

  describe("DIALOG.CLOSE handler", () => {
    it("calls windowManager.closeDialog with dialogKey", () => {
      const handler = getHandleHandler(IPC.DIALOG.CLOSE);
      handler({}, "SettingsDialog");

      expect(mockWindowManager.closeDialog).toHaveBeenCalledWith("SettingsDialog");
    });

    it("calls windowManager.closeDialog with commit hash key", () => {
      const handler = getHandleHandler(IPC.DIALOG.CLOSE);
      handler({}, "CommitInfoWindow:abc123");

      expect(mockWindowManager.closeDialog).toHaveBeenCalledWith("CommitInfoWindow:abc123");
    });

    it("returns undefined", () => {
      const handler = getHandleHandler(IPC.DIALOG.CLOSE);
      const result = handler({}, "SomeDialog");
      expect(result).toBeUndefined();
    });
  });

  // ── DIALOG.GET_INIT_DATA ──────────────────────────────────────────────────

  describe("DIALOG.GET_INIT_DATA handler", () => {
    it("returns init data for the window that sent the event", () => {
      const fakeWin = { id: 5 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(fakeWin as never);
      mockWindowManager.getInitData.mockReturnValue({ commitHash: "deadbeef" });

      const handler = getHandleHandler(IPC.DIALOG.GET_INIT_DATA);
      const fakeEvent = { sender: {} };
      const result = handler(fakeEvent);

      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(fakeEvent.sender);
      expect(mockWindowManager.getInitData).toHaveBeenCalledWith(5);
      expect(result).toEqual({ commitHash: "deadbeef" });
    });

    it("returns undefined when BrowserWindow.fromWebContents returns null", () => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null as never);

      const handler = getHandleHandler(IPC.DIALOG.GET_INIT_DATA);
      const result = handler({ sender: {} });

      expect(mockWindowManager.getInitData).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("returns undefined when no init data stored for window", () => {
      const fakeWin = { id: 7 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(fakeWin as never);
      mockWindowManager.getInitData.mockReturnValue(undefined);

      const handler = getHandleHandler(IPC.DIALOG.GET_INIT_DATA);
      const result = handler({ sender: {} });

      expect(result).toBeUndefined();
    });
  });

  // ── DIALOG.RESULT ─────────────────────────────────────────────────────────

  describe("DIALOG.RESULT handler (ipcMain.on)", () => {
    it("marks result sent and forwards result to main window", () => {
      const mockSendFn = vi.fn();
      const mainWin = {
        webContents: { send: mockSendFn },
        isDestroyed: () => false,
      };
      mockGetMainWindow.mockReturnValue(mainWin);

      const childWin = { id: 11 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(childWin as never);

      const handler = getOnHandler(IPC.DIALOG.RESULT);
      const resultPayload = {
        dialogName: "SettingsDialog",
        action: "resolved",
        data: { saved: true },
      };
      handler({ sender: {} }, resultPayload);

      expect(mockWindowManager.markResultSent).toHaveBeenCalledWith(11);
      expect(mockSendFn).toHaveBeenCalledWith(IPC.DIALOG.ON_RESULT, resultPayload);
    });

    it("does not mark result sent when fromWebContents returns null", () => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null as never);
      const mockSendFn = vi.fn();
      mockGetMainWindow.mockReturnValue({
        webContents: { send: mockSendFn },
        isDestroyed: () => false,
      });

      const handler = getOnHandler(IPC.DIALOG.RESULT);
      handler({ sender: {} }, { dialogName: "StashDialog", action: "cancelled" });

      expect(mockWindowManager.markResultSent).not.toHaveBeenCalled();
      expect(mockSendFn).toHaveBeenCalled();
    });

    it("does not forward result when mainWindow is null", () => {
      const childWin = { id: 22 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(childWin as never);
      mockGetMainWindow.mockReturnValue(null);

      const handler = getOnHandler(IPC.DIALOG.RESULT);
      handler({ sender: {} }, { dialogName: "StashDialog", action: "cancelled" });

      expect(mockWindowManager.markResultSent).toHaveBeenCalledWith(22);
    });

    it("does not forward result when mainWindow is destroyed", () => {
      const childWin = { id: 33 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(childWin as never);
      const mockSendFn = vi.fn();
      mockGetMainWindow.mockReturnValue({
        webContents: { send: mockSendFn },
        isDestroyed: () => true,
      });

      const handler = getOnHandler(IPC.DIALOG.RESULT);
      handler({ sender: {} }, { dialogName: "ChangelogDialog", action: "closed" });

      expect(mockSendFn).not.toHaveBeenCalled();
    });

    it("forwards any result action to main window", () => {
      const mockSendFn = vi.fn();
      mockGetMainWindow.mockReturnValue({
        webContents: { send: mockSendFn },
        isDestroyed: () => false,
      });
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue({ id: 55 } as never);

      const handler = getOnHandler(IPC.DIALOG.RESULT);
      const payload = {
        dialogName: "InteractiveRebaseDialog",
        action: "navigate",
        data: { step: 2 },
      };
      handler({ sender: {} }, payload);

      expect(mockSendFn).toHaveBeenCalledWith(IPC.DIALOG.ON_RESULT, payload);
    });
  });
});
