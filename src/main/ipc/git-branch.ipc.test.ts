import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetBranches = vi.fn();
const mockCreateBranch = vi.fn();
const mockDeleteBranch = vi.fn();
const mockDeleteRemoteBranch = vi.fn();
const mockRenameBranch = vi.fn();
const mockCheckout = vi.fn();
const mockCheckoutWithOptions = vi.fn();
const mockMerge = vi.fn();
const mockMergeWithOptions = vi.fn();
const mockRebase = vi.fn();
const mockRebaseWithOptions = vi.fn();
const mockGetRebaseCommits = vi.fn();
const mockInteractiveRebase = vi.fn();
const mockRebaseContinue = vi.fn();
const mockRebaseSkip = vi.fn();
const mockRebaseAbort = vi.fn();
const mockIsRebaseInProgress = vi.fn();
const mockCherryPick = vi.fn();
const mockCherryPickWithOptions = vi.fn();
const mockRevertCommit = vi.fn();
const mockMergeAbort = vi.fn();
const mockMergeContinue = vi.fn();
const mockCherryPickAbort = vi.fn();
const mockCherryPickContinue = vi.fn();
const mockResetToCommit = vi.fn();
const mockGetSquashPreview = vi.fn();
const mockSquashCommits = vi.fn();
const mockGetStaleRemoteBranches = vi.fn();
const mockGetRemoteBranchCommits = vi.fn();
const mockGetTags = vi.fn();
const mockCreateTag = vi.fn();
const mockDeleteTag = vi.fn();
const mockDeleteRemoteTag = vi.fn();
const mockPushTag = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getBranches: (...args: unknown[]) => mockGetBranches(...args),
    createBranch: (...args: unknown[]) => mockCreateBranch(...args),
    deleteBranch: (...args: unknown[]) => mockDeleteBranch(...args),
    deleteRemoteBranch: (...args: unknown[]) => mockDeleteRemoteBranch(...args),
    renameBranch: (...args: unknown[]) => mockRenameBranch(...args),
    checkout: (...args: unknown[]) => mockCheckout(...args),
    checkoutWithOptions: (...args: unknown[]) => mockCheckoutWithOptions(...args),
    merge: (...args: unknown[]) => mockMerge(...args),
    mergeWithOptions: (...args: unknown[]) => mockMergeWithOptions(...args),
    rebase: (...args: unknown[]) => mockRebase(...args),
    rebaseWithOptions: (...args: unknown[]) => mockRebaseWithOptions(...args),
    getRebaseCommits: (...args: unknown[]) => mockGetRebaseCommits(...args),
    interactiveRebase: (...args: unknown[]) => mockInteractiveRebase(...args),
    rebaseContinue: (...args: unknown[]) => mockRebaseContinue(...args),
    rebaseSkip: (...args: unknown[]) => mockRebaseSkip(...args),
    rebaseAbort: (...args: unknown[]) => mockRebaseAbort(...args),
    isRebaseInProgress: (...args: unknown[]) => mockIsRebaseInProgress(...args),
    cherryPick: (...args: unknown[]) => mockCherryPick(...args),
    cherryPickWithOptions: (...args: unknown[]) => mockCherryPickWithOptions(...args),
    revertCommit: (...args: unknown[]) => mockRevertCommit(...args),
    mergeAbort: (...args: unknown[]) => mockMergeAbort(...args),
    mergeContinue: (...args: unknown[]) => mockMergeContinue(...args),
    cherryPickAbort: (...args: unknown[]) => mockCherryPickAbort(...args),
    cherryPickContinue: (...args: unknown[]) => mockCherryPickContinue(...args),
    resetToCommit: (...args: unknown[]) => mockResetToCommit(...args),
    getSquashPreview: (...args: unknown[]) => mockGetSquashPreview(...args),
    squashCommits: (...args: unknown[]) => mockSquashCommits(...args),
    getStaleRemoteBranches: (...args: unknown[]) => mockGetStaleRemoteBranches(...args),
    getRemoteBranchCommits: (...args: unknown[]) => mockGetRemoteBranchCommits(...args),
    getTags: (...args: unknown[]) => mockGetTags(...args),
    createTag: (...args: unknown[]) => mockCreateTag(...args),
    deleteTag: (...args: unknown[]) => mockDeleteTag(...args),
    deleteRemoteTag: (...args: unknown[]) => mockDeleteRemoteTag(...args),
    pushTag: (...args: unknown[]) => mockPushTag(...args),
  },
}));

