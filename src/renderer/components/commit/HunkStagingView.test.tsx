// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { HunkStagingView, parseHunks, buildPatch } from "./HunkStagingView";

// ─── parseHunks unit tests ─────────────────────────────────────────────────────

describe("parseHunks", () => {
  it("returns empty header and hunks for empty diff", () => {
    const result = parseHunks("");
    expect(result.header).toEqual([""]);
    expect(result.hunks).toHaveLength(0);
  });

  it("puts pre-@@ lines into header", () => {
    const raw =
      "diff --git a/foo.ts b/foo.ts\n--- a/foo.ts\n+++ b/foo.ts\n@@ -1,3 +1,3 @@\n context\n-old\n+new";
    const { header, hunks } = parseHunks(raw);
    expect(header).toEqual(["diff --git a/foo.ts b/foo.ts", "--- a/foo.ts", "+++ b/foo.ts"]);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].header).toBe("@@ -1,3 +1,3 @@");
  });

  it("parses multiple hunks", () => {
    const raw =
      "@@ -1,2 +1,2 @@\n context\n-old1\n+new1\n@@ -10,2 +10,2 @@\n context2\n-old2\n+new2";
    const { hunks } = parseHunks(raw);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toBe("@@ -1,2 +1,2 @@");
    expect(hunks[1].header).toBe("@@ -10,2 +10,2 @@");
  });

  it("strips trailing empty lines from hunk lines", () => {
    const raw = "@@ -1,1 +1,1 @@\n+added\n";
    const { hunks } = parseHunks(raw);
    expect(hunks[0].lines[hunks[0].lines.length - 1]).not.toBe("");
  });

  it("captures hunk lines correctly", () => {
    const raw = "@@ -1,3 +1,3 @@\n context\n-removed\n+added";
    const { hunks } = parseHunks(raw);
    expect(hunks[0].lines).toEqual([" context", "-removed", "+added"]);
  });
});

// ─── buildPatch unit tests ─────────────────────────────────────────────────────

describe("buildPatch", () => {
  const header = ["diff --git a/f.ts b/f.ts", "--- a/f.ts", "+++ b/f.ts"];
  const hunk = {
    header: "@@ -1,3 +1,3 @@",
    lines: [" context", "-removed", "+added"],
    startIndex: 3,
  };

  it("builds full patch when no selectedLineIndices provided", () => {
    const patch = buildPatch(header, hunk);
    expect(patch).toContain("@@ -1,3 +1,3 @@");
    expect(patch).toContain("-removed");
    expect(patch).toContain("+added");
  });

  it("includes header lines in output", () => {
    const patch = buildPatch(header, hunk);
    expect(patch).toContain("diff --git a/f.ts b/f.ts");
  });

  it("when staging selected lines, unselected '+' lines are skipped", () => {
    // Select only the "-removed" line (index 1); "+added" (index 2) is NOT selected
    const sel = new Set([1]);
    const patch = buildPatch(header, hunk, sel, false);
    // "-removed" should appear
    expect(patch).toContain("-removed");
    // "+added" should NOT appear (skipped when not selected in forward mode)
    expect(patch).not.toContain("+added");
  });

  it("when unstaging selected lines, unselected '-' lines are skipped", () => {
    // Select only the "+added" line (index 2) in reverse mode
    const sel = new Set([2]);
    const patch = buildPatch(header, hunk, sel, true);
    expect(patch).toContain("+added");
    // "-removed" not selected in reverse mode → skipped
    expect(patch).not.toContain("-removed");
  });

  it("unselected '-' becomes context line in forward (stage) mode", () => {
    const sel = new Set<number>(); // nothing selected
    const patch = buildPatch(header, hunk, sel, false);
    // "-removed" becomes " removed" (context)
    expect(patch).toContain(" removed");
  });

  it("unselected '+' becomes context line in reverse (unstage) mode", () => {
    const sel = new Set<number>(); // nothing selected
    const patch = buildPatch(header, hunk, sel, true);
    // "+added" becomes " added" (context)
    expect(patch).toContain(" added");
  });

  it("recomputes hunk header counts for partial selection", () => {
    const sel = new Set([1]); // only "-removed" selected
    const patch = buildPatch(header, hunk, sel, false);
    // oldCount = 1 (context) + 1 (-removed) = 2; newCount = 1 (context) = 1
    expect(patch).toContain("@@ -1,2 +1,1 @@");
  });

  it("handles '\\' no-newline marker correctly when preceding line is emitted", () => {
    const hunkWithMarker = {
      header: "@@ -1,1 +1,1 @@",
      lines: ["+added", "\\ No newline at end of file"],
      startIndex: 0,
    };
    const patch = buildPatch([], hunkWithMarker, new Set([0]), false);
    expect(patch).toContain("\\ No newline at end of file");
  });
});

