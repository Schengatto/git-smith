import { describe, it, expect } from "vitest";
import { parseChangelog } from "./changelog-parser";
import type { ChangelogEntry } from "../../shared/git-types";

function makeEntry(overrides: Partial<ChangelogEntry> & { subject: string }): ChangelogEntry {
  return {
    hash: "abc1234567890",
    abbreviatedHash: "abc1234",
    description: "",
    type: "other",
    breaking: false,
    authorName: "Test Author",
    authorDate: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("parseChangelog", () => {
  it("groups feat commits under Features", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: add changelog dialog" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const feats = result.groups.find((g) => g.label === "Features");
    expect(feats).toBeDefined();
    expect(feats!.entries).toHaveLength(1);
    expect(feats!.entries[0].description).toBe("add changelog dialog");
    expect(feats!.entries[0].type).toBe("feat");
  });

  it("groups fix commits under Bug Fixes", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "fix: broken graph lines" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const fixes = result.groups.find((g) => g.label === "Bug Fixes");
    expect(fixes).toBeDefined();
    expect(fixes!.entries[0].description).toBe("broken graph lines");
  });

  it("extracts scope from conventional commit", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat(auth): add login flow" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const feats = result.groups.find((g) => g.label === "Features");
    expect(feats!.entries[0].scope).toBe("auth");
    expect(feats!.entries[0].description).toBe("add login flow");
  });

  it("detects breaking change via ! suffix", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat!: remove legacy API" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const breaking = result.groups.find((g) => g.label === "Breaking Changes");
    expect(breaking).toBeDefined();
    expect(breaking!.entries[0].breaking).toBe(true);
  });

  it("detects breaking change via BREAKING CHANGE in body", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({
        subject: "refactor: change auth middleware",
        description: "BREAKING CHANGE: session tokens no longer stored",
      }),
    ];
    entries[0].description = "BREAKING CHANGE: session tokens no longer stored";
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const breaking = result.groups.find((g) => g.label === "Breaking Changes");
    expect(breaking).toBeDefined();
  });

  it("puts non-conventional commits in Other group", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "update readme" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const other = result.groups.find((g) => g.label === "Other");
    expect(other).toBeDefined();
    expect(other!.entries[0].description).toBe("update readme");
  });

  it("groups chore, build, ci under Maintenance", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "chore: update deps" }),
      makeEntry({ subject: "build: fix webpack config" }),
      makeEntry({ subject: "ci: add GitHub Actions" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const maint = result.groups.find((g) => g.label === "Maintenance");
    expect(maint).toBeDefined();
    expect(maint!.entries).toHaveLength(3);
  });

  it("omits empty groups from output", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: only feature" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.groups.every((g) => g.entries.length > 0)).toBe(true);
  });

  it("calculates totalCommits and unique authors", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: one", authorName: "Alice" }),
      makeEntry({ subject: "fix: two", authorName: "Bob" }),
      makeEntry({ subject: "feat: three", authorName: "Alice" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.totalCommits).toBe(3);
    expect(result.authors).toEqual(["Alice", "Bob"]);
  });

  it("sets from and to in result", () => {
    const result = parseChangelog([], "v1.0.0", "v2.0.0");
    expect(result.from).toBe("v1.0.0");
    expect(result.to).toBe("v2.0.0");
  });

  it("puts Breaking Changes group first", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat: normal feature" }),
      makeEntry({ subject: "fix!: breaking fix" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    expect(result.groups[0].label).toBe("Breaking Changes");
  });

  it("does not duplicate breaking commits in their type group", () => {
    const entries: ChangelogEntry[] = [
      makeEntry({ subject: "feat!: remove legacy API" }),
      makeEntry({ subject: "feat: add new API" }),
    ];
    const result = parseChangelog(entries, "v1.0.0", "abc1234");
    const breaking = result.groups.find((g) => g.label === "Breaking Changes");
    const feats = result.groups.find((g) => g.label === "Features");
    expect(breaking!.entries).toHaveLength(1);
    expect(feats!.entries).toHaveLength(1);
    expect(feats!.entries[0].description).toBe("add new API");
  });
});
