import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockKillCurrentOperation = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    killCurrentOperation: (...args: unknown[]) => mockKillCurrentOperation(...args),
  },
}));

import { ipcMain } from "electron";
import { registerOperationHandlers } from "./git-operation.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-operation IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerOperationHandlers();
  });

  it("registers the OPERATION.CANCEL channel", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.OPERATION.CANCEL);
  });

  it("OPERATION.CANCEL calls gitService.killCurrentOperation", () => {
    const handler = getHandler(IPC.OPERATION.CANCEL);
    handler({});
    expect(mockKillCurrentOperation).toHaveBeenCalled();
  });
});
