import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockFormatPatch = vi.fn();
const mockApplyPatch = vi.fn();
const mockPreviewPatch = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    formatPatch: (...args: unknown[]) => mockFormatPatch(...args),
    applyPatch: (...args: unknown[]) => mockApplyPatch(...args),
    previewPatch: (...args: unknown[]) => mockPreviewPatch(...args),
  },
}));

import { ipcMain } from "electron";
import { registerPatchHandlers } from "./git-patch.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("patch IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all patch channels", () => {
    registerPatchHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.PATCH.CREATE);
    expect(channels).toContain(IPC.PATCH.APPLY);
    expect(channels).toContain(IPC.PATCH.PREVIEW);
  });

  it("PATCH.CREATE delegates to gitService.formatPatch", async () => {
    mockFormatPatch.mockResolvedValueOnce(["/tmp/0001-fix.patch"]);
    registerPatchHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PATCH.CREATE);
    const result = await call![1]({}, ["abc123"], "/tmp");
    expect(mockFormatPatch).toHaveBeenCalledWith(["abc123"], "/tmp");
    expect(result).toEqual(["/tmp/0001-fix.patch"]);
  });

  it("PATCH.APPLY delegates to gitService.applyPatch", async () => {
    mockApplyPatch.mockResolvedValueOnce("");
    registerPatchHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PATCH.APPLY);
    await call![1]({}, "/tmp/fix.patch", true);
    expect(mockApplyPatch).toHaveBeenCalledWith("/tmp/fix.patch", true);
  });

  it("PATCH.PREVIEW delegates to gitService.previewPatch", async () => {
    mockPreviewPatch.mockResolvedValueOnce(" file.ts | 3 +++");
    registerPatchHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PATCH.PREVIEW);
    const result = await call![1]({}, "/tmp/fix.patch");
    expect(mockPreviewPatch).toHaveBeenCalledWith("/tmp/fix.patch");
    expect(result).toBe(" file.ts | 3 +++");
  });
});
