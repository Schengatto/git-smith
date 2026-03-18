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

  it("strips trailing empty strings from hunk lines (split artifact)", () => {
    // git diff output typically ends with \n, so split("\n") creates a trailing ""
    const diff = [
      "diff --git a/greeting.txt b/greeting.txt",
      "index abc..def 100644",
      "--- a/greeting.txt",
      "+++ b/greeting.txt",
      "@@ -1 +1 @@",
      "-Hello from Branch B",
      "+Hello from Branch A",
      "\\ No newline at end of file",
      "", // trailing artifact from split("\n")
    ].join("\n");

    const { hunks } = parseHunks(diff);
    expect(hunks).toHaveLength(1);
    // The trailing "" should be stripped
    expect(hunks[0].lines).toEqual([
      "-Hello from Branch B",
      "+Hello from Branch A",
      "\\ No newline at end of file",
    ]);
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

  it("drops no-newline marker when the line it applies to is skipped (staging)", () => {
    // Reproduces: "patch does not apply" when staging only a - line from a
    // no-newline-at-eof diff.  The \ marker belongs to the + line; if the +
    // is skipped, the \ must NOT be emitted (it would misapply to the - line).
    const hunk = {
      header: "@@ -1 +1 @@",
      lines: ["-Hello from Branch B", "+Hello from Branch B", "\\ No newline at end of file"],
      startIndex: 4,
    };
    // Select only the - line (index 0) for staging (forward apply)
    const patch = buildPatch(header, hunk, new Set([0]), false);
    // The + line is skipped, so the \ marker must also be dropped
    expect(patch).not.toContain("\\ No newline at end of file");
    expect(patch).toContain("-Hello from Branch B");
    expect(patch).not.toContain("+Hello from Branch B");
    expect(patch).toMatch(/@@ -1,1 \+1,0 @@/);
  });

  it("preserves no-newline marker when the line it applies to is kept as context", () => {
    const hunk = {
      header: "@@ -1 +1 @@",
      lines: ["-Hello from Branch B", "+Hello from Branch A", "\\ No newline at end of file"],
      startIndex: 4,
    };
    // Select only the - line (index 0) for staging; + becomes context
    const patch = buildPatch(header, hunk, new Set([0]));
    // The - was converted to context, \ still applies to it... wait, no:
    // the + is unselected in forward mode → skipped. The - is selected → pushed.
    // Actually: - is selected so it's pushed as -. + is unselected and not reverse → skipped.
    // \ follows + which was skipped → \ dropped.
    expect(patch).not.toContain("\\ No newline at end of file");
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

    it("full hunk unstage works for single-line file (no-newline)", () => {
      // When all + lines are selected for unstaging, handleStageHunk falls back
      // to full hunk (selectedLineIndices=undefined) — verify the full hunk patch is valid
      const hunk = {
        header: "@@ -1 +1 @@",
        lines: ["-Hello from Branch B", "+Hello from Branch A", "\\ No newline at end of file"],
        startIndex: 4,
      };
      const patch = buildPatch(header, hunk, undefined, true);
      expect(patch).toContain("@@ -1 +1 @@");
      expect(patch).toContain("-Hello from Branch B");
      expect(patch).toContain("+Hello from Branch A");
      expect(patch).toContain("\\ No newline at end of file");
    });

    it("partial reverse unstage with trailing empty line does not corrupt hunk header", () => {
      // Reproduces: "Error: error: corrupt patch at line 9" when unstaging
      // a single deletion line from a no-newline-at-eof file.
      // The raw diff ends with \n, so split("\n") produces a trailing "".
      const rawDiff = [
        "diff --git a/greeting.txt b/greeting.txt",
        "index abc..def 100644",
        "--- a/greeting.txt",
        "+++ b/greeting.txt",
        "@@ -1 +1 @@",
        "-Hello from Branch B",
        "+Hello from Branch A",
        "\\ No newline at end of file",
        "", // trailing split artifact
      ].join("\n");

      const { header, hunks } = parseHunks(rawDiff);
      // Select only the - line (index 0) for reverse unstage
      const patch = buildPatch(header, hunks[0], new Set([0]), true);
      // Must be @@ -1,2 +1,1 @@ — NOT @@ -1,3 +1,2 @@ (which was the bug)
      expect(patch).toMatch(/@@ -1,2 \+1,1 @@/);
      expect(patch).toContain("-Hello from Branch B");
      expect(patch).toContain(" Hello from Branch A");
      expect(patch).toContain("\\ No newline at end of file");
    });

    it("partial reverse patch with only + selected produces oldCount=0 (invalid)", () => {
      // This documents WHY handleStageHunk detects all-+ selected and falls back
      // to full hunk: a partial reverse patch with only + lines has oldCount=0
      const hunk = {
        header: "@@ -1 +1 @@",
        lines: ["-Hello from Branch B", "+Hello from Branch A", "\\ No newline at end of file"],
        startIndex: 4,
      };
      // Selecting only the + line produces @@ -1,0 +1,1 @@ which is invalid for --reverse
      const patch = buildPatch(header, hunk, new Set([1]), true);
      expect(patch).toMatch(/@@ -1,0 \+1,1 @@/);
    });
  });
});
