import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({ ipcMain: { handle: vi.fn() } }));

const mockTimeline = vi.fn();
const mockChurn = vi.fn();
const mockContributors = vi.fn();
vi.mock("../git/git-service", () => ({
  gitService: {
    getTimeline: (...a: unknown[]) => mockTimeline(...a),
    getChurn: (...a: unknown[]) => mockChurn(...a),
    getContributorsTimeline: (...a: unknown[]) => mockContributors(...a),
  },
}));

import { ipcMain } from "electron";
import { registerStatsAdvancedHandlers } from "./stats-advanced.ipc";

function getHandler(ch: string) {
  const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  return m.mock.calls.find((c: unknown[]) => c[0] === ch)![1];
}

describe("stats-advanced IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerStatsAdvancedHandlers();
  });

  it("registers all 3 handlers", () => {
    const m = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const ch = m.mock.calls.map((c: unknown[]) => c[0]);
    expect(ch).toContain("git:stats:timeline");
    expect(ch).toContain("git:stats:churn");
    expect(ch).toContain("git:stats:contributors-timeline");
  });

  it("timeline calls gitService", async () => {
    mockTimeline.mockResolvedValue([{ date: "2026-01", count: 5 }]);
    const res = await getHandler("git:stats:timeline")(null, "month");
    expect(mockTimeline).toHaveBeenCalledWith("month");
    expect(res).toEqual([{ date: "2026-01", count: 5 }]);
  });

  it("churn calls gitService", async () => {
    mockChurn.mockResolvedValue([]);
    await getHandler("git:stats:churn")(null, "week");
    expect(mockChurn).toHaveBeenCalledWith("week");
  });

  it("contributors calls gitService", async () => {
    mockContributors.mockResolvedValue([]);
    await getHandler("git:stats:contributors-timeline")(null);
    expect(mockContributors).toHaveBeenCalledWith(undefined);
  });
});
