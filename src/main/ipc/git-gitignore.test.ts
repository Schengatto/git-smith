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
vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: () => mockGetRepoPath(),
  },
}));

import { ipcMain } from "electron";
import { registerGitignoreHandlers } from "./git-gitignore.ipc";

describe("git-gitignore IPC handler", () => {
  let tmpDir: string;
  let addHandler: (event: unknown, pattern: string) => Promise<void>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitignore-test-"));
    mockGetRepoPath.mockReturnValue(tmpDir);

    // Register handlers and capture the callback
    registerGitignoreHandlers();
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find(
      (c: unknown[]) => c[0] === "git:gitignore:add"
    );
    addHandler = call![1];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("creates .gitignore if it does not exist", async () => {
    await addHandler(null, "node_modules/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe("node_modules/\n");
  });

  it("appends pattern to existing .gitignore", async () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\n", "utf-8");
    await addHandler(null, "dist/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe("*.log\ndist/\n");
  });

  it("does not duplicate existing pattern", async () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log\ndist/\n", "utf-8");
    await addHandler(null, "dist/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe("*.log\ndist/\n");
  });

  it("handles .gitignore without trailing newline", async () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "*.log", "utf-8");
    await addHandler(null, "dist/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toBe("*.log\ndist/\n");
  });

  it("throws if no repo is open", async () => {
    mockGetRepoPath.mockReturnValue(null);
    await expect(addHandler(null, "foo")).rejects.toThrow("No repository open");
  });
});
