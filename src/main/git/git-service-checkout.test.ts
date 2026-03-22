import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckout = vi.fn().mockResolvedValue(undefined);
const mockRaw = vi.fn().mockResolvedValue("");
const mockGetRemotes = vi.fn().mockResolvedValue([{ name: "origin" }, { name: "upstream" }]);
const mockMerge = vi.fn().mockResolvedValue({ result: "success" });

vi.mock("simple-git", () => {
  const fn = () => ({
    checkout: mockCheckout,
    raw: mockRaw,
    getRemotes: mockGetRemotes,
    merge: mockMerge,
  });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.checkout", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = {
      checkout: mockCheckout,
      raw: mockRaw,
      getRemotes: mockGetRemotes,
      merge: mockMerge,
    };
  });

  it("checks out a local branch as-is", async () => {
    await service.checkout("develop");
    expect(mockCheckout).toHaveBeenCalledWith("develop");
  });

  it("does not fast-forward for local branch checkout", async () => {
    await service.checkout("develop");
    expect(mockMerge).not.toHaveBeenCalled();
  });

  it("strips remotes/ prefix for remote refs", async () => {
    await service.checkout("remotes/origin/feature");
    expect(mockCheckout).toHaveBeenCalledWith("feature");
  });

  it("strips origin/ prefix for remote refs (parseRefs format)", async () => {
    await service.checkout("origin/feature");
    expect(mockCheckout).toHaveBeenCalledWith("feature");
  });

  it("fast-forwards local branch to remote after checkout from remote ref", async () => {
    await service.checkout("origin/feature");
    expect(mockMerge).toHaveBeenCalledWith(["origin/feature", "--ff-only"]);
  });

  it("fast-forwards after checkout from remotes/ format", async () => {
    await service.checkout("remotes/origin/feature");
    expect(mockMerge).toHaveBeenCalledWith(["remotes/origin/feature", "--ff-only"]);
  });

  it("does not throw when fast-forward fails (diverged history)", async () => {
    mockMerge.mockRejectedValueOnce(new Error("Not possible to fast-forward"));
    await expect(service.checkout("origin/feature")).resolves.toBeUndefined();
    expect(mockCheckout).toHaveBeenCalledWith("feature");
    expect(mockMerge).toHaveBeenCalledWith(["origin/feature", "--ff-only"]);
  });

  it("strips upstream/ prefix for remote refs", async () => {
    await service.checkout("upstream/main");
    expect(mockCheckout).toHaveBeenCalledWith("main");
  });

  it("preserves slashes in branch names after remote prefix", async () => {
    await service.checkout("origin/feature/my-thing");
    expect(mockCheckout).toHaveBeenCalledWith("feature/my-thing");
  });

  it("preserves local branch names containing slashes", async () => {
    await service.checkout("feature/my-thing");
    expect(mockCheckout).toHaveBeenCalledWith("feature/my-thing");
  });

  it("does not fast-forward for local branch with slashes", async () => {
    await service.checkout("feature/my-thing");
    expect(mockMerge).not.toHaveBeenCalled();
  });
});

describe("GitService.checkoutWithOptions", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = {
      checkout: mockCheckout,
      raw: mockRaw,
      getRemotes: mockGetRemotes,
      merge: mockMerge,
    };
  });

  it("strips origin/ prefix with merge option", async () => {
    await service.checkoutWithOptions("origin/develop", { merge: true });
    expect(mockRaw).toHaveBeenCalledWith(["checkout", "develop", "--merge"]);
  });

  it("fast-forwards local branch to remote after checkoutWithOptions", async () => {
    await service.checkoutWithOptions("origin/develop", { merge: true });
    expect(mockMerge).toHaveBeenCalledWith(["origin/develop", "--ff-only"]);
  });
});
