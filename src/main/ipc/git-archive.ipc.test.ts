import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockArchive = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    archive: (...args: unknown[]) => mockArchive(...args),
  },
}));

import { ipcMain } from "electron";
import { registerArchiveHandlers } from "./git-archive.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("archive IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers ARCHIVE.EXPORT channel", () => {
    registerArchiveHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.ARCHIVE.EXPORT);
  });

  it("ARCHIVE.EXPORT delegates to gitService.archive", async () => {
    mockArchive.mockResolvedValueOnce(undefined);
    registerArchiveHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.ARCHIVE.EXPORT);
    const handler = call![1];

    await handler({}, "abc123", "/tmp/out.zip", "zip");
    expect(mockArchive).toHaveBeenCalledWith("abc123", "/tmp/out.zip", "zip");
  });
});
