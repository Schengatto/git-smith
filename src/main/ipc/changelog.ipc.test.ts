import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetTagsBefore = vi.fn();
const mockGetChangelogCommits = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getTagsBefore: (...args: unknown[]) => mockGetTagsBefore(...args),
    getChangelogCommits: (...args: unknown[]) => mockGetChangelogCommits(...args),
  },
}));

const mockParseChangelog = vi.fn();

vi.mock("../git/changelog-parser", () => ({
  parseChangelog: (...args: unknown[]) => mockParseChangelog(...args),
}));

import { ipcMain } from "electron";
import { registerChangelogHandlers } from "./changelog.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("changelog IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerChangelogHandlers();
  });

  it("registers all CHANGELOG channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.CHANGELOG.TAGS_BEFORE);
    expect(channels).toContain(IPC.CHANGELOG.GENERATE);
  });

  it("CHANGELOG.TAGS_BEFORE calls gitService.getTagsBefore with hash", async () => {
    const fakeTags = ["v1.0.0", "v0.9.0"];
    mockGetTagsBefore.mockResolvedValueOnce(fakeTags);
    const handler = getHandler(IPC.CHANGELOG.TAGS_BEFORE);
    const result = await handler({}, "abc123");
    expect(mockGetTagsBefore).toHaveBeenCalledWith("abc123");
    expect(result).toBe(fakeTags);
  });

  it("CHANGELOG.GENERATE calls getChangelogCommits, parses result and returns it", async () => {
    const entries = [{ hash: "abc", message: "feat: new feature" }];
    const parsed = { title: "Changelog v1.0.0", sections: [] };
    mockGetChangelogCommits.mockResolvedValueOnce(entries);
    mockParseChangelog.mockReturnValueOnce(parsed);
    const handler = getHandler(IPC.CHANGELOG.GENERATE);
    const result = await handler({}, "v0.9.0", "v1.0.0");
    expect(mockGetChangelogCommits).toHaveBeenCalledWith("v0.9.0", "v1.0.0");
    expect(mockParseChangelog).toHaveBeenCalledWith(entries, "v0.9.0", "v1.0.0");
    expect(result).toBe(parsed);
  });
});
