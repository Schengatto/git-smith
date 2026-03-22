import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetRepoPath = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: { getRepoPath: () => mockGetRepoPath() },
}));

import { ipcMain } from "electron";
import { registerHooksHandlers } from "./git-hooks.ipc";

function getHandler(channel: string) {
  const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call![1];
}

describe("git-hooks IPC handlers", () => {
  let tmpDir: string;
  let hooksDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-test-"));
    hooksDir = path.join(tmpDir, ".git", "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    // Create a minimal .git/config
    fs.writeFileSync(path.join(tmpDir, ".git", "config"), "[core]\n", "utf-8");
    mockGetRepoPath.mockReturnValue(tmpDir);
    registerHooksHandlers();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns known hooks with active status", async () => {
      fs.writeFileSync(path.join(hooksDir, "pre-commit"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });
      fs.writeFileSync(path.join(hooksDir, "pre-push.sample"), "#!/bin/sh\n", {
        mode: 0o755,
      });
      const handler = getHandler("git:hooks:list");
      const result = await handler(null);
      const preCommit = result.find((h: { name: string }) => h.name === "pre-commit");
      const prePush = result.find((h: { name: string }) => h.name === "pre-push");
      expect(preCommit.active).toBe(true);
      expect(preCommit.content).toContain("exit 0");
      expect(prePush.active).toBe(false);
    });
  });

  describe("write", () => {
    it("creates a hook file with executable permission", async () => {
      const handler = getHandler("git:hooks:write");
      await handler(null, "pre-commit", "#!/bin/sh\necho test\n");
      const hookPath = path.join(hooksDir, "pre-commit");
      expect(fs.existsSync(hookPath)).toBe(true);
      expect(fs.readFileSync(hookPath, "utf-8")).toContain("echo test");
    });
  });

  describe("toggle", () => {
    it("deactivates an active hook by renaming to .sample", async () => {
      fs.writeFileSync(path.join(hooksDir, "pre-commit"), "#!/bin/sh\n", { mode: 0o755 });
      const handler = getHandler("git:hooks:toggle");
      const result = await handler(null, "pre-commit");
      expect(result).toBe(false);
      expect(fs.existsSync(path.join(hooksDir, "pre-commit.sample"))).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, "pre-commit"))).toBe(false);
    });

    it("activates a sample hook", async () => {
      fs.writeFileSync(path.join(hooksDir, "pre-push.sample"), "#!/bin/sh\n", {
        mode: 0o755,
      });
      const handler = getHandler("git:hooks:toggle");
      const result = await handler(null, "pre-push");
      expect(result).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, "pre-push"))).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, "pre-push.sample"))).toBe(false);
    });
  });

  describe("delete", () => {
    it("removes both active and sample files", async () => {
      fs.writeFileSync(path.join(hooksDir, "pre-commit"), "#!/bin/sh\n", { mode: 0o755 });
      const handler = getHandler("git:hooks:delete");
      await handler(null, "pre-commit");
      expect(fs.existsSync(path.join(hooksDir, "pre-commit"))).toBe(false);
    });
  });

  describe("read", () => {
    it("reads content of active hook", async () => {
      fs.writeFileSync(path.join(hooksDir, "commit-msg"), "#!/bin/sh\ncheck msg\n", {
        mode: 0o755,
      });
      const handler = getHandler("git:hooks:read");
      const result = await handler(null, "commit-msg");
      expect(result).toContain("check msg");
    });

    it("returns empty for non-existent hook", async () => {
      const handler = getHandler("git:hooks:read");
      const result = await handler(null, "nonexistent-hook");
      expect(result).toBe("");
    });
  });
});
