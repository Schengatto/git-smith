import { describe, it, expect } from "vitest";
import { parseHunks, buildPatch } from "./HunkStagingView";

describe("parseHunks", () => {
  it("parses a simple unified diff into header and hunks", () => {
    const diff = [
      "diff --git a/file.txt b/file.txt",
      "index abc..def 100644",
      "--- a/file.txt",
      "+++ b/file.txt",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old",
      "+new",
      " line3",
    ].join("\n");

    const { header, hunks } = parseHunks(diff);
    expect(header).toEqual([
      "diff --git a/file.txt b/file.txt",
      "index abc..def 100644",
      "--- a/file.txt",
      "+++ b/file.txt",
    ]);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].header).toBe("@@ -1,3 +1,3 @@");
    expect(hunks[0].lines).toEqual([" line1", "-old", "+new", " line3"]);
  });
});

describe("buildPatch", () => {
  const header = [
    "diff --git a/file.txt b/file.txt",
    "index abc..def 100644",
    "--- a/file.txt",
    "+++ b/file.txt",
  ];

  it("builds a full hunk patch when no lines are selected", () => {
    const hunk = {
      header: "@@ -1,3 +1,3 @@",
      lines: [" line1", "-old", "+new", " line3"],
      startIndex: 4,
    };
    const patch = buildPatch(header, hunk);
    expect(patch).toContain("@@ -1,3 +1,3 @@");
    expect(patch).toContain("-old");
    expect(patch).toContain("+new");
  });

  it("builds a partial patch with selected lines", () => {
    const hunk = {
      header: "@@ -1,3 +1,3 @@",
      lines: [" line1", "-old", "+new", " line3"],
      startIndex: 4,
    };
    // Select only the + line (index 2)
    const patch = buildPatch(header, hunk, new Set([2]));
    expect(patch).toContain("+new");
    // Unselected deletion should be converted to context
    expect(patch).not.toContain("-old");
    expect(patch).toContain(" old");
  });

  it("does not count 'no newline at end of file' marker in line counts", () => {
    const hunk = {
      header: "@@ -1 +1 @@",
      lines: ["-Hello from Branch B", "+Hello from Branch A", "\\ No newline at end of file"],
      startIndex: 4,
    };
    // Select only the + line
    const patch = buildPatch(header, hunk, new Set([1]));
    // The marker should be preserved
    expect(patch).toContain("\\ No newline at end of file");
    // The unselected deletion becomes context (1 old line) + selected addition (1 new line)
    // = oldCount 1, newCount 2. The \ marker must NOT inflate counts.
    expect(patch).toMatch(/@@ -1,1 \+1,2 @@/);
  });

  it("handles no-newline marker with full hunk staging", () => {
    const hunk = {
      header: "@@ -1 +1 @@",
      lines: ["-old", "+new", "\\ No newline at end of file"],
      startIndex: 4,
    };
    // Full hunk — uses original header, should pass through fine
    const patch = buildPatch(header, hunk);
    expect(patch).toContain("@@ -1 +1 @@");
    expect(patch).toContain("\\ No newline at end of file");
  });

  describe("reverse (unstage) mode", () => {
    it("converts unselected additions to context when unstaging", () => {
      const hunk = {
        header: "@@ -1,3 +1,3 @@",
        lines: [" line1", "-old", "+new", " line3"],
        startIndex: 4,
      };
      // Select only the - line (index 1) for unstaging
      const patch = buildPatch(header, hunk, new Set([1]), true);
      expect(patch).toContain("-old");
      // Unselected addition should be converted to context
      expect(patch).not.toContain("+new");
      expect(patch).toContain(" new");
    });

    it("skips unselected deletions when unstaging", () => {
      const hunk = {
        header: "@@ -1,3 +1,3 @@",
        lines: [" line1", "-old", "+new", " line3"],
        startIndex: 4,
      };
      // Select only the + line (index 2) for unstaging
      const patch = buildPatch(header, hunk, new Set([2]), true);
      expect(patch).toContain("+new");
      // Unselected deletion should be skipped entirely
      expect(patch).not.toContain("-old");
      expect(patch).not.toContain(" old");
    });

    it("unstages single deletion line with no-newline marker", () => {
      const hunk = {
        header: "@@ -1 +1 @@",
        lines: ["-Hello from Branch B", "+Hello from Branch A", "\\ No newline at end of file"],
        startIndex: 4,
      };
      // Select the - line (index 0) for unstaging — the exact scenario from the bug
      const patch = buildPatch(header, hunk, new Set([0]), true);
      expect(patch).toContain("-Hello from Branch B");
      // Unselected + line becomes context
      expect(patch).toContain(" Hello from Branch A");
      expect(patch).not.toContain("+Hello from Branch A");
      expect(patch).toContain("\\ No newline at end of file");
      // oldCount=1 (-), newCount=2 (context from +, no count for \)
      // Wait: oldCount=1 (the -), newCount=1 (context from +). The context counts both.
      // Actually: - counts oldCount only, context from + counts both old and new
      expect(patch).toMatch(/@@ -1,2 \+1,1 @@/);
    });
  });
});
