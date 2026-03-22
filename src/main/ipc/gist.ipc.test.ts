import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────
// vi.mock factories are hoisted to top of file, so they cannot reference
// outer `const` variables. Use vi.hoisted() to create refs that are safe.

const { mockExecFileAsync, mockFs } = vi.hoisted(() => {
  return {
    mockExecFileAsync: vi.fn(),
    mockFs: {
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
    },
  };
});

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

vi.mock("fs", () => ({ default: mockFs }));

vi.mock("os", () => ({
  default: { tmpdir: () => "/tmp" },
}));

vi.mock("path", async () => {
  const actual = await vi.importActual<typeof import("path")>("path");
  return { default: actual };
});

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { ipcMain } from "electron";
import { gitService } from "../git/git-service";
import { registerGistHandlers } from "./gist.ipc";
import { IPC } from "../../shared/ipc-channels";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`Handler for "${channel}" not registered`);
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("gist IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerGistHandlers();
  });

  // ── Channel registration ─────────────────────────────────────────────────

  describe("channel registration", () => {
    it("registers GIST.CREATE handler", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.GIST.CREATE);
    });
  });

  // ── GIST.CREATE — GitHub (default) ──────────────────────────────────────

  describe("GIST.CREATE — GitHub (default)", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("creates a public gist and returns url + id", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "https://gist.github.com/abc123def456\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      const result = await handler(
        {},
        {
          content: "console.log('hi');",
          filename: "test.js",
          description: "My test gist",
          public: true,
        }
      );

      expect(result).toEqual({
        url: "https://gist.github.com/abc123def456",
        id: "abc123def456",
      });
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["gist", "create", "--public"]),
        expect.any(Object)
      );
    });

    it("creates a private gist (no --public flag)", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "https://gist.github.com/xyz789\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      await handler(
        {},
        {
          content: "secret",
          filename: "secret.txt",
          description: "Private",
          public: false,
        }
      );

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      expect(args).not.toContain("--public");
    });

    it("uses empty description when none provided", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "https://gist.github.com/no-desc\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      await handler(
        {},
        {
          content: "data",
          filename: "file.txt",
          public: false,
        }
      );

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      const descIdx = args.indexOf("--desc");
      expect(descIdx).toBeGreaterThanOrEqual(0);
      expect(args[descIdx + 1]).toBe("");
    });

    it("returns empty id when URL has no hash path segment", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "https://gist.github.com/\n" });

      const handler = getHandler(IPC.GIST.CREATE);
      const result = (await handler(
        {},
        { content: "x", filename: "x.txt", public: true }
      )) as {
        url: string;
        id: string;
      };
      expect(result.id).toBe("");
    });
  });

  // ── GIST.CREATE — GitLab (snippet) ───────────────────────────────────────

  describe("GIST.CREATE — GitLab (snippet)", () => {
    beforeEach(() => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://gitlab.com/user/repo.git", pushUrl: "" },
      ]);
    });

    it("creates a public snippet via glab and returns url", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "Snippet created: https://gitlab.com/snippets/42\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      const result = (await handler(
        {},
        {
          content: "# readme",
          filename: "README.md",
          description: "GitLab snippet",
          public: true,
        }
      )) as { url: string; id: string };

      expect(result.url).toBe("https://gitlab.com/snippets/42");
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "glab",
        expect.arrayContaining(["snippet", "create", "--visibility", "public"]),
        expect.any(Object)
      );
    });

    it("creates a private snippet via glab", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "https://gitlab.com/snippets/99\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      await handler(
        {},
        {
          content: "private data",
          filename: "data.txt",
          public: false,
        }
      );

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      expect(args).toContain("private");
    });

    it("returns empty url when stdout has no URL", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "No URL here\n" });

      const handler = getHandler(IPC.GIST.CREATE);
      const result = (await handler(
        {},
        {
          content: "x",
          filename: "x.txt",
          public: true,
        }
      )) as { url: string; id: string };

      expect(result.url).toBe("");
      expect(result.id).toBe("");
    });

    it("uses filename as title when no description provided", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "https://gitlab.com/snippets/1\n" });

      const handler = getHandler(IPC.GIST.CREATE);
      await handler({}, { content: "x", filename: "myfile.py", public: true });

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      const titleIdx = args.indexOf("--title");
      expect(args[titleIdx + 1]).toBe("myfile.py");
    });
  });

  // ── GIST.CREATE — unknown remote (no origin) ─────────────────────────────

  describe("GIST.CREATE — unknown remote (no origin)", () => {
    it("defaults to GitHub when no origin remote", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([]);
      mockExecFileAsync.mockResolvedValue({
        stdout: "https://gist.github.com/fallback123\n",
      });

      const handler = getHandler(IPC.GIST.CREATE);
      const result = (await handler(
        {},
        {
          content: "test",
          filename: "test.txt",
          public: true,
        }
      )) as { url: string };

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "gh",
        expect.any(Array),
        expect.any(Object)
      );
      expect(result.url).toBe("https://gist.github.com/fallback123");
    });
  });

  // ── GIST.CREATE — temp file cleanup ──────────────────────────────────────

  describe("GIST.CREATE — temp file cleanup", () => {
    it("cleans up temp file even when execFile throws", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/u/r.git", pushUrl: "" },
      ]);
      mockExecFileAsync.mockRejectedValue(new Error("gh not found"));

      const handler = getHandler(IPC.GIST.CREATE);

      await expect(
        handler({}, { content: "x", filename: "x.txt", public: true })
      ).rejects.toThrow("gh not found");

      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it("writes content to a temp file before calling gh", async () => {
      vi.mocked(gitService.getRemotes).mockResolvedValue([
        { name: "origin", fetchUrl: "https://github.com/u/r.git", pushUrl: "" },
      ]);
      mockExecFileAsync.mockResolvedValue({ stdout: "https://gist.github.com/abc\n" });

      const handler = getHandler(IPC.GIST.CREATE);
      await handler({}, { content: "hello world", filename: "hello.txt", public: true });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("hello.txt"),
        "hello world",
        "utf-8"
      );
    });
  });
});
