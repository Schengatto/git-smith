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
