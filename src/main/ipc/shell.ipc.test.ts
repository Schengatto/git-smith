import { describe, it, expect, vi, beforeEach } from "vitest";
import type pathModule from "path";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: {
    isPackaged: false,
    getAppPath: vi.fn().mockReturnValue("/app"),
  },
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

const mockGetRepoPath = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: (...args: unknown[]) => mockGetRepoPath(...args),
  },
}));

vi.mock("path", async () => {
  const actual = await vi.importActual<typeof pathModule>("path");
  return actual;
});

import path from "path";
import { ipcMain, shell } from "electron";
import { registerShellHandlers } from "./shell.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("shell IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerShellHandlers();
  });

  it("registers APP.OPEN_USER_MANUAL, SHELL.OPEN_FILE, and SHELL.SHOW_IN_FOLDER", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.APP.OPEN_USER_MANUAL);
    expect(channels).toContain(IPC.SHELL.OPEN_FILE);
    expect(channels).toContain(IPC.SHELL.SHOW_IN_FOLDER);
  });

  it("APP.OPEN_USER_MANUAL calls shell.openPath with the user manual path", async () => {
    const mockShell = shell as unknown as { openPath: ReturnType<typeof vi.fn> };
    mockShell.openPath.mockResolvedValueOnce("");
    const handler = getHandler(IPC.APP.OPEN_USER_MANUAL);
    await handler({});
    expect(mockShell.openPath).toHaveBeenCalled();
    const calledPath = mockShell.openPath.mock.calls[0]![0] as string;
    expect(calledPath).toContain("USER_MANUAL.md");
  });

  it("SHELL.OPEN_FILE throws when no repo is open", async () => {
    mockGetRepoPath.mockReturnValueOnce(null);
    const handler = getHandler(IPC.SHELL.OPEN_FILE);
    await expect(handler({}, "src/index.ts")).rejects.toThrow("No repository open");
  });

  it("SHELL.OPEN_FILE calls shell.openPath with resolved absolute path", async () => {
    mockGetRepoPath.mockReturnValueOnce("/home/user/repo");
    const mockShell = shell as unknown as { openPath: ReturnType<typeof vi.fn> };
    mockShell.openPath.mockResolvedValueOnce("");
    const handler = getHandler(IPC.SHELL.OPEN_FILE);
    await handler({}, "src/index.ts");
    expect(mockShell.openPath).toHaveBeenCalledWith(
      path.resolve("/home/user/repo", "src/index.ts")
    );
  });

  it("SHELL.SHOW_IN_FOLDER throws when no repo is open", async () => {
    mockGetRepoPath.mockReturnValueOnce(null);
    const handler = getHandler(IPC.SHELL.SHOW_IN_FOLDER);
    await expect(handler({}, "src/index.ts")).rejects.toThrow("No repository open");
  });

  it("SHELL.SHOW_IN_FOLDER calls shell.showItemInFolder with resolved path", async () => {
    mockGetRepoPath.mockReturnValueOnce("/home/user/repo");
    const mockShell = shell as unknown as { showItemInFolder: ReturnType<typeof vi.fn> };
    const handler = getHandler(IPC.SHELL.SHOW_IN_FOLDER);
    await handler({}, "src/utils.ts");
    expect(mockShell.showItemInFolder).toHaveBeenCalledWith(
      path.resolve("/home/user/repo", "src/utils.ts")
    );
  });
});
