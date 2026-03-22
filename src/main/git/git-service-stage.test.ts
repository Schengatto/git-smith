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

describe("GitService.stage", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("stages files using git add -A to handle deletions and renames", async () => {
    await service.stage(["src/file.ts"]);
    expect(mockRaw).toHaveBeenCalledWith(["add", "-A", "--", "src/file.ts"]);
  });

  it("stages multiple files at once", async () => {
    await service.stage(["a.ts", "b.ts", "c.ts"]);
    expect(mockRaw).toHaveBeenCalledWith(["add", "-A", "--", "a.ts", "b.ts", "c.ts"]);
  });
});
