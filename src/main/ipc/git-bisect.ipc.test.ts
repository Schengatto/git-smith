import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockBisectStart = vi.fn();
const mockBisectGood = vi.fn();
const mockBisectBad = vi.fn();
const mockBisectSkip = vi.fn();
const mockBisectReset = vi.fn();
const mockBisectLog = vi.fn();
const mockBisectStatus = vi.fn();

vi.mock("../git/git-service", () => ({
  gitService: {
    bisectStart: (...args: unknown[]) => mockBisectStart(...args),
    bisectGood: (...args: unknown[]) => mockBisectGood(...args),
    bisectBad: (...args: unknown[]) => mockBisectBad(...args),
    bisectSkip: (...args: unknown[]) => mockBisectSkip(...args),
    bisectReset: (...args: unknown[]) => mockBisectReset(...args),
    bisectLog: (...args: unknown[]) => mockBisectLog(...args),
    bisectStatus: (...args: unknown[]) => mockBisectStatus(...args),
  },
}));

import { ipcMain } from "electron";
import { registerBisectHandlers } from "./git-bisect.ipc";
import { IPC } from "../../shared/ipc-channels";

describe("bisect IPC handlers", () => {
  let handleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  });

  it("registers all bisect channels", () => {
    registerBisectHandlers();
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain(IPC.BISECT.START);
    expect(channels).toContain(IPC.BISECT.GOOD);
    expect(channels).toContain(IPC.BISECT.BAD);
    expect(channels).toContain(IPC.BISECT.SKIP);
    expect(channels).toContain(IPC.BISECT.RESET);
    expect(channels).toContain(IPC.BISECT.LOG);
    expect(channels).toContain(IPC.BISECT.STATUS);
  });

  it("BISECT.START delegates to gitService.bisectStart", async () => {
    mockBisectStart.mockResolvedValueOnce("started");
    registerBisectHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.START);
    const result = await call![1]({}, "bad123", "good456");
    expect(mockBisectStart).toHaveBeenCalledWith("bad123", "good456");
    expect(result).toBe("started");
  });

  it("BISECT.GOOD delegates to gitService.bisectGood", async () => {
    mockBisectGood.mockResolvedValueOnce("good result");
    registerBisectHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.GOOD);
    const result = await call![1]({}, "ref123");
    expect(mockBisectGood).toHaveBeenCalledWith("ref123");
    expect(result).toBe("good result");
  });

  it("BISECT.BAD delegates to gitService.bisectBad", async () => {
    mockBisectBad.mockResolvedValueOnce("bad result");
    registerBisectHandlers();
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.BAD);
    const result = await call![1]({}, "ref123");
    expect(mockBisectBad).toHaveBeenCalledWith("ref123");
    expect(result).toBe("bad result");
  });

  it("BISECT.SKIP delegates to gitService.bisectSkip", async () => {
    mockBisectSkip.mockResolvedValueOnce("skip result");
    registerBisectHandlers();
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.SKIP);
    const result = await call![1]({}, "ref123");
    expect(mockBisectSkip).toHaveBeenCalledWith("ref123");
    expect(result).toBe("skip result");
  });

  it("BISECT.RESET delegates to gitService.bisectReset", async () => {
    mockBisectReset.mockResolvedValueOnce("reset");
    registerBisectHandlers();
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.RESET);
    const result = await call![1]({});
    expect(mockBisectReset).toHaveBeenCalled();
    expect(result).toBe("reset");
  });

  it("BISECT.LOG delegates to gitService.bisectLog", async () => {
    mockBisectLog.mockResolvedValueOnce("log output");
    registerBisectHandlers();
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.LOG);
    const result = await call![1]({});
    expect(mockBisectLog).toHaveBeenCalled();
    expect(result).toBe("log output");
  });

  it("BISECT.STATUS delegates to gitService.bisectStatus", async () => {
    const status = { active: true, good: ["a"], bad: ["b"], current: "c" };
    mockBisectStatus.mockResolvedValueOnce(status);
    registerBisectHandlers();

    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === IPC.BISECT.STATUS);
    const result = await call![1]({});
    expect(mockBisectStatus).toHaveBeenCalled();
    expect(result).toEqual(status);
  });
});
