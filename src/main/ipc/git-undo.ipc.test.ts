import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetUndoHistory = vi.fn();
const mockUndoToReflog = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: {
    getUndoHistory: (...args: unknown[]) => mockGetUndoHistory(...args),
    undoToReflog: (...args: unknown[]) => mockUndoToReflog(...args),
  },
}));

import { ipcMain } from "electron";
import { registerUndoHandlers } from "./git-undo.ipc";

function getHandler(channel: string) {
  const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call![1];
}

describe("git-undo IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerUndoHandlers();
  });

  it("registers history and revert handlers", () => {
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain("git:undo:history");
    expect(channels).toContain("git:undo:revert");
  });

  it("calls getUndoHistory with maxCount", async () => {
    mockGetUndoHistory.mockResolvedValue([]);
    const handler = getHandler("git:undo:history");
    await handler(null, 10);
    expect(mockGetUndoHistory).toHaveBeenCalledWith(10);
  });

  it("calls undoToReflog with index", async () => {
    mockUndoToReflog.mockResolvedValue(undefined);
    const handler = getHandler("git:undo:revert");
    await handler(null, 3);
    expect(mockUndoToReflog).toHaveBeenCalledWith(3);
  });
});
