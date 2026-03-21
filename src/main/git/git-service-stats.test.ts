import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn().mockResolvedValue("");

vi.mock("simple-git", () => {
  const fn = () => ({ raw: mockRaw });
  fn.default = fn;
  return { default: fn };
});

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

import { GitService } from "./git-service";

// Helper to build a fake shortstat output block
function makeShortstatOutput(commits: { hash: string; name: string; email: string; date: string; added: number; removed: number }[]): string {
  return commits
    .map(
      (c) =>
        `COMMIT_START\n${c.hash}\n${c.name}\n${c.email}\n${c.date}\n 1 file changed, ${c.added} insertions(+), ${c.removed} deletions(-)`
    )
    .join("\n");
}

describe("GitService.getLeaderboard", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("returns empty array when git output is empty", async () => {
    mockRaw.mockResolvedValueOnce("");
    const result = await service.getLeaderboard("all");
    expect(result).toEqual([]);
  });

  it("parses a single commit and returns one leaderboard entry", async () => {
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        {
          hash: "abc123",
          name: "Alice",
          email: "alice@example.com",
          date: "2026-03-15T10:00:00+00:00",
          added: 50,
          removed: 10,
        },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result).toHaveLength(1);
    expect(result[0]!.authorName).toBe("Alice");
    expect(result[0]!.authorEmail).toBe("alice@example.com");
    expect(result[0]!.commits).toBe(1);
    expect(result[0]!.linesAdded).toBe(50);
    expect(result[0]!.linesRemoved).toBe(10);
    expect(result[0]!.rank).toBe(1);
    expect(result[0]!.gravatarHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("aggregates multiple commits from the same author", async () => {
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        { hash: "a1", name: "Alice", email: "alice@example.com", date: "2026-03-15T10:00:00+00:00", added: 30, removed: 5 },
        { hash: "a2", name: "Alice", email: "alice@example.com", date: "2026-03-16T10:00:00+00:00", added: 20, removed: 5 },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result).toHaveLength(1);
    expect(result[0]!.commits).toBe(2);
    expect(result[0]!.linesAdded).toBe(50);
    expect(result[0]!.linesRemoved).toBe(10);
  });

  it("sorts by commits descending and assigns ranks", async () => {
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        { hash: "b1", name: "Bob", email: "bob@example.com", date: "2026-03-15T10:00:00+00:00", added: 10, removed: 0 },
        { hash: "a1", name: "Alice", email: "alice@example.com", date: "2026-03-14T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "a2", name: "Alice", email: "alice@example.com", date: "2026-03-15T10:00:00+00:00", added: 5, removed: 0 },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result[0]!.authorName).toBe("Alice");
    expect(result[0]!.rank).toBe(1);
    expect(result[0]!.commits).toBe(2);
    expect(result[1]!.authorName).toBe("Bob");
    expect(result[1]!.rank).toBe(2);
  });

  it("passes --since flag for week timeframe", async () => {
    mockRaw.mockResolvedValueOnce("");
    await service.getLeaderboard("week");
    const callArgs = mockRaw.mock.calls[0]![0] as string[];
    expect(callArgs.some((a) => a.startsWith("--since="))).toBe(true);
  });

  it("passes --since flag for month timeframe", async () => {
    mockRaw.mockResolvedValueOnce("");
    await service.getLeaderboard("month");
    const callArgs = mockRaw.mock.calls[0]![0] as string[];
    expect(callArgs.some((a) => a.startsWith("--since="))).toBe(true);
  });

  it("does not pass --since flag for all timeframe", async () => {
    mockRaw.mockResolvedValueOnce("");
    await service.getLeaderboard("all");
    const callArgs = mockRaw.mock.calls[0]![0] as string[];
    expect(callArgs.some((a) => a.startsWith("--since="))).toBe(false);
  });

  it("calculates longest streak correctly for consecutive days", async () => {
    // 3 consecutive days = streak of 3
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        { hash: "c1", name: "Carol", email: "carol@example.com", date: "2026-03-13T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "c2", name: "Carol", email: "carol@example.com", date: "2026-03-14T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "c3", name: "Carol", email: "carol@example.com", date: "2026-03-15T10:00:00+00:00", added: 5, removed: 0 },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result[0]!.longestStreak).toBe(3);
  });

  it("calculates longest streak correctly with a gap", async () => {
    // gap on March 14 → streaks of 1, 1, 1 = longest 1... actually 2 consecutive on 13+15 is not consecutive
    // 13, 15, 16 → streak of 2 (15+16)
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        { hash: "d1", name: "Dave", email: "dave@example.com", date: "2026-03-13T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "d2", name: "Dave", email: "dave@example.com", date: "2026-03-15T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "d3", name: "Dave", email: "dave@example.com", date: "2026-03-16T10:00:00+00:00", added: 5, removed: 0 },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result[0]!.longestStreak).toBe(2);
  });

  it("records firstCommitDate and lastCommitDate correctly", async () => {
    mockRaw.mockResolvedValueOnce(
      makeShortstatOutput([
        { hash: "e1", name: "Eve", email: "eve@example.com", date: "2026-01-01T10:00:00+00:00", added: 5, removed: 0 },
        { hash: "e2", name: "Eve", email: "eve@example.com", date: "2026-03-15T10:00:00+00:00", added: 5, removed: 0 },
      ])
    );
    const result = await service.getLeaderboard("all");
    expect(result[0]!.firstCommitDate).toBe("2026-01-01T10:00:00+00:00");
    expect(result[0]!.lastCommitDate).toBe("2026-03-15T10:00:00+00:00");
  });

  it("handles commits with no stat line (e.g. merge commits)", async () => {
    const output = `COMMIT_START\nabc\nAlice\nalice@example.com\n2026-03-15T10:00:00+00:00`;
    mockRaw.mockResolvedValueOnce(output);
    const result = await service.getLeaderboard("all");
    expect(result).toHaveLength(1);
    expect(result[0]!.linesAdded).toBe(0);
    expect(result[0]!.linesRemoved).toBe(0);
  });
});