// ─── HunkStagingView component tests ─────────────────────────────────────────

const SIMPLE_DIFF = [
  "diff --git a/src/foo.ts b/src/foo.ts",
  "--- a/src/foo.ts",
  "+++ b/src/foo.ts",
  "@@ -1,3 +1,3 @@",
  " context line",
  "-removed line",
  "+added line",
].join("\n");

const TWO_HUNK_DIFF = [
  "diff --git a/src/bar.ts b/src/bar.ts",
  "--- a/src/bar.ts",
  "+++ b/src/bar.ts",
  "@@ -1,2 +1,2 @@",
  "-old1",
  "+new1",
  "@@ -10,2 +10,2 @@",
  "-old2",
  "+new2",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HunkStagingView", () => {
  // ── Empty / no-diff states ──────────────────────────────────────────────────

  it("shows 'No diff available' when rawDiff is empty", () => {
    render(
      <HunkStagingView
        rawDiff=""
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("No diff available")).toBeInTheDocument();
  });

  it("shows the rawDiff text when it starts with '('", () => {
    render(
      <HunkStagingView
        rawDiff="(binary file)"
        fileName="image.png"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("(binary file)")).toBeInTheDocument();
  });

  // ── Hunk display ─────────────────────────────────────────────────────────────

  it("renders the file name in the sticky header", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="src/foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("src/foo.ts")).toBeInTheDocument();
  });

  it("renders the hunk header (@@ line)", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("@@ -1,3 +1,3 @@")).toBeInTheDocument();
  });

  it("renders all diff lines including context, added, removed", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    // Each diff line is rendered verbatim (including the +/-/space prefix) as
    // the text content of a <span> inside a <div>.  Use a function matcher to
    // handle any whitespace-normalization quirks.
    expect(
      screen.getByText((t) => t.trim() === "context line" || t === " context line")
    ).toBeInTheDocument();
    expect(screen.getByText("-removed line")).toBeInTheDocument();
    expect(screen.getByText("+added line")).toBeInTheDocument();
  });

  it("renders multiple hunks", () => {
    render(
      <HunkStagingView
        rawDiff={TWO_HUNK_DIFF}
        fileName="bar.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("@@ -1,2 +1,2 @@")).toBeInTheDocument();
    expect(screen.getByText("@@ -10,2 +10,2 @@")).toBeInTheDocument();
  });

  // ── Stage hunk button ─────────────────────────────────────────────────────────

  it("shows 'Stage Hunk' button when isStaged=false", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("Stage Hunk")).toBeInTheDocument();
  });

  it("shows 'Unstage Hunk' button when isStaged=true", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={true}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getByText("Unstage Hunk")).toBeInTheDocument();
  });

  it("calls onStageHunk when 'Stage Hunk' is clicked", () => {
    const onStageHunk = vi.fn();
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={onStageHunk}
        onUnstageHunk={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Stage Hunk"));
    expect(onStageHunk).toHaveBeenCalledTimes(1);
    expect(onStageHunk).toHaveBeenCalledWith(expect.stringContaining("@@ -1,3 +1,3 @@"));
  });

  it("calls onUnstageHunk when 'Unstage Hunk' is clicked", () => {
    const onUnstageHunk = vi.fn();
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={true}
        onStageHunk={vi.fn()}
        onUnstageHunk={onUnstageHunk}
      />
    );
    fireEvent.click(screen.getByText("Unstage Hunk"));
    expect(onUnstageHunk).toHaveBeenCalledTimes(1);
  });

  it("two-hunk diff renders two stage buttons", () => {
    render(
      <HunkStagingView
        rawDiff={TWO_HUNK_DIFF}
        fileName="bar.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.getAllByText("Stage Hunk")).toHaveLength(2);
  });

  it("calls onStageHunk for the correct hunk when second button is clicked", () => {
    const onStageHunk = vi.fn();
    render(
      <HunkStagingView
        rawDiff={TWO_HUNK_DIFF}
        fileName="bar.ts"
        isStaged={false}
        onStageHunk={onStageHunk}
        onUnstageHunk={vi.fn()}
      />
    );
    const [, secondBtn] = screen.getAllByText("Stage Hunk");
    fireEvent.click(secondBtn);
    expect(onStageHunk).toHaveBeenCalledWith(expect.stringContaining("@@ -10,2 +10,2 @@"));
  });

  // ── Conflicted mode — no stage buttons ───────────────────────────────────────

  it("hides stage/unstage buttons when isConflicted=true", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        isConflicted={true}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    expect(screen.queryByText("Stage Hunk")).not.toBeInTheDocument();
    expect(screen.queryByText("Unstage Hunk")).not.toBeInTheDocument();
  });

  // ── Line selection (partial staging) ─────────────────────────────────────────

  it("clicking a '+' line toggles its selection checkbox", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    const addedLine = screen.getByText("+added line").closest("div[style]")!;
    fireEvent.click(addedLine);
    // After click the Stage button should show "Stage 1 lines"
    expect(screen.getByText("Stage 1 lines")).toBeInTheDocument();
  });

  it("clicking the same '+' line twice deselects it", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    const addedLine = screen.getByText("+added line").closest("div[style]")!;
    fireEvent.click(addedLine);
    fireEvent.click(addedLine);
    // Should revert to "Stage Hunk" (count cleared)
    expect(screen.getByText("Stage Hunk")).toBeInTheDocument();
  });

  it("clicking a '-' line toggles it in unstaged mode", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    const removedLine = screen.getByText("-removed line").closest("div[style]")!;
    fireEvent.click(removedLine);
    expect(screen.getByText("Stage 1 lines")).toBeInTheDocument();
  });

  it("context lines are not clickable (no selection changes)", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    const contextSpan = screen.getByText(
      (t) => t.trim() === "context line" || t === " context line"
    );
    const contextLineDiv = contextSpan.closest("div[style]")!;
    fireEvent.click(contextLineDiv);
    // Button label should still be "Stage Hunk" (no lines selected)
    expect(screen.getByText("Stage Hunk")).toBeInTheDocument();
  });

  it("does not toggle lines when isConflicted=true", () => {
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        isConflicted={true}
        onStageHunk={vi.fn()}
        onUnstageHunk={vi.fn()}
      />
    );
    const addedLine = screen.getByText("+added line").closest("div[style]")!;
    fireEvent.click(addedLine);
    // No stage buttons at all in conflicted mode
    expect(screen.queryByText("Stage 1 lines")).not.toBeInTheDocument();
  });

  it("onStageHunk receives a partial patch containing only the selected line", () => {
    const onStageHunk = vi.fn();
    render(
      <HunkStagingView
        rawDiff={SIMPLE_DIFF}
        fileName="foo.ts"
        isStaged={false}
        onStageHunk={onStageHunk}
        onUnstageHunk={vi.fn()}
      />
    );
    // Select the added line
    const addedLine = screen.getByText("+added line").closest("div[style]")!;
    fireEvent.click(addedLine);
    fireEvent.click(screen.getByText("Stage 1 lines"));
    expect(onStageHunk).toHaveBeenCalledTimes(1);
    const patch = onStageHunk.mock.calls[0][0] as string;
    expect(patch).toContain("+added line");
    // The removed line was NOT selected; in stage mode unselected "-" → context
    expect(patch).toContain(" removed line");
  });
});
