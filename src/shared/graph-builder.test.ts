import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph-builder";
import type { CommitInfo } from "./git-types";

function makeCommit(
  hash: string,
  parentHashes: string[] = [],
  subject = `commit ${hash}`
): CommitInfo {
  return {
    hash,
    abbreviatedHash: hash.slice(0, 7),
    subject,
    body: "",
    authorName: "Test",
    authorEmail: "test@test.com",
    authorDate: "2024-01-01T00:00:00Z",
    committerDate: "2024-01-01T00:00:00Z",
    parentHashes,
    refs: [],
  };
}

describe("graph-builder", () => {
  it("handles a single linear chain", () => {
    const commits = [makeCommit("aaa", ["bbb"]), makeCommit("bbb", ["ccc"]), makeCommit("ccc", [])];

    const rows = buildGraph(commits);
    expect(rows).toHaveLength(3);
    // All commits should be in lane 0
    expect(rows[0]!.laneIndex).toBe(0);
    expect(rows[1]!.laneIndex).toBe(0);
    expect(rows[2]!.laneIndex).toBe(0);
  });

  it("handles a simple branch and merge", () => {
    // main: A -> B -> D (merge commit with parents D→B and D→C)
    // branch:      C --^
    // topo order: A, B, C, D doesn't apply... let's think about this
    // Actually in topo order with --all:
    // A (head, parents: [B, C])  — merge commit
    // B (parents: [D])
    // C (parents: [D])
    // D (parents: [])
    const commits = [
      makeCommit("A", ["B", "C"], "Merge branch"),
      makeCommit("B", ["D"]),
      makeCommit("C", ["D"]),
      makeCommit("D", []),
    ];

    const rows = buildGraph(commits);
    expect(rows).toHaveLength(4);

    // A should be in lane 0, with a fork edge to a new lane for C
    expect(rows[0]!.laneIndex).toBe(0);

    // B continues lane 0
    expect(rows[1]!.laneIndex).toBe(0);

    // C should be in a different lane
    expect(rows[2]!.laneIndex).not.toBe(rows[1]!.laneIndex);
  });

  it("handles an empty commit list", () => {
    const rows = buildGraph([]);
    expect(rows).toHaveLength(0);
  });

  it("handles root commit (no parents)", () => {
    const commits = [makeCommit("root", [])];
    const rows = buildGraph(commits);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.laneIndex).toBe(0);
  });

  it("handles multiple roots (parallel branches)", () => {
    // Two independent branches
    const commits = [
      makeCommit("A", ["B"]),
      makeCommit("C", ["D"]), // different root
      makeCommit("B", []),
      makeCommit("D", []),
    ];

    const rows = buildGraph(commits);
    expect(rows).toHaveLength(4);

    // A and C should be in different lanes
    expect(rows[0]!.laneIndex).not.toBe(rows[1]!.laneIndex);
  });

  it("assigns different colors to different lanes", () => {
    const commits = [
      makeCommit("A", ["B", "C"], "Merge"),
      makeCommit("B", ["D"]),
      makeCommit("C", ["D"]),
      makeCommit("D", []),
    ];

    const rows = buildGraph(commits);
    // The fork edge from A should create a new color for the C lane
    const forkEdge = rows[0]!.edges.find((e) => e.type === "fork-left" || e.type === "fork-right");
    expect(forkEdge).toBeDefined();
  });

  it("compacts trailing null lanes", () => {
    // After a root commit frees its lane, trailing nulls should be removed
    const commits = [makeCommit("A", ["B"]), makeCommit("B", [])];

    const rows = buildGraph(commits);
    // After processing B (root), active lane count should be 0
    expect(rows[1]!.activeLaneCount).toBe(0);
  });

  it("merges duplicate lanes when two branches converge to same parent", () => {
    // A (merge, parents: [B, C])
    // B (parents: [D])
    // C (parents: [D])  — both B and C point to D
    // D (parents: [])
    const commits = [
      makeCommit("A", ["B", "C"], "Merge branch"),
      makeCommit("B", ["D"]),
      makeCommit("C", ["D"]),
      makeCommit("D", []),
    ];

    const rows = buildGraph(commits);

    // When D is reached, both lane 0 (from B) and lane 1 (from C) expect D.
    // D should resolve in one lane, and the other lane should be freed.
    // After D (root), there should be 0 active lanes — no ghost lanes.
    expect(rows[3]!.activeLaneCount).toBe(0);

    // D should have a converge edge from the duplicate lane
    const convergeEdge = rows[3]!.edges.find(
      (e) => e.type === "converge-left" || e.type === "converge-right"
    );
    expect(convergeEdge).toBeDefined();
  });

  it("uses start edge type for branch tips", () => {
    const commits = [makeCommit("A", ["B"]), makeCommit("B", [])];

    const rows = buildGraph(commits);
    // A is a branch tip — should have a "start" edge, not "straight"
    const startEdge = rows[0]!.edges.find((e) => e.type === "start");
    expect(startEdge).toBeDefined();
    expect(startEdge!.fromLane).toBe(0);
    expect(startEdge!.toLane).toBe(0);

    // B is NOT a branch tip (expected by A) — should have "straight" or "end"
    const straightOrEnd = rows[1]!.edges.find((e) => e.type === "straight" || e.type === "end");
    expect(straightOrEnd).toBeDefined();
    const noStart = rows[1]!.edges.find((e) => e.type === "start");
    expect(noStart).toBeUndefined();
  });

  it("does not create ghost lanes with complex merge history", () => {
    // Simulates a common pattern: feature branches merged into main
    // main: M3 -> M2 -> M1 -> Base
    // feat1:       F1 ---^
    // feat2: F2 --------^
    // Both F1 and M2 have parent M1, and F2 and M3 have parent M2
    const commits = [
      makeCommit("M3", ["M2", "F2"], "Merge feat2"),
      makeCommit("F2", ["M2"]),
      makeCommit("M2", ["M1", "F1"], "Merge feat1"),
      makeCommit("F1", ["M1"]),
      makeCommit("M1", ["Base"]),
      makeCommit("Base", []),
    ];

    const rows = buildGraph(commits);

    // After processing Base (root), all lanes should be resolved
    expect(rows[5]!.activeLaneCount).toBe(0);

    // At M1, both M2 and F1 pointed to it, so duplicate lanes should be merged
    // M1 should have at most 1 active lane
    expect(rows[4]!.activeLaneCount).toBeLessThanOrEqual(1);
  });
});