// -----------------------------------------------------------------------
// Helper to build a fake numstat output block for getAuthorDetail tests
// -----------------------------------------------------------------------
function makeNumstatOutput(
  commits: {
    name: string;
    date: string;
    email: string;
    files: { added: number; removed: number; path: string }[];
  }[]
): string {
  return commits
    .map((c) => {
      const header = `COMMIT_START\n${c.name}\n${c.date}\n${c.email}`;
      const fileLines = c.files.map((f) => `${f.added}\t${f.removed}\t${f.path}`).join("\n");
      return fileLines ? `${header}\n${fileLines}` : header;
    })
    .join("\n");
}

describe("GitService.getAuthorDetail", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("returns empty/default result when output is empty", async () => {
    mockRaw.mockResolvedValueOnce("");
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.commitTimeline).toEqual([]);
    expect(result.topFiles).toEqual([]);
    expect(result.linesAdded).toBe(0);
    expect(result.linesRemoved).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.currentStreak).toBe(0);
  });

  it("parses commits and aggregates lines and files", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        {
          name: "Alice",
          date: "2026-03-15T10:00:00+00:00",
          email: "alice@example.com",
          files: [
            { added: 20, removed: 5, path: "src/index.ts" },
            { added: 10, removed: 2, path: "src/utils.ts" },
          ],
        },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.linesAdded).toBe(30);
    expect(result.linesRemoved).toBe(7);
    expect(result.authorName).toBe("Alice");
    expect(result.authorEmail).toBe("alice@example.com");
  });

  it("builds topFiles with aggregated change counts, limited to 10", async () => {
    const files = Array.from({ length: 12 }, (_, i) => ({
      added: 10 + i,
      removed: 1,
      path: `file${i}.ts`,
    }));
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-03-15T10:00:00+00:00", email: "alice@example.com", files },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.topFiles.length).toBeLessThanOrEqual(10);
  });

  it("builds hourlyDistribution with 24 elements", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-03-15T14:30:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.hourlyDistribution).toHaveLength(24);
    expect(result.hourlyDistribution[14]).toBe(1);
  });

  it("builds dailyDistribution with 7 elements", async () => {
    // 2026-03-15 is a Sunday (UTC day = 0)
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-03-15T10:00:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.dailyDistribution).toHaveLength(7);
    const dayIndex = new Date("2026-03-15T10:00:00+00:00").getUTCDay();
    expect(result.dailyDistribution[dayIndex]).toBe(1);
  });

  it("passes --author= with email and filters by exact email in post-processing", async () => {
    mockRaw.mockResolvedValueOnce("");
    await service.getAuthorDetail("alice@example.com", "all");
    const callArgs = mockRaw.mock.calls[0]![0] as string[];
    const authorArg = callArgs.find((a) => a.startsWith("--author="));
    expect(authorArg).toBe("--author=alice@example.com");
  });

  it("calculates longestStreak for consecutive days", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-03-13T10:00:00+00:00", email: "alice@example.com", files: [] },
        { name: "Alice", date: "2026-03-14T10:00:00+00:00", email: "alice@example.com", files: [] },
        { name: "Alice", date: "2026-03-15T10:00:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.longestStreak).toBe(3);
  });

  it("calculates currentStreak counting from today backward", async () => {
    // Use a date that is in the past to ensure currentStreak = 0
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2020-01-01T10:00:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.currentStreak).toBe(0);
  });

  it("calculates avgCommitSize correctly", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        {
          name: "Alice",
          date: "2026-03-15T10:00:00+00:00",
          email: "alice@example.com",
          files: [{ added: 10, removed: 5, path: "a.ts" }],
        },
        {
          name: "Alice",
          date: "2026-03-16T10:00:00+00:00",
          email: "alice@example.com",
          files: [{ added: 30, removed: 10, path: "b.ts" }],
        },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    // commit1: 15 lines total, commit2: 40 lines total, avg = (15+40)/2 = 27.5
    expect(result.avgCommitSize).toBe(27.5);
  });

  it("groups commitTimeline by day for month timeframe", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-03-15T10:00:00+00:00", email: "alice@example.com", files: [] },
        { name: "Alice", date: "2026-03-15T14:00:00+00:00", email: "alice@example.com", files: [] },
        { name: "Alice", date: "2026-03-16T10:00:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "month");
    // Two distinct days
    expect(result.commitTimeline.length).toBe(2);
    const day15 = result.commitTimeline.find((t) => t.date === "2026-03-15");
    expect(day15?.count).toBe(2);
  });

  it("stores firstCommitDate and lastCommitDate", async () => {
    mockRaw.mockResolvedValueOnce(
      makeNumstatOutput([
        { name: "Alice", date: "2026-01-01T10:00:00+00:00", email: "alice@example.com", files: [] },
        { name: "Alice", date: "2026-03-15T10:00:00+00:00", email: "alice@example.com", files: [] },
      ])
    );
    const result = await service.getAuthorDetail("alice@example.com", "all");
    expect(result.firstCommitDate).toBe("2026-01-01T10:00:00+00:00");
    expect(result.lastCommitDate).toBe("2026-03-15T10:00:00+00:00");
  });
});
