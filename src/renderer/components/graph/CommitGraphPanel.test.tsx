// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { RefInfo } from "../../../shared/git-types";

// Helper: simulate the remote-branch filtering logic used in commitContextItems
function getDeleteableRemoteBranches(refs: RefInfo[], currentBranch: string): RefInfo[] {
  return refs.filter((r) => {
    if (r.type !== "remote") return false;
    const slashIdx = r.name.indexOf("/");
    const branchPart = slashIdx >= 0 ? r.name.substring(slashIdx + 1) : r.name;
    return branchPart !== currentBranch;
  });
}

describe("CommitGraphPanel — Delete Remote Branch filtering", () => {
  it("includes remote branches that do not track the current branch", () => {
    const refs: RefInfo[] = [
      { name: "origin/feature-x", type: "remote" },
      { name: "origin/develop", type: "remote" },
    ];
    const result = getDeleteableRemoteBranches(refs, "main");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["origin/feature-x", "origin/develop"]);
  });

  it("excludes the remote tracking branch for the current local branch", () => {
    const refs: RefInfo[] = [
      { name: "origin/main", type: "remote" },
      { name: "origin/feature-x", type: "remote" },
    ];
    const result = getDeleteableRemoteBranches(refs, "main");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("origin/feature-x");
  });

  it("excludes current branch tracking from any remote", () => {
    const refs: RefInfo[] = [
      { name: "upstream/develop", type: "remote" },
      { name: "origin/develop", type: "remote" },
    ];
    const result = getDeleteableRemoteBranches(refs, "develop");
    expect(result).toHaveLength(0);
  });

  it("ignores non-remote refs (head, tag)", () => {
    const refs: RefInfo[] = [
      { name: "main", type: "head", current: true },
      { name: "feature-x", type: "head" },
      { name: "v1.0", type: "tag" },
      { name: "origin/feature-x", type: "remote" },
    ];
    const result = getDeleteableRemoteBranches(refs, "main");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("origin/feature-x");
  });

  it("returns empty when there are no remote refs", () => {
    const refs: RefInfo[] = [
      { name: "main", type: "head", current: true },
      { name: "v1.0", type: "tag" },
    ];
    const result = getDeleteableRemoteBranches(refs, "main");
    expect(result).toHaveLength(0);
  });

  it("handles nested branch names (e.g. origin/feature/xyz)", () => {
    const refs: RefInfo[] = [
      { name: "origin/feature/xyz", type: "remote" },
    ];
    // currentBranch is "main", so feature/xyz should be included
    const result = getDeleteableRemoteBranches(refs, "main");
    expect(result).toHaveLength(1);

    // currentBranch is "feature/xyz" → should be excluded
    const result2 = getDeleteableRemoteBranches(refs, "feature/xyz");
    expect(result2).toHaveLength(0);
  });
});

// ---------- HEAD row highlight styling logic ----------
// These tests verify the inline-style derivation for the HEAD commit row,
// mirroring the logic inside GraphRowItem without rendering the component.

function rowBackground(selected: boolean, isHead: boolean): string {
  return selected
    ? "var(--accent-dim)"
    : isHead
    ? "color-mix(in srgb, var(--accent) 10%, transparent)"
    : "transparent";
}

function rowBorderLeft(selected: boolean, isHead: boolean): string {
  return selected
    ? "2px solid var(--accent)"
    : isHead
    ? "2px solid var(--accent)"
    : "2px solid transparent";
}

function subjectColor(isHead: boolean): string {
  return isHead ? "var(--accent)" : "var(--text-primary)";
}

function subjectWeight(isHead: boolean): number {
  return isHead ? 700 : 400;
}

describe("CommitGraphPanel — HEAD row highlight styles", () => {
  it("applies accent background tint for HEAD row", () => {
    expect(rowBackground(false, true)).toBe(
      "color-mix(in srgb, var(--accent) 10%, transparent)"
    );
  });

  it("uses transparent background for non-HEAD row", () => {
    expect(rowBackground(false, false)).toBe("transparent");
  });

  it("selected background overrides HEAD tint", () => {
    expect(rowBackground(true, true)).toBe("var(--accent-dim)");
  });

  it("applies accent left border for HEAD row", () => {
    expect(rowBorderLeft(false, true)).toBe("2px solid var(--accent)");
  });

  it("uses transparent left border for non-HEAD row", () => {
    expect(rowBorderLeft(false, false)).toBe("2px solid transparent");
  });

  it("selected left border is accent regardless of HEAD", () => {
    expect(rowBorderLeft(true, false)).toBe("2px solid var(--accent)");
    expect(rowBorderLeft(true, true)).toBe("2px solid var(--accent)");
  });

  it("HEAD commit subject uses accent color and bold", () => {
    expect(subjectColor(true)).toBe("var(--accent)");
    expect(subjectWeight(true)).toBe(700);
  });

  it("non-HEAD commit subject uses primary color and normal weight", () => {
    expect(subjectColor(false)).toBe("var(--text-primary)");
    expect(subjectWeight(false)).toBe(400);
  });
});