import { ipcMain } from "electron";
import { registerBranchHandlers } from "./git-branch.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("git-branch IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    registerBranchHandlers();
  });

  it("registers all BRANCH channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.BRANCH.LIST);
    expect(channels).toContain(IPC.BRANCH.CREATE);
    expect(channels).toContain(IPC.BRANCH.DELETE);
    expect(channels).toContain(IPC.BRANCH.DELETE_REMOTE);
    expect(channels).toContain(IPC.BRANCH.RENAME);
    expect(channels).toContain(IPC.BRANCH.CHECKOUT);
    expect(channels).toContain(IPC.BRANCH.CHECKOUT_OPTIONS);
    expect(channels).toContain(IPC.BRANCH.MERGE);
    expect(channels).toContain(IPC.BRANCH.MERGE_OPTIONS);
    expect(channels).toContain(IPC.BRANCH.REBASE);
    expect(channels).toContain(IPC.BRANCH.REBASE_INTERACTIVE);
    expect(channels).toContain(IPC.BRANCH.REBASE_CONTINUE);
    expect(channels).toContain(IPC.BRANCH.REBASE_SKIP);
    expect(channels).toContain(IPC.BRANCH.REBASE_ABORT);
    expect(channels).toContain(IPC.BRANCH.REBASE_IN_PROGRESS);
    expect(channels).toContain(IPC.BRANCH.CHERRY_PICK);
    expect(channels).toContain(IPC.BRANCH.REVERT);
    expect(channels).toContain(IPC.BRANCH.MERGE_ABORT);
    expect(channels).toContain(IPC.BRANCH.MERGE_CONTINUE);
    expect(channels).toContain(IPC.BRANCH.CHERRY_PICK_ABORT);
    expect(channels).toContain(IPC.BRANCH.CHERRY_PICK_CONTINUE);
    expect(channels).toContain(IPC.BRANCH.RESET);
    expect(channels).toContain(IPC.BRANCH.SQUASH_PREVIEW);
    expect(channels).toContain(IPC.BRANCH.SQUASH_EXECUTE);
    expect(channels).toContain(IPC.BRANCH.STALE_REMOTE);
    expect(channels).toContain(IPC.BRANCH.REMOTE_COMMITS);
  });

  it("registers all TAG channels", () => {
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.TAG.LIST);
    expect(channels).toContain(IPC.TAG.CREATE);
    expect(channels).toContain(IPC.TAG.DELETE);
    expect(channels).toContain(IPC.TAG.DELETE_REMOTE);
    expect(channels).toContain(IPC.TAG.PUSH);
  });

  it("BRANCH.LIST returns gitService.getBranches()", async () => {
    const fakeBranches = [{ name: "main", current: true }];
    mockGetBranches.mockResolvedValueOnce(fakeBranches);
    const result = await getHandler(IPC.BRANCH.LIST)({});
    expect(mockGetBranches).toHaveBeenCalled();
    expect(result).toBe(fakeBranches);
  });

  it("BRANCH.CREATE calls createBranch with name and startPoint", async () => {
    mockCreateBranch.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CREATE)({}, "feature/x", "main");
    expect(mockCreateBranch).toHaveBeenCalledWith("feature/x", "main");
  });

  it("BRANCH.DELETE calls deleteBranch with name and force flag", async () => {
    mockDeleteBranch.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.DELETE)({}, "old-branch", true);
    expect(mockDeleteBranch).toHaveBeenCalledWith("old-branch", true);
  });

  it("BRANCH.DELETE_REMOTE calls deleteRemoteBranch", async () => {
    mockDeleteRemoteBranch.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.DELETE_REMOTE)({}, "origin", "feature/x");
    expect(mockDeleteRemoteBranch).toHaveBeenCalledWith("origin", "feature/x");
  });

  it("BRANCH.RENAME calls renameBranch with old and new name", async () => {
    mockRenameBranch.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.RENAME)({}, "old", "new");
    expect(mockRenameBranch).toHaveBeenCalledWith("old", "new");
  });

  it("BRANCH.CHECKOUT calls checkout with ref", async () => {
    mockCheckout.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHECKOUT)({}, "main");
    expect(mockCheckout).toHaveBeenCalledWith("main");
  });

  it("BRANCH.CHECKOUT_OPTIONS calls checkoutWithOptions", async () => {
    mockCheckoutWithOptions.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHECKOUT_OPTIONS)({}, "feature/y", { merge: true });
    expect(mockCheckoutWithOptions).toHaveBeenCalledWith("feature/y", { merge: true });
  });

  it("BRANCH.MERGE calls merge and returns result", async () => {
    const mergeResult = { conflicts: [] };
    mockMerge.mockResolvedValueOnce(mergeResult);
    const result = await getHandler(IPC.BRANCH.MERGE)({}, "develop");
    expect(mockMerge).toHaveBeenCalledWith("develop");
    expect(result).toBe(mergeResult);
  });

  it("BRANCH.MERGE_OPTIONS calls mergeWithOptions and returns result", async () => {
    const opts = { branch: "develop", noFF: true };
    const mergeResult = { conflicts: [] };
    mockMergeWithOptions.mockResolvedValueOnce(mergeResult);
    const result = await getHandler(IPC.BRANCH.MERGE_OPTIONS)({}, opts);
    expect(mockMergeWithOptions).toHaveBeenCalledWith(opts);
    expect(result).toBe(mergeResult);
  });

  it("BRANCH.REBASE calls rebase with onto", async () => {
    mockRebase.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.REBASE)({}, "main");
    expect(mockRebase).toHaveBeenCalledWith("main");
  });

  it("BRANCH.REBASE_COMMITS returns getRebaseCommits result", async () => {
    const commits = [{ hash: "abc" }];
    mockGetRebaseCommits.mockResolvedValueOnce(commits);
    const result = await getHandler(IPC.BRANCH.REBASE_COMMITS)({}, "main");
    expect(mockGetRebaseCommits).toHaveBeenCalledWith("main");
    expect(result).toBe(commits);
  });

  it("BRANCH.REBASE_INTERACTIVE calls interactiveRebase with onto and todo", async () => {
    mockInteractiveRebase.mockResolvedValueOnce(undefined);
    const todoEntries = [{ action: "pick", hash: "abc123" }];
    await getHandler(IPC.BRANCH.REBASE_INTERACTIVE)({}, "main", todoEntries);
    expect(mockInteractiveRebase).toHaveBeenCalledWith("main", todoEntries);
  });

  it("BRANCH.REBASE_CONTINUE calls rebaseContinue", async () => {
    mockRebaseContinue.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.REBASE_CONTINUE)({});
    expect(mockRebaseContinue).toHaveBeenCalled();
  });

  it("BRANCH.REBASE_SKIP calls rebaseSkip", async () => {
    mockRebaseSkip.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.REBASE_SKIP)({});
    expect(mockRebaseSkip).toHaveBeenCalled();
  });

  it("BRANCH.REBASE_ABORT calls rebaseAbort", async () => {
    mockRebaseAbort.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.REBASE_ABORT)({});
    expect(mockRebaseAbort).toHaveBeenCalled();
  });

  it("BRANCH.REBASE_IN_PROGRESS returns isRebaseInProgress result", async () => {
    mockIsRebaseInProgress.mockResolvedValueOnce(true);
    const result = await getHandler(IPC.BRANCH.REBASE_IN_PROGRESS)({});
    expect(result).toBe(true);
  });

  it("BRANCH.CHERRY_PICK calls cherryPick with hash", async () => {
    mockCherryPick.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHERRY_PICK)({}, "deadbeef");
    expect(mockCherryPick).toHaveBeenCalledWith("deadbeef");
  });

  it("BRANCH.CHERRY_PICK_OPTIONS calls cherryPickWithOptions", async () => {
    const opts = { hash: "deadbeef", noCommit: true };
    mockCherryPickWithOptions.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHERRY_PICK_OPTIONS)({}, opts);
    expect(mockCherryPickWithOptions).toHaveBeenCalledWith(opts);
  });

  it("BRANCH.REVERT calls revertCommit with options", async () => {
    const opts = { hash: "abc123", noCommit: false };
    mockRevertCommit.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.REVERT)({}, opts);
    expect(mockRevertCommit).toHaveBeenCalledWith(opts);
  });

  it("BRANCH.MERGE_ABORT calls mergeAbort", async () => {
    mockMergeAbort.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.MERGE_ABORT)({});
    expect(mockMergeAbort).toHaveBeenCalled();
  });

  it("BRANCH.MERGE_CONTINUE calls mergeContinue", async () => {
    mockMergeContinue.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.MERGE_CONTINUE)({});
    expect(mockMergeContinue).toHaveBeenCalled();
  });

  it("BRANCH.CHERRY_PICK_ABORT calls cherryPickAbort", async () => {
    mockCherryPickAbort.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHERRY_PICK_ABORT)({});
    expect(mockCherryPickAbort).toHaveBeenCalled();
  });

  it("BRANCH.CHERRY_PICK_CONTINUE calls cherryPickContinue", async () => {
    mockCherryPickContinue.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.CHERRY_PICK_CONTINUE)({});
    expect(mockCherryPickContinue).toHaveBeenCalled();
  });

  it("BRANCH.RESET calls resetToCommit with hash and mode", async () => {
    mockResetToCommit.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.RESET)({}, "abc123", "hard");
    expect(mockResetToCommit).toHaveBeenCalledWith("abc123", "hard");
  });

  it("BRANCH.SQUASH_PREVIEW returns getSquashPreview result", async () => {
    const preview = { commits: [], message: "combined" };
    mockGetSquashPreview.mockResolvedValueOnce(preview);
    const result = await getHandler(IPC.BRANCH.SQUASH_PREVIEW)({}, "abc123");
    expect(mockGetSquashPreview).toHaveBeenCalledWith("abc123");
    expect(result).toBe(preview);
  });

  it("BRANCH.SQUASH_EXECUTE calls squashCommits with options", async () => {
    const opts = { targetHash: "abc123", message: "squashed" };
    mockSquashCommits.mockResolvedValueOnce(undefined);
    await getHandler(IPC.BRANCH.SQUASH_EXECUTE)({}, opts);
    expect(mockSquashCommits).toHaveBeenCalledWith(opts);
  });

  it("BRANCH.STALE_REMOTE returns getStaleRemoteBranches result", async () => {
    const staleBranches = ["origin/old-feature"];
    mockGetStaleRemoteBranches.mockResolvedValueOnce(staleBranches);
    const result = await getHandler(IPC.BRANCH.STALE_REMOTE)({}, 30);
    expect(mockGetStaleRemoteBranches).toHaveBeenCalledWith(30);
    expect(result).toBe(staleBranches);
  });

  it("BRANCH.REMOTE_COMMITS returns getRemoteBranchCommits result", async () => {
    const commits = [{ hash: "xyz" }];
    mockGetRemoteBranchCommits.mockResolvedValueOnce(commits);
    const result = await getHandler(IPC.BRANCH.REMOTE_COMMITS)({}, "origin/main", 50);
    expect(mockGetRemoteBranchCommits).toHaveBeenCalledWith("origin/main", 50);
    expect(result).toBe(commits);
  });

  it("TAG.LIST returns getTags result", async () => {
    const tags = [{ name: "v1.0.0" }];
    mockGetTags.mockResolvedValueOnce(tags);
    const result = await getHandler(IPC.TAG.LIST)({});
    expect(mockGetTags).toHaveBeenCalled();
    expect(result).toBe(tags);
  });

  it("TAG.CREATE calls createTag with name, hash and optional message", async () => {
    mockCreateTag.mockResolvedValueOnce(undefined);
    await getHandler(IPC.TAG.CREATE)({}, "v1.0.0", "abc123", "Release 1.0.0");
    expect(mockCreateTag).toHaveBeenCalledWith("v1.0.0", "abc123", "Release 1.0.0");
  });

  it("TAG.DELETE calls deleteTag with name", async () => {
    mockDeleteTag.mockResolvedValueOnce(undefined);
    await getHandler(IPC.TAG.DELETE)({}, "v1.0.0");
    expect(mockDeleteTag).toHaveBeenCalledWith("v1.0.0");
  });

  it("TAG.DELETE_REMOTE calls deleteRemoteTag with name and optional remote", async () => {
    mockDeleteRemoteTag.mockResolvedValueOnce(undefined);
    await getHandler(IPC.TAG.DELETE_REMOTE)({}, "v1.0.0", "origin");
    expect(mockDeleteRemoteTag).toHaveBeenCalledWith("v1.0.0", "origin");
  });

  it("TAG.PUSH calls pushTag with name and optional remote", async () => {
    mockPushTag.mockResolvedValueOnce(undefined);
    await getHandler(IPC.TAG.PUSH)({}, "v1.0.0", "origin");
    expect(mockPushTag).toHaveBeenCalledWith("v1.0.0", "origin");
  });
});
