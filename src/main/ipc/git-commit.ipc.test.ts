import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockCommit = vi.fn();
const mockAmend = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    commit: (...args: unknown[]) => mockCommit(...args),
    amend: (...args: unknown[]) => mockAmend(...args),
  },
}));

const mockGetRecentCommitMessages = vi.fn();
const mockAddRecentCommitMessage = vi.fn();

vi.mock("../store", () => ({
  getRecentCommitMessages: (...args: unknown[]) => mockGetRecentCommitMessages(...args),
  addRecentCommitMessage: (...args: unknown[]) => mockAddRecentCommitMessage(...args),
}));

import { ipcMain } from "electron";
import { registerCommitHandlers } from "./git-commit.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-commit IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerCommitHandlers();
  });

  it("registers all COMMIT channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.COMMIT.CREATE);
    expect(channels).toContain(IPC.COMMIT.AMEND);
    expect(channels).toContain(IPC.COMMIT.GET_RECENT_MESSAGES);
  });

  it("COMMIT.CREATE calls gitService.commit and records the message", async () => {
    const fakeResult = { hash: "abc123" };
    mockCommit.mockResolvedValueOnce(fakeResult);
    const handler = getHandler(IPC.COMMIT.CREATE);
    const result = await handler({}, "feat: add something");
    expect(mockCommit).toHaveBeenCalledWith("feat: add something");
    expect(mockAddRecentCommitMessage).toHaveBeenCalledWith("feat: add something");
    expect(result).toBe(fakeResult);
  });

  it("COMMIT.AMEND calls gitService.amend with message and records it", async () => {
    const fakeResult = { hash: "def456" };
    mockAmend.mockResolvedValueOnce(fakeResult);
    const handler = getHandler(IPC.COMMIT.AMEND);
    const result = await handler({}, "fix: corrected typo");
    expect(mockAmend).toHaveBeenCalledWith("fix: corrected typo");
    expect(mockAddRecentCommitMessage).toHaveBeenCalledWith("fix: corrected typo");
    expect(result).toBe(fakeResult);
  });

  it("COMMIT.AMEND without message does not record anything", async () => {
    const fakeResult = { hash: "ghi789" };
    mockAmend.mockResolvedValueOnce(fakeResult);
    const handler = getHandler(IPC.COMMIT.AMEND);
    const result = await handler({}, undefined);
    expect(mockAmend).toHaveBeenCalledWith(undefined);
    expect(mockAddRecentCommitMessage).not.toHaveBeenCalled();
    expect(result).toBe(fakeResult);
  });

  it("COMMIT.GET_RECENT_MESSAGES returns getRecentCommitMessages()", async () => {
    const messages = ["feat: a", "fix: b"];
    mockGetRecentCommitMessages.mockReturnValueOnce(messages);
    const handler = getHandler(IPC.COMMIT.GET_RECENT_MESSAGES);
    const result = await handler({});
    expect(mockGetRecentCommitMessages).toHaveBeenCalled();
    expect(result).toBe(messages);
  });
});
