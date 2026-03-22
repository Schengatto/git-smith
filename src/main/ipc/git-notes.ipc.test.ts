import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGetNote = vi.fn();
const mockAddNote = vi.fn();
const mockRemoveNote = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    getNote: (...args: unknown[]) => mockGetNote(...args),
    addNote: (...args: unknown[]) => mockAddNote(...args),
    removeNote: (...args: unknown[]) => mockRemoveNote(...args),
  },
}));

import { ipcMain } from "electron";
import { registerNotesHandlers } from "./git-notes.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("notes IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all notes channels", () => {
    registerNotesHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.NOTES.GET);
    expect(channels).toContain(IPC.NOTES.ADD);
    expect(channels).toContain(IPC.NOTES.REMOVE);
  });

  it("NOTES.GET delegates to gitService.getNote", async () => {
    mockGetNote.mockResolvedValueOnce("This is a note");
    registerNotesHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.NOTES.GET);
    const result = await call![1]({}, "abc123");
    expect(mockGetNote).toHaveBeenCalledWith("abc123");
    expect(result).toBe("This is a note");
  });

  it("NOTES.ADD delegates to gitService.addNote", async () => {
    mockAddNote.mockResolvedValueOnce(undefined);
    registerNotesHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.NOTES.ADD);
    await call![1]({}, "abc123", "My note");
    expect(mockAddNote).toHaveBeenCalledWith("abc123", "My note");
  });

  it("NOTES.REMOVE delegates to gitService.removeNote", async () => {
    mockRemoveNote.mockResolvedValueOnce(undefined);
    registerNotesHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.NOTES.REMOVE);
    await call![1]({}, "abc123");
    expect(mockRemoveNote).toHaveBeenCalledWith("abc123");
  });
});
