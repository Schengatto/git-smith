import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
}));

const mockGetLeaderboard = vi.fn();
const mockGetAuthorDetail = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
    getAuthorDetail: (...args: unknown[]) => mockGetAuthorDetail(...args),
  },
}));

import { ipcMain } from "electron";
import { registerStatsHandlers } from "./stats.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("registerStatsHandlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers the LEADERBOARD handler on the correct channel", () => {
    registerStatsHandlers();
    const channels = handleMock.mock.calls.map((c) => c[0]);
    expect(channels).toContain(IPC.STATS.LEADERBOARD);
  });

  it("registers the AUTHOR_DETAIL handler on the correct channel", () => {
    registerStatsHandlers();
    const channels = handleMock.mock.calls.map((c) => c[0]);
    expect(channels).toContain(IPC.STATS.AUTHOR_DETAIL);
  });

  it("LEADERBOARD handler delegates to gitService.getLeaderboard", async () => {
    const fakeResult = [{ authorName: "Alice", rank: 1 }];
    mockGetLeaderboard.mockResolvedValueOnce(fakeResult);

    registerStatsHandlers();

    const leaderboardCall = handleMock.mock.calls.find((c) => c[0] === IPC.STATS.LEADERBOARD);
    expect(leaderboardCall).toBeDefined();
    const handler = leaderboardCall![1];

    const result = await handler({} /* event */, "month");
    expect(mockGetLeaderboard).toHaveBeenCalledWith("month");
    expect(result).toEqual(fakeResult);
  });

  it("AUTHOR_DETAIL handler delegates to gitService.getAuthorDetail", async () => {
    const fakeResult = { authorName: "Alice", authorEmail: "alice@example.com", commits: 5 };
    mockGetAuthorDetail.mockResolvedValueOnce(fakeResult);

    registerStatsHandlers();

    const detailCall = handleMock.mock.calls.find((c) => c[0] === IPC.STATS.AUTHOR_DETAIL);
    expect(detailCall).toBeDefined();
    const handler = detailCall![1];

    const result = await handler({} /* event */, "alice@example.com", "week");
    expect(mockGetAuthorDetail).toHaveBeenCalledWith("alice@example.com", "week");
    expect(result).toEqual(fakeResult);
  });
});
