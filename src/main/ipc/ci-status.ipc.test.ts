import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const { mockGithubGetCIStatus, mockGitlabGetCIStatus, mockGetPlatformTokenForRepo } = vi.hoisted(
  () => ({
    mockGithubGetCIStatus: vi.fn(),
    mockGitlabGetCIStatus: vi.fn(),
    mockGetPlatformTokenForRepo: vi.fn(),
  })
);

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock("../git/git-service", () => ({
  gitService: {
    detectProvider: vi.fn(),
    getRepoPath: vi.fn().mockReturnValue("/tmp/repo"),
  },
}));

vi.mock("../store", () => ({
  getPlatformTokenForRepo: (...args: unknown[]) => mockGetPlatformTokenForRepo(...args),
}));

vi.mock("../git/platform-api", () => ({
  githubGetCIStatus: (...args: unknown[]) => mockGithubGetCIStatus(...args),
  gitlabGetCIStatus: (...args: unknown[]) => mockGitlabGetCIStatus(...args),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { ipcMain } from "electron";
import { gitService } from "../git/git-service";
import { registerCIStatusHandlers } from "./ci-status.ipc";
import { IPC } from "../../shared/ipc-channels";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`Handler for "${channel}" not registered`);
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ci-status IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerCIStatusHandlers();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe("channel registration", () => {
    it("registers CI.STATUS handler", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.CI.STATUS);
    });
  });

  // ── No token ────────────────────────────────────────────────────────────

  describe("no token configured", () => {
    it("returns empty array when no token is set", async () => {
      vi.mocked(gitService.detectProvider).mockResolvedValue({
        provider: "github",
        owner: "user",
        repo: "repo",
        baseUrl: "https://github.com",
      });
      mockGetPlatformTokenForRepo.mockReturnValue(null);

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });
  });

  // ── Unknown provider ────────────────────────────────────────────────────

  describe("unknown provider", () => {
    it("returns empty array for unknown provider", async () => {
      vi.mocked(gitService.detectProvider).mockResolvedValue({
        provider: "unknown",
        owner: "",
        repo: "",
        baseUrl: "",
      });
      mockGetPlatformTokenForRepo.mockReturnValue("token");

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });
  });

  // ── GitHub provider ───────────────────────────────────────────────────────

  describe("GitHub provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.detectProvider).mockResolvedValue({
        provider: "github",
        owner: "user",
        repo: "repo",
        baseUrl: "https://github.com",
      });
      mockGetPlatformTokenForRepo.mockReturnValue("ghp_test_token");
    });

    it("maps 'completed/success' runs to status=success", async () => {
      mockGithubGetCIStatus.mockResolvedValue([
        {
          sha: "deadbeef",
          status: "success",
          name: "CI",
          url: "https://github.com/actions/runs/1",
          conclusion: "success",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "deadbeef")) as Array<{
        status: string;
        name: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe("success");
      expect(result[0]!.name).toBe("CI");
    });

    it("calls githubGetCIStatus with correct arguments", async () => {
      mockGithubGetCIStatus.mockResolvedValue([]);

      const handler = getHandler(IPC.CI.STATUS);
      await handler({}, "abc123");

      expect(mockGithubGetCIStatus).toHaveBeenCalledWith(
        "user",
        "repo",
        "ghp_test_token",
        "abc123"
      );
    });

    it("returns empty array when API call fails", async () => {
      mockGithubGetCIStatus.mockRejectedValue(new Error("API error"));

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "sha5");
      expect(result).toEqual([]);
    });

    it("includes sha, url, conclusion, and startedAt in results", async () => {
      mockGithubGetCIStatus.mockResolvedValue([
        {
          sha: "mysha",
          status: "success",
          name: "CI",
          url: "https://github.com/actions/runs/5",
          conclusion: "success",
          startedAt: "2024-06-01T12:00:00Z",
        },
      ]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "mysha")) as Array<{
        sha: string;
        url: string;
        conclusion: string;
        startedAt: string;
      }>;

      expect(result[0]!.sha).toBe("mysha");
      expect(result[0]!.url).toBe("https://github.com/actions/runs/5");
      expect(result[0]!.conclusion).toBe("success");
      expect(result[0]!.startedAt).toBe("2024-06-01T12:00:00Z");
    });
  });

  // ── GitLab provider ───────────────────────────────────────────────────────

  describe("GitLab provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.detectProvider).mockResolvedValue({
        provider: "gitlab",
        owner: "user",
        repo: "repo",
        baseUrl: "https://gitlab.com",
      });
      mockGetPlatformTokenForRepo.mockReturnValue("glpat-test_token");
    });

    it("maps 'success' pipeline to status=success", async () => {
      mockGitlabGetCIStatus.mockResolvedValue([
        {
          sha: "abc123",
          status: "success",
          name: "Pipeline",
          url: "https://gitlab.com/pipelines/1",
          conclusion: "success",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("success");
    });

    it("calls gitlabGetCIStatus with correct arguments", async () => {
      mockGitlabGetCIStatus.mockResolvedValue([]);

      const handler = getHandler(IPC.CI.STATUS);
      await handler({}, "abc123");

      expect(mockGitlabGetCIStatus).toHaveBeenCalledWith(
        "user",
        "repo",
        "glpat-test_token",
        "abc123"
      );
    });

    it("returns empty array when API call fails", async () => {
      mockGitlabGetCIStatus.mockRejectedValue(new Error("API error"));

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });

    it("sets name to 'Pipeline' for all GitLab results", async () => {
      mockGitlabGetCIStatus.mockResolvedValue([
        {
          sha: "abc123",
          status: "success",
          name: "Pipeline",
          url: "https://gitlab.com/p/1",
          conclusion: "success",
          startedAt: "2024-01-01",
        },
      ]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ name: string }>;
      expect(result[0]!.name).toBe("Pipeline");
    });
  });
});
