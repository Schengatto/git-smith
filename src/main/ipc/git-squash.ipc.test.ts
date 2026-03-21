import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetSquashPreview = vi.fn();
const mockSquashCommits = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getSquashPreview: (...args: unknown[]) => mockGetSquashPreview(...args),
    squashCommits: (...args: unknown[]) => mockSquashCommits(...args),
    // Stubs for other methods registered by registerBranchHandlers
    getBranches: vi.fn(),
    createBranch: vi.fn(),
    deleteBranch: vi.fn(),
    deleteRemoteBranch: vi.fn(),
    renameBranch: vi.fn(),
    checkout: vi.fn(),
    checkoutWithOptions: vi.fn(),
    merge: vi.fn(),
    mergeWithOptions: vi.fn(),
    rebase: vi.fn(),
    rebaseWithOptions: vi.fn(),
    getRebaseCommits: vi.fn(),
    interactiveRebase: vi.fn(),
    rebaseContinue: vi.fn(),
    rebaseSkip: vi.fn(),
    rebaseAbort: vi.fn(),
    isRebaseInProgress: vi.fn(),
    cherryPick: vi.fn(),
    cherryPickWithOptions: vi.fn(),
    revertCommit: vi.fn(),
    mergeAbort: vi.fn(),
    mergeContinue: vi.fn(),
    cherryPickAbort: vi.fn(),
    cherryPickContinue: vi.fn(),
    resetToCommit: vi.fn(),
    getStaleRemoteBranches: vi.fn(),
    getRemoteBranchCommits: vi.fn(),
    getTags: vi.fn(),
    createTag: vi.fn(),
    deleteTag: vi.fn(),
    deleteRemoteTag: vi.fn(),
    pushTag: vi.fn(),
  },
}));

import { ipcMain } from "electron";
import { registerBranchHandlers } from "./git-branch.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("squash IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers SQUASH_PREVIEW and SQUASH_EXECUTE channels", () => {
    registerBranchHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.BRANCH.SQUASH_PREVIEW);
    expect(channels).toContain(IPC.BRANCH.SQUASH_EXECUTE);
  });

  it("SQUASH_PREVIEW delegates to gitService.getSquashPreview", async () => {
    const fakeCommits = [
      { hash: "abc123", abbreviatedHash: "abc123", subject: "feat: something", body: "", authorName: "Test", authorEmail: "test@test.com", authorDate: "", committerDate: "", parentHashes: [], refs: [] },
    ];
    mockGetSquashPreview.mockResolvedValueOnce(fakeCommits);

    registerBranchHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BRANCH.SQUASH_PREVIEW);
    expect(call).toBeDefined();
    const handler = call![1];

    const result = await handler({}, "target123");
    expect(mockGetSquashPreview).toHaveBeenCalledWith("target123");
    expect(result).toEqual(fakeCommits);
  });

  it("SQUASH_EXECUTE delegates to gitService.squashCommits", async () => {
    mockSquashCommits.mockResolvedValueOnce(undefined);

    registerBranchHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BRANCH.SQUASH_EXECUTE);
    expect(call).toBeDefined();
    const handler = call![1];

    const options = { targetHash: "abc123", message: "squashed commit" };
    await handler({}, options);
    expect(mockSquashCommits).toHaveBeenCalledWith(options);
  });
});
