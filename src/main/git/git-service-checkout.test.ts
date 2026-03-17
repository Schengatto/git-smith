import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckout = vi.fn().mockResolvedValue(undefined);
const mockRaw = vi.fn().mockResolvedValue("");
const mockGetRemotes = vi.fn().mockResolvedValue([{ name: "origin" }, { name: "upstream" }]);

vi.mock("simple-git", () => {
  const fn = () => ({ checkout: mockCheckout, raw: mockRaw, getRemotes: mockGetRemotes });
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
    };
  });

  it("checks out a local branch as-is", async () => {
    await service.checkout("develop");
    expect(mockCheckout).toHaveBeenCalledWith("develop");
  });

  it("strips remotes/ prefix for remote refs", async () => {
    await service.checkout("remotes/origin/feature");
    expect(mockCheckout).toHaveBeenCalledWith("feature");
  });

  it("strips origin/ prefix for remote refs (parseRefs format)", async () => {
    await service.checkout("origin/feature");
    expect(mockCheckout).toHaveBeenCalledWith("feature");
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
    };
  });

  it("strips origin/ prefix with merge option", async () => {
    await service.checkoutWithOptions("origin/develop", { merge: true });
    expect(mockRaw).toHaveBeenCalledWith(["checkout", "develop", "--merge"]);
  });
});
