import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockGrep = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: { grep: (...args: unknown[]) => mockGrep(...args) },
}));

import { ipcMain } from "electron";
import { registerGrepHandlers } from "./git-grep.ipc";

describe("git-grep IPC handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerGrepHandlers();
  });

  it("registers the search handler", () => {
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain("git:grep:search");
  });

  it("calls gitService.grep with pattern and options", async () => {
    mockGrep.mockResolvedValue({ matches: [], totalCount: 0 });
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:grep:search");
    const handler = call![1];
    const options = { ignoreCase: true, maxCount: 100 };
    await handler(null, "searchTerm", options);
    expect(mockGrep).toHaveBeenCalledWith("searchTerm", options);
  });

  it("passes empty object when options is undefined", async () => {
    mockGrep.mockResolvedValue({ matches: [], totalCount: 0 });
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:grep:search");
    const handler = call![1];
    await handler(null, "searchTerm");
    expect(mockGrep).toHaveBeenCalledWith("searchTerm", {});
  });

  it("returns grep results", async () => {
    const result = { matches: [{ file: "a.ts", line: 1, text: "hello" }], totalCount: 1 };
    mockGrep.mockResolvedValue(result);
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === "git:grep:search");
    const handler = call![1];
    const res = await handler(null, "hello", {});
    expect(res).toEqual(result);
  });
});
