import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockVerify = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    verifyCommitSignature: (...args: unknown[]) => mockVerify(...args),
  },
}));

import { ipcMain } from "electron";
import { registerGpgHandlers } from "./git-gpg.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("GPG IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers GPG.VERIFY channel", () => {
    registerGpgHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.GPG.VERIFY);
  });

  it("GPG.VERIFY delegates to gitService.verifyCommitSignature", async () => {
    const sig = { signed: true, key: "ABCD1234", status: "G", signer: "Test User" };
    mockVerify.mockResolvedValueOnce(sig);
    registerGpgHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.GPG.VERIFY);
    const result = await call![1]({}, "abc123");
    expect(mockVerify).toHaveBeenCalledWith("abc123");
    expect(result).toEqual(sig);
  });
});
