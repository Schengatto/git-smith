import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRaw = vi.fn();

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

describe("GitService.searchCommits", () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
    (service as unknown as Record<string, unknown>)["repoPath"] = "/fake/repo";
    (service as unknown as Record<string, unknown>)["git"] = { raw: mockRaw };
  });

  it("searches by message (--grep)", async () => {
    mockRaw.mockResolvedValue("");
    await service.searchCommits({ grep: "fix bug" });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--grep=fix bug");
    expect(args).toContain("--regexp-ignore-case");
  });

  it("searches by author", async () => {
    mockRaw.mockResolvedValue("");
    await service.searchCommits({ author: "Enrico" });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--author=Enrico");
  });

  it("searches by code change (pickaxe -S)", async () => {
    mockRaw.mockResolvedValue("");
    await service.searchCommits({ code: "myFunction" });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("-SmyFunction");
  });

  it("combines multiple search criteria", async () => {
    mockRaw.mockResolvedValue("");
    await service.searchCommits({ grep: "refactor", author: "Enrico", maxCount: 50 });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--grep=refactor");
    expect(args).toContain("--author=Enrico");
    expect(args).toContain("--max-count=50");
  });

  it("returns empty array for empty result", async () => {
    mockRaw.mockResolvedValue("  ");
    const result = await service.searchCommits({ grep: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("parses commit results correctly", async () => {
    const hash = "a".repeat(40);
    const record = [
      hash,       // hash
      "aaaaaaa",  // abbrev
      "fix: test", // subject
      "Author",   // author name
      "a@b.com",  // author email
      "2026-01-01T00:00:00+00:00", // author date
      "2026-01-01T00:00:00+00:00", // committer date
      "",         // parent hashes
      "",         // refs
      "fix: test", // body
    ].join("\0");

    mockRaw.mockResolvedValue(`\x1e${record}`);
    const result = await service.searchCommits({ grep: "fix" });
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe(hash);
    expect(result[0]!.subject).toBe("fix: test");
    expect(result[0]!.authorName).toBe("Author");
  });

  it("uses default maxCount of 200", async () => {
    mockRaw.mockResolvedValue("");
    await service.searchCommits({ grep: "test" });
    const args = mockRaw.mock.calls[0]![0] as string[];
    expect(args).toContain("--max-count=200");
  });
});
