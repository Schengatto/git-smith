import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("electron", () => ({ ipcMain: { handle: vi.fn() } }));

const mockGetRepoPath = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: { getRepoPath: () => mockGetRepoPath() },
}));

import { ipcMain } from "electron";
import { registerReviewHandlers } from "./review.ipc";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("review IPC handlers", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-"));
    fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
    mockGetRepoPath.mockReturnValue(tmpDir);
    registerReviewHandlers();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("saves and loads review comments", async () => {
    const save = getHandler("review:comments:save");
    const load = getHandler("review:comments:load");
    const comments = [
      {
        id: "1",
        file: "a.ts",
        line: 10,
        body: "Fix this",
        severity: "issue",
        createdAt: "2026-01-01",
      },
    ];
    await save(null, "abc123", comments);
    const result = await load(null, "abc123");
    expect(result.comments).toEqual(comments);
    expect(result.commitHash).toBe("abc123");
  });

  it("returns null for non-existent review", async () => {
    const load = getHandler("review:comments:load");
    const result = await load(null, "nonexistent");
    expect(result).toBeNull();
  });

  it("clears review", async () => {
    const save = getHandler("review:comments:save");
    const clear = getHandler("review:comments:clear");
    const load = getHandler("review:comments:load");
    await save(null, "abc123", []);
    await clear(null, "abc123");
    const result = await load(null, "abc123");
    expect(result).toBeNull();
  });

  it("lists reviews", async () => {
    const save = getHandler("review:comments:save");
    const list = getHandler("review:comments:list");
    await save(null, "abc123", []);
    await save(null, "def456", []);
    const result = await list(null);
    expect(result).toContain("abc123");
    expect(result).toContain("def456");
  });
});
