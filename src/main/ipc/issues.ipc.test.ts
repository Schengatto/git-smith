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
import { registerIssuesHandlers } from "./issues.ipc";
import { IPC } from "../../shared/ipc-channels";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`Handler for "${channel}" not registered`);
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("issues IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerIssuesHandlers();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe("channel registration", () => {
    it("registers ISSUES.RESOLVE handler", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.ISSUES.RESOLVE);
    });
  });

  // ── Input parsing ─────────────────────────────────────────────────────────

  describe("issue reference parsing", () => {
    it("returns null when issueRef contains no number", async () => {
      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "no-numbers-here");
      expect(result).toBeNull();
    });

    it("returns null for empty string", async () => {
      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "");
      expect(result).toBeNull();
    });

    it("extracts number from 'fixes #123' format", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "" },
      ]);
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          number: 123,
          title: "Bug fix",
          state: "OPEN",
          url: "https://github.com/issues/123",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      await handler({}, "fixes #123");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["issue", "view", "123"]),
        expect.any(Object)
      );
    });

    it("extracts number from plain numeric string '42'", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "" },
      ]);
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          number: 42,
          title: "Feature",
          state: "CLOSED",
          url: "https://github.com/issues/42",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      await handler({}, "42");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["issue", "view", "42"]),
        expect.any(Object)
      );
    });
  });

  // ── GitHub provider ───────────────────────────────────────────────────────

  describe("GitHub provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("returns open issue info for GitHub", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          number: 99,
          title: "Crash on startup",
          state: "OPEN",
          url: "https://github.com/user/repo/issues/99",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#99")) as {
        number: number;
        title: string;
        state: string;
        url: string;
      };

      expect(result).not.toBeNull();
      expect(result.number).toBe(99);
      expect(result.title).toBe("Crash on startup");
      expect(result.state).toBe("open");
      expect(result.url).toBe("https://github.com/user/repo/issues/99");
    });

    it("returns closed issue info for GitHub", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          number: 50,
          title: "Resolved bug",
          state: "CLOSED",
          url: "https://github.com/user/repo/issues/50",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "50")) as { state: string };

      expect(result.state).toBe("closed");
    });

    it("maps any state other than 'open' (case-insensitive) to 'closed'", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          number: 10,
          title: "Something",
          state: "MERGED",
          url: "https://github.com/issues/10",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "10")) as { state: string };
      expect(result.state).toBe("closed");
    });

    it("calls gh with correct JSON fields", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ number: 1, title: "t", state: "OPEN", url: "u" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      await handler({}, "#1");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        ["issue", "view", "1", "--json", "number,title,state,url"],
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("returns null when gh command throws", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("gh not found"));

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#5");
      expect(result).toBeNull();
    });

    it("returns null when gh returns invalid JSON", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "not-json" });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#5");
      expect(result).toBeNull();
    });

    it("'open' lowercase state is treated as open", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ number: 7, title: "Bug", state: "open", url: "" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#7")) as { state: string };
      expect(result.state).toBe("open");
    });
  });

  // ── GitLab provider ───────────────────────────────────────────────────────

  describe("GitLab provider", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://gitlab.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("returns open issue info for GitLab", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          iid: 7,
          title: "GitLab issue",
          state: "opened",
          web_url: "https://gitlab.com/user/repo/-/issues/7",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#7")) as {
        number: number;
        title: string;
        state: string;
        url: string;
      };

      expect(result.number).toBe(7);
      expect(result.title).toBe("GitLab issue");
      expect(result.state).toBe("open");
      expect(result.url).toBe("https://gitlab.com/user/repo/-/issues/7");
    });

    it("returns closed issue info for GitLab", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          iid: 3,
          title: "Fixed",
          state: "closed",
          web_url: "https://gitlab.com/user/repo/-/issues/3",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "3")) as { state: string };
      expect(result.state).toBe("closed");
    });

    it("falls back to parsed number when iid is missing", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({
          title: "No IID",
          state: "opened",
          web_url: "https://gitlab.com/issues/12",
        }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#12")) as { number: number };
      expect(result.number).toBe(12);
    });

    it("returns empty string for missing title and web_url", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ iid: 9, state: "opened" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#9")) as { title: string; url: string };
      expect(result.title).toBe("");
      expect(result.url).toBe("");
    });

    it("calls glab with correct arguments", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ iid: 20, title: "t", state: "opened", web_url: "u" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      await handler({}, "#20");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "glab",
        ["issue", "view", "20", "--output", "json"],
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("returns null when glab command throws", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("glab not found"));

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#20");
      expect(result).toBeNull();
    });

    it("treats non-'opened' GitLab states as closed", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ iid: 5, title: "x", state: "locked", web_url: "" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = (await handler({}, "#5")) as { state: string };
      expect(result.state).toBe("closed");
    });
  });

  // ── Unknown / no origin remote ────────────────────────────────────────────

  describe("unknown / no origin remote", () => {
    it("returns null when no remotes are configured", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([]);

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#5");
      expect(result).toBeNull();
    });

    it("returns null when origin is a bitbucket URL", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://bitbucket.org/user/repo.git", pushUrl: "" },
      ]);

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#5");
      expect(result).toBeNull();
    });

    it("returns null when getRemotes throws", async () => {
      vi.mocked(gitService.getRemotes).mockRejectedValue(new Error("no repo"));

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      const result = await handler({}, "#5");
      expect(result).toBeNull();
    });

    it("uses pushUrl when fetchUrl is empty", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "", pushUrl: "https://github.com/user/repo.git" },
      ]);
      mockExecFileAsync.mockResolvedValue({
        stdout: JSON.stringify({ number: 1, title: "t", state: "OPEN", url: "u" }),
      });

      const handler = getHandler(IPC.ISSUES.RESOLVE);
      await handler({}, "#1");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        expect.any(Array),
        expect.any(Object)
      );
    });
  });
});
