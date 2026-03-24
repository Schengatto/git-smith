import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockSpawn = vi.fn().mockReturnValue({
  on: vi.fn(),
  unref: vi.fn(),
});
vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const mockGetSettings = vi.fn();
vi.mock("../store", () => ({
  getSettings: () => mockGetSettings(),
}));

const mockGetRepoPath = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: {
    getRepoPath: () => mockGetRepoPath(),
  },
}));

vi.mock("fs", () => ({
  default: {
    accessSync: vi.fn(),
    constants: { F_OK: 0 },
  },
  accessSync: vi.fn(),
  constants: { F_OK: 0 },
}));

import fs from "fs";
import { ipcMain } from "electron";
import { registerEditorHandlers } from "./editor.ipc";
import { IPC } from "../../shared/ipc-channels";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("editor IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerEditorHandlers();
  });

  it("registers EDITOR.LAUNCH and EDITOR.LAUNCH_FILE", () => {
    const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = m.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.EDITOR.LAUNCH);
    expect(channels).toContain(IPC.EDITOR.LAUNCH_FILE);
  });

  describe("EDITOR.LAUNCH", () => {
    it("spawns editor with repo path", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code" });
      const handler = getHandler(IPC.EDITOR.LAUNCH);
      await handler({}, "/repo/path");
      expect(mockSpawn).toHaveBeenCalledWith("code", ["/repo/path"], expect.objectContaining({ detached: true }));
    });

    it("throws when no editor configured", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "" });
      const handler = getHandler(IPC.EDITOR.LAUNCH);
      await expect(handler({}, "/repo")).rejects.toThrow("No editor configured");
    });

    it("validates absolute path exists", async () => {
      vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error("ENOENT"); });
      mockGetSettings.mockReturnValue({ editorPath: "/usr/bin/myeditor" });
      const handler = getHandler(IPC.EDITOR.LAUNCH);
      await expect(handler({}, "/repo")).rejects.toThrow("Editor not found: /usr/bin/myeditor");
    });

    it("allows bare executable names without path validation", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code" });
      const handler = getHandler(IPC.EDITOR.LAUNCH);
      await handler({}, "/repo");
      expect(fs.accessSync).not.toHaveBeenCalled();
    });
  });

  describe("EDITOR.LAUNCH_FILE", () => {
    it("spawns editor with resolved file path using $FILE placeholder", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code", editorArgs: "$FILE" });
      mockGetRepoPath.mockReturnValue("/repo");
      const handler = getHandler(IPC.EDITOR.LAUNCH_FILE);
      await handler({}, "src/index.ts");
      expect(mockSpawn).toHaveBeenCalled();
      const spawnArgs = mockSpawn.mock.calls[0]!;
      expect(spawnArgs[0]).toBe("code");
      expect(spawnArgs[1][0]).toContain("index.ts");
    });

    it("throws when no repository open", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code", editorArgs: "$FILE" });
      mockGetRepoPath.mockReturnValue(null);
      const handler = getHandler(IPC.EDITOR.LAUNCH_FILE);
      await expect(handler({}, "file.ts")).rejects.toThrow("No repository open");
    });

    it("throws on invalid characters in args", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code", editorArgs: "$FILE; rm -rf /" });
      mockGetRepoPath.mockReturnValue("/repo");
      const handler = getHandler(IPC.EDITOR.LAUNCH_FILE);
      await expect(handler({}, "file.ts")).rejects.toThrow("Editor arguments contain invalid characters");
    });

    it("falls back to quoting file path when no $FILE placeholder", async () => {
      mockGetSettings.mockReturnValue({ editorPath: "code", editorArgs: "--goto" });
      mockGetRepoPath.mockReturnValue("/repo");
      const handler = getHandler(IPC.EDITOR.LAUNCH_FILE);
      await handler({}, "file.ts");
      expect(mockSpawn).toHaveBeenCalled();
    });
  });
});
