import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock("../git/git-service", () => ({
  gitService: {
    getRemotes: vi.fn(),
    getRepoPath: vi.fn().mockReturnValue("/tmp/repo"),
  },
}));

vi.mock("child_process", () => ({ execFile: vi.fn() }));
vi.mock("util", () => ({ promisify: () => mockExecFileAsync }));

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

  // ── Unknown / no origin remote ────────────────────────────────────────────

  describe("unknown provider", () => {
    it("returns empty array when no remotes configured", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });

    it("returns empty array when origin URL is neither github nor gitlab", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://bitbucket.org/user/repo.git", pushUrl: "" },
      ]);

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });

    it("returns empty array when getRemotes throws", async () => {
      vi.mocked(gitService.getRemotes).mockRejectedValue(new Error("no git repo"));

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });
  });

  // ── GitHub provider ───────────────────────────────────────────────────────

  describe("GitHub provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("maps 'completed/success' runs to status=success", async () => {
      const runs = [
        {
          name: "CI",
          status: "completed",
          conclusion: "success",
          url: "https://github.com/actions/runs/1",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "deadbeef")) as Array<{
        status: string;
        name: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe("success");
      expect(result[0]!.name).toBe("CI");
    });

    it("maps 'completed' with non-success conclusion to status=failure", async () => {
      const runs = [
        {
          name: "Test",
          status: "completed",
          conclusion: "failure",
          url: "https://github.com/actions/runs/2",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "deadbeef")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("failure");
    });

    it("maps 'in_progress' runs to status=running", async () => {
      const runs = [
        { name: "Build", status: "in_progress", conclusion: "", url: "", startedAt: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "sha1")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("running");
    });

    it("maps 'queued' runs to status=pending", async () => {
      const runs = [
        { name: "Deploy", status: "queued", conclusion: "", url: "", startedAt: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "sha2")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("pending");
    });

    it("maps 'waiting' runs to status=pending", async () => {
      const runs = [
        { name: "Lint", status: "waiting", conclusion: "", url: "", startedAt: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "sha3")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("pending");
    });

    it("maps unknown status to 'unknown'", async () => {
      const runs = [
        {
          name: "Scan",
          status: "some_unknown_status",
          conclusion: "",
          url: "",
          startedAt: "",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "sha4")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("unknown");
    });

    it("includes sha, url, conclusion, and startedAt in results", async () => {
      const runs = [
        {
          name: "CI",
          status: "completed",
          conclusion: "success",
          url: "https://github.com/actions/runs/5",
          startedAt: "2024-06-01T12:00:00Z",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

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

    it("returns empty array when gh command fails", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("gh not installed"));

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "sha5");
      expect(result).toEqual([]);
    });

    it("returns empty array when stdout is empty", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "" });

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "sha6");
      expect(result).toEqual([]);
    });

    it("returns empty conclusion and startedAt when missing from run data", async () => {
      const runs = [{ name: "CI", status: "queued", url: "" }];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(runs) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "sha7")) as Array<{
        conclusion: string;
        startedAt: string;
      }>;

      expect(result[0]!.conclusion).toBe("");
      expect(result[0]!.startedAt).toBe("");
    });

    it("calls gh with correct arguments", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "[]" });

      const handler = getHandler(IPC.CI.STATUS);
      await handler({}, "abc123");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        [
          "run",
          "list",
          "--commit",
          "abc123",
          "--json",
          "name,status,conclusion,url,startedAt",
          "--limit",
          "10",
        ],
        expect.objectContaining({ timeout: 15000 })
      );
    });
  });

  // ── GitLab provider ───────────────────────────────────────────────────────

  describe("GitLab provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://gitlab.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("maps 'success' pipeline to status=success", async () => {
      const pipelines = [
        {
          sha: "abc123",
          status: "success",
          web_url: "https://gitlab.com/pipelines/1",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("success");
    });

    it("maps 'failed' pipeline to status=failure", async () => {
      const pipelines = [
        { sha: "abc123", status: "failed", web_url: "", created_at: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("failure");
    });

    it("maps 'running' pipeline to status=running", async () => {
      const pipelines = [
        { sha: "abc123", status: "running", web_url: "", created_at: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("running");
    });

    it("maps other statuses to pending", async () => {
      const pipelines = [
        { sha: "abc123", status: "pending", web_url: "", created_at: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ status: string }>;
      expect(result[0]!.status).toBe("pending");
    });

    it("filters pipelines by sha prefix", async () => {
      const pipelines = [
        { sha: "abc123def", status: "success", web_url: "", created_at: "" },
        { sha: "xyz999", status: "success", web_url: "", created_at: "" },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as unknown[];
      expect(result).toHaveLength(1);
    });

    it("returns empty array when glab command fails", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("glab not found"));

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });

    it("returns empty array when stdout is empty", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "" });

      const handler = getHandler(IPC.CI.STATUS);
      const result = await handler({}, "abc123");
      expect(result).toEqual([]);
    });

    it("sets name to 'Pipeline' for all GitLab results", async () => {
      const pipelines = [
        {
          sha: "abc123",
          status: "success",
          web_url: "https://gitlab.com/p/1",
          created_at: "2024-01-01",
        },
      ];
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      const result = (await handler({}, "abc123")) as Array<{ name: string }>;
      expect(result[0]!.name).toBe("Pipeline");
    });

    it("uses pushUrl when fetchUrl is empty", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "", pushUrl: "https://gitlab.com/user/repo.git" },
      ]);
      mockExecFileAsync.mockResolvedValue({ stdout: "[]" });

      const handler = getHandler(IPC.CI.STATUS);
      await handler({}, "sha");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "glab",
        expect.any(Array),
        expect.any(Object)
      );
    });

    it("limits results to 10 pipelines", async () => {
      const pipelines = Array.from({ length: 15 }, (_, i) => ({
        sha: `abc${i}`,
        status: "success",
        web_url: "",
        created_at: "",
      }));
      mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(pipelines) });

      const handler = getHandler(IPC.CI.STATUS);
      // All have sha starting with "abc"
      const result = (await handler({}, "abc")) as unknown[];
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });
});
