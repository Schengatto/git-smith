import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetReflog = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getReflog: (...args: unknown[]) => mockGetReflog(...args),
  },
}));

import { ipcMain } from "electron";
import { registerReflogHandlers } from "./git-reflog.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("registerReflogHandlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers the REFLOG.LIST handler on the correct channel", () => {
    registerReflogHandlers();
    const channels = handleMock.mock.calls.map((c) => c[0]);
    expect(channels).toContain(IPC.REFLOG.LIST);
  });

  it("REFLOG.LIST handler delegates to gitService.getReflog", async () => {
    const fakeResult = [
      {
        hash: "abc123full",
        abbreviatedHash: "abc123f",
        selector: "HEAD@{0}",
        action: "commit",
        subject: "feat: add feature",
        date: "2026-03-21 10:00:00 +0100",
      },
    ];
    mockGetReflog.mockResolvedValueOnce(fakeResult);

    registerReflogHandlers();

    const listCall = handleMock.mock.calls.find(
      (c) => c[0] === IPC.REFLOG.LIST
    );
    expect(listCall).toBeDefined();
    const handler = listCall![1];

    const result = await handler({} /* event */, 50);
    expect(mockGetReflog).toHaveBeenCalledWith(50);
    expect(result).toEqual(fakeResult);
  });

  it("REFLOG.LIST handler passes undefined when maxCount is not provided", async () => {
    mockGetReflog.mockResolvedValueOnce([]);

    registerReflogHandlers();

    const listCall = handleMock.mock.calls.find(
      (c) => c[0] === IPC.REFLOG.LIST
    );
    const handler = listCall![1];

    await handler({} /* event */);
    expect(mockGetReflog).toHaveBeenCalledWith(undefined);
  });
});
