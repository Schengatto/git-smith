import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockLogRange = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: { logRange: (...args: unknown[]) => mockLogRange(...args) },
}));

import { ipcMain } from "electron";
import { registerLogRangeHandlers } from "./git-log-range.ipc";

describe("git-log-range IPC handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerLogRangeHandlers();
  });

  it("registers the compare handler", () => {
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain("git:log:range");
  });

  it("calls gitService.logRange with from and to", async () => {
    mockLogRange.mockResolvedValue([]);
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:log:range");
    const handler = call![1];
    await handler(null, "main", "feature");
    expect(mockLogRange).toHaveBeenCalledWith("main", "feature");
  });

  it("returns commit list", async () => {
    const commits = [{ hash: "abc123", subject: "test" }];
    mockLogRange.mockResolvedValue(commits);
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:log:range");
    const handler = call![1];
    const res = await handler(null, "main", "feature");
    expect(res).toEqual(commits);
  });
});
