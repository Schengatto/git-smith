import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("");
const mockTag = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw, tag: mockTag });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

describe("GitService tag operations", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw, tag: mockTag };
  });

  describe("deleteTag", () => {
    it("deletes a local tag", async () => {
      await service.deleteTag("v1.0.0");
      expect(mockTag).toHaveBeenCalledWith(["-d", "v1.0.0"]);
    });
  });

  describe("deleteRemoteTag", () => {
    it("deletes a remote tag from origin by default", async () => {
      await service.deleteRemoteTag("v1.0.0");
      expect(mockRaw).toHaveBeenCalledWith(["push", "origin", "--delete", "refs/tags/v1.0.0"]);
    });

    it("deletes a remote tag from a specified remote", async () => {
      await service.deleteRemoteTag("v2.0.0", "upstream");
      expect(mockRaw).toHaveBeenCalledWith(["push", "upstream", "--delete", "refs/tags/v2.0.0"]);
    });
  });
});
