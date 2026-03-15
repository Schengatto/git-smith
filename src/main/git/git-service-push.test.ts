import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService.push", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    // Simulate an open repo by setting private fields via cast
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("pushes normally (no flags)", async () => {
    await service.push("origin", "main", false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "main"]);
  });

  it("pushes with --force", async () => {
    await service.push("origin", "main", true, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--force", "origin", "main"]);
  });

  it("pushes with --set-upstream", async () => {
    await service.push("origin", "main", false, true);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--set-upstream", "origin", "main"]);
  });

  it("pushes with --force and --set-upstream", async () => {
    await service.push("origin", "main", true, true);
    expect(mockRaw).toHaveBeenCalledWith(["push", "--force", "--set-upstream", "origin", "main"]);
  });

  it("omits branch arg when branch is undefined", async () => {
    await service.push("origin", undefined, false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin"]);
  });

  it("defaults remote to 'origin' when undefined", async () => {
    await service.push(undefined, "main", false, false);
    expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "main"]);
  });
});
