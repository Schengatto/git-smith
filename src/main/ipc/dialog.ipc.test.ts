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
    markResultSent: vi.fn(),
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
