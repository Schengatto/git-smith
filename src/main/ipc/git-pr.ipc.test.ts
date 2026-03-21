import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockDetectProvider = vi.fn();
const mockListPrs = vi.fn();
const mockViewPr = vi.fn();
const mockCreatePr = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    detectProvider: (...args: unknown[]) => mockDetectProvider(...args),
    listPrs: (...args: unknown[]) => mockListPrs(...args),
    viewPr: (...args: unknown[]) => mockViewPr(...args),
    createPr: (...args: unknown[]) => mockCreatePr(...args),
  },
}));

import { ipcMain } from "electron";
import { registerPrHandlers } from "./git-pr.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("PR IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all PR channels", () => {
    registerPrHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.PR.DETECT_PROVIDER);
    expect(channels).toContain(IPC.PR.LIST);
    expect(channels).toContain(IPC.PR.VIEW);
    expect(channels).toContain(IPC.PR.CREATE);
  });

  it("PR.DETECT_PROVIDER delegates to gitService.detectProvider", async () => {
    const mockResult = { provider: "github", owner: "user", repo: "repo", baseUrl: "https://github.com" };
    mockDetectProvider.mockResolvedValueOnce(mockResult);
    registerPrHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PR.DETECT_PROVIDER);
    const handler = call![1];

    const result = await handler({});
    expect(result).toEqual(mockResult);
  });

  it("PR.VIEW delegates to gitService.viewPr", async () => {
    mockViewPr.mockResolvedValueOnce("PR details text");
    registerPrHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PR.VIEW);
    const handler = call![1];

    const result = await handler({}, 42);
    expect(mockViewPr).toHaveBeenCalledWith(42);
    expect(result).toBe("PR details text");
  });

  it("PR.CREATE delegates to gitService.createPr", async () => {
    mockCreatePr.mockResolvedValueOnce("https://github.com/user/repo/pull/1");
    registerPrHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.PR.CREATE);
    const handler = call![1];

    const options = { title: "test", body: "desc", targetBranch: "main", sourceBranch: "feature" };
    const result = await handler({}, options);
    expect(mockCreatePr).toHaveBeenCalledWith(options);
    expect(result).toBe("https://github.com/user/repo/pull/1");
  });
});
