import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockDiffBranches = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: { diffBranches: (...args: unknown[]) => mockDiffBranches(...args) },
}));

import { ipcMain } from "electron";
import { registerDiffBranchesHandlers } from "./git-diff-branches.ipc";

describe("git-diff-branches IPC handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDiffBranchesHandlers();
  });

  it("registers the compare handler", () => {
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain("git:diff:branches");
  });

  it("calls gitService.diffBranches with from and to", async () => {
    const result = { files: [], stats: { additions: 0, deletions: 0, filesChanged: 0 } };
    mockDiffBranches.mockResolvedValue(result);
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:diff:branches");
    const handler = call![1];
    const res = await handler(null, "main", "feature");
    expect(mockDiffBranches).toHaveBeenCalledWith("main", "feature");
    expect(res).toEqual(result);
  });
});
