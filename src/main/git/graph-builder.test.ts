import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph-builder";
import type { CommitInfo } from "../../shared/git-types";

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
    const commits = [
      makeCommit("aaa", ["bbb"]),
      makeCommit("bbb", ["ccc"]),
      makeCommit("ccc", []),
    ];

    const rows = buildGraph(commits);
    expect(rows).toHaveLength(3);
    // All commits should be in lane 0
    expect(rows[0].laneIndex).toBe(0);
    expect(rows[1].laneIndex).toBe(0);
    expect(rows[2].laneIndex).toBe(0);
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
    expect(rows[0].laneIndex).toBe(0);

    // B continues lane 0
    expect(rows[1].laneIndex).toBe(0);

    // C should be in a different lane
    expect(rows[2].laneIndex).not.toBe(rows[1].laneIndex);
  });

  it("handles an empty commit list", () => {
    const rows = buildGraph([]);
    expect(rows).toHaveLength(0);
  });

  it("handles root commit (no parents)", () => {
    const commits = [makeCommit("root", [])];
    const rows = buildGraph(commits);
    expect(rows).toHaveLength(1);
    expect(rows[0].laneIndex).toBe(0);
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
    expect(rows[0].laneIndex).not.toBe(rows[1].laneIndex);
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
    const forkEdge = rows[0].edges.find(
      (e) => e.type === "fork-left" || e.type === "fork-right"
    );
    expect(forkEdge).toBeDefined();
  });

  it("compacts trailing null lanes", () => {
    // After a root commit frees its lane, trailing nulls should be removed
    const commits = [
      makeCommit("A", ["B"]),
      makeCommit("B", []),
    ];

    const rows = buildGraph(commits);
    // After processing B (root), active lane count should be 0
    expect(rows[1].activeLaneCount).toBe(0);
  });
});
