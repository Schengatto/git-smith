import { describe, it, expect } from "vitest";
import type { CommitInfo } from "../../../shared/git-types";

describe("Author Filter logic", () => {
  const commits: Pick<CommitInfo, "authorName" | "authorEmail">[] = [
    { authorName: "Alice", authorEmail: "alice@example.com" },
    { authorName: "Bob", authorEmail: "bob@example.com" },
    { authorName: "Alice", authorEmail: "alice@example.com" },
    { authorName: "Charlie", authorEmail: "charlie@example.com" },
  ];

  describe("unique authors extraction", () => {
    it("should extract unique authors sorted by name", () => {
      const authors = new Map<string, string>();
      for (const c of commits) {
        if (c.authorName && !authors.has(c.authorName)) {
          authors.set(c.authorName, c.authorEmail || "");
        }
      }
      const result = Array.from(authors.entries())
        .map(([name, email]) => ({ name, email }))
        .sort((a, b) => a.name.localeCompare(b.name));

      expect(result).toEqual([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
        { name: "Charlie", email: "charlie@example.com" },
      ]);
    });
  });

  describe("filter mode", () => {
    const rows = commits.map((c, i) => ({
      commit: { ...c, hash: `hash${i}` },
    }));

    it("should filter rows by author in filter mode", () => {
      const authorFilter = "Alice";
      const filtered = rows.filter((r) => r.commit.authorName === authorFilter);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.commit.authorName === "Alice")).toBe(true);
    });

    it("should return all rows when no filter set", () => {
      const authorFilter = null;
      const filtered = authorFilter
        ? rows.filter((r) => r.commit.authorName === authorFilter)
        : rows;
      expect(filtered).toHaveLength(4);
    });

    it("should return empty when filtering for non-existent author", () => {
      const authorFilter = "Nobody";
      const filtered = rows.filter((r) => r.commit.authorName === authorFilter);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("highlight mode", () => {
    it("should dim non-matching rows", () => {
      const authorFilter = "Alice";
      const authorFilterMode = "highlight";
      const row = { commit: { authorName: "Bob" } };
      const dimmed =
        authorFilter &&
        authorFilterMode === "highlight" &&
        row.commit.authorName !== authorFilter;
      expect(dimmed).toBeTruthy();
    });

    it("should not dim matching rows", () => {
      const authorFilter = "Alice";
      const authorFilterMode = "highlight";
      const row = { commit: { authorName: "Alice" } };
      const dimmed =
        authorFilter &&
        authorFilterMode === "highlight" &&
        row.commit.authorName !== authorFilter;
      expect(dimmed).toBeFalsy();
    });

    it("should not dim any rows when no filter set", () => {
      const authorFilter = null;
      const authorFilterMode = "highlight";
      const row = { commit: { authorName: "Bob" } };
      const dimmed =
        authorFilter &&
        authorFilterMode === "highlight" &&
        row.commit.authorName !== authorFilter;
      expect(dimmed).toBeFalsy();
    });
  });
});
