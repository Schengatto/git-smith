import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock gitService
const mockGetRepoPath = vi.fn();
const mockGetIgnoredFiles = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: () => mockGetRepoPath(),
    getIgnoredFiles: () => mockGetIgnoredFiles(),
  },
}));

import { ipcMain } from "electron";
import { registerGitignoreHandlers } from "./git-gitignore.ipc";

function getHandler(channel: string) {
  const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call![1];
}

describe("git-gitignore IPC handler", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitignore-test-"));
    mockGetRepoPath.mockReturnValue(tmpDir);
    mockGetIgnoredFiles.mockResolvedValue(["node_modules/", "dist/"]);
    registerGitignoreHandlers();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("add", () => {
    it("creates .gitignore if it does not exist", async () => {
      const handler = getHandler("git:gitignore:add");
      await handler(null, "node_modules/");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("node_modules/\n");
    });

    it("appends pattern to existing .gitignore", async () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\n", "utf-8");
      const handler = getHandler("git:gitignore:add");
      await handler(null, "dist/");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("*.log\ndist/\n");
    });

    it("does not duplicate existing pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\ndist/\n", "utf-8");
      const handler = getHandler("git:gitignore:add");
      await handler(null, "dist/");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("*.log\ndist/\n");
    });

    it("handles .gitignore without trailing newline", async () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log", "utf-8");
      const handler = getHandler("git:gitignore:add");
      await handler(null, "dist/");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("*.log\ndist/\n");
    });

    it("throws if no repo is open", async () => {
      mockGetRepoPath.mockReturnValue(null);
      const handler = getHandler("git:gitignore:add");
      await expect(handler(null, "foo")).rejects.toThrow("No repository open");
    });
  });

  describe("read", () => {
    it("returns empty string if .gitignore does not exist", async () => {
      const handler = getHandler("git:gitignore:read");
      const result = await handler(null);
      expect(result).toBe("");
    });

    it("returns content of .gitignore", async () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\ndist/\n", "utf-8");
      const handler = getHandler("git:gitignore:read");
      const result = await handler(null);
      expect(result).toBe("*.log\ndist/\n");
    });
  });

  describe("write", () => {
    it("writes content to .gitignore", async () => {
      const handler = getHandler("git:gitignore:write");
      await handler(null, "node_modules/\n*.log\n");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("node_modules/\n*.log\n");
    });

    it("overwrites existing .gitignore", async () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "old\n", "utf-8");
      const handler = getHandler("git:gitignore:write");
      await handler(null, "new\n");
      const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(content).toBe("new\n");
    });
  });

  describe("preview", () => {
    it("returns ignored files from gitService", async () => {
      const handler = getHandler("git:gitignore:preview");
      const result = await handler(null);
      expect(result).toEqual(["node_modules/", "dist/"]);
    });
  });

  describe("templates", () => {
    it("returns gitignore templates", async () => {
      const handler = getHandler("git:gitignore:templates");
      const result = await handler(null);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("patterns");
    });
  });
});
