import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as NodePty from "node-pty";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

const mockGetRepoPath = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: (...args: unknown[]) => mockGetRepoPath(...args),
  },
}));

import { ipcMain, BrowserWindow } from "electron";
import { registerTerminalHandlers, _setPtyForTesting } from "./terminal.ipc";
import { IPC } from "../../shared/ipc-channels";

// Provide a mock pty object instead of trying to mock the native "node-pty" module
const mockPty = {
  spawn: vi.fn(() => ({
    pid: 99999,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
};
_setPtyForTesting(mockPty as unknown as typeof NodePty);

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("terminal IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerTerminalHandlers();
  });

  it("registers all TERMINAL channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.TERMINAL.SPAWN);
    expect(channels).toContain(IPC.TERMINAL.INPUT);
    expect(channels).toContain(IPC.TERMINAL.RESIZE);
    expect(channels).toContain(IPC.TERMINAL.KILL);
  });

  it("TERMINAL.SPAWN spawns a pty process and returns its pid", () => {
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: vi.fn() },
    };
    (BrowserWindow.fromWebContents as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockWin);
    mockGetRepoPath.mockReturnValueOnce("/home/user/repo");
    const handler = getHandler(IPC.TERMINAL.SPAWN);
    const fakeEvent = { sender: {} };
    const pid = handler(fakeEvent, 80, 24);
    expect(typeof pid).toBe("number");
  });

  it("TERMINAL.INPUT does nothing when no active pty", () => {
    const handler = getHandler(IPC.TERMINAL.INPUT);
    // Should not throw
    expect(() => handler({}, "ls\n")).not.toThrow();
  });

  it("TERMINAL.RESIZE does nothing when no active pty", () => {
    const handler = getHandler(IPC.TERMINAL.RESIZE);
    // Should not throw
    expect(() => handler({}, 120, 30)).not.toThrow();
  });

  it("TERMINAL.KILL does nothing when no active pty", () => {
    const handler = getHandler(IPC.TERMINAL.KILL);
    // Should not throw
    expect(() => handler({})).not.toThrow();
  });
});
