import type { CommitInfo, GraphRow, GraphEdge } from "./git-types";

const LANE_COLORS = 16;

interface ActiveLane {
  commitHash: string;
  colorIndex: number;
}

/**
 * Assigns lane positions and edges to a topologically-sorted list of commits.
 * Produces a GraphRow per commit with lane index, edge connections, and color assignments
 * suitable for rendering a visual commit graph with fork/merge lines.
 */
export function buildGraph(commits: CommitInfo[]): GraphRow[] {
  const rows: GraphRow[] = [];
  const activeLanes: (ActiveLane | null)[] = [];
  let nextColor = 0;

  function allocColor(): number {
    return nextColor++ % LANE_COLORS;
  }

  function findLane(hash: string): number {
    return activeLanes.findIndex((l) => l && l.commitHash === hash);
  }

  function findFreeLane(): number {
    const idx = activeLanes.findIndex((l) => l === null);
    return idx >= 0 ? idx : activeLanes.length;
  }

  for (const commit of commits) {
    const edges: GraphEdge[] = [];
    let laneIndex = findLane(commit.hash);
    let colorIndex: number;
    let isBranchTip = false;

    if (laneIndex < 0) {
      // New branch head — allocate a lane
      isBranchTip = true;
      laneIndex = findFreeLane();
      colorIndex = allocColor();
      if (laneIndex >= activeLanes.length) {
        activeLanes.push({ commitHash: commit.hash, colorIndex });
      } else {
        activeLanes[laneIndex] = { commitHash: commit.hash, colorIndex };
      }
    } else {
      colorIndex = activeLanes[laneIndex]!.colorIndex;
    }

    // Merge duplicate lanes: other lanes also expecting this commit hash
    // converge into the primary lane (prevents ghost lanes)
    for (let i = 0; i < activeLanes.length; i++) {
      if (i !== laneIndex && activeLanes[i] && activeLanes[i]!.commitHash === commit.hash) {
        const convergeType = i < laneIndex ? "converge-left" : "converge-right";
        edges.push({
          fromLane: i,
          toLane: laneIndex,
          type: convergeType,
          color: activeLanes[i]!.colorIndex,
        });
        activeLanes[i] = null;
      }
    }

    // Generate continuation edges for all other active lanes
    for (let i = 0; i < activeLanes.length; i++) {
      if (i !== laneIndex && activeLanes[i]) {
        edges.push({
          fromLane: i,
          toLane: i,
          type: "straight",
          color: activeLanes[i]!.colorIndex,
        });
      }
    }

    const parents = commit.parentHashes.filter(Boolean);

    if (parents.length === 0) {
      // Root commit — draw incoming line if this commit was expected by a lane
      if (laneIndex >= 0 && colorIndex !== undefined) {
        edges.push({
          fromLane: laneIndex,
          toLane: laneIndex,
          type: "end",
          color: colorIndex,
        });
      }
      // Free the lane
      activeLanes[laneIndex] = null;
    } else {
      // First parent continues in same lane
      activeLanes[laneIndex] = {
        commitHash: parents[0]!,
        colorIndex,
      };
      // Branch tips use "start" (line from dot downward); others use "straight" (full top-to-bottom)
      edges.push({
        fromLane: laneIndex,
        toLane: laneIndex,
        type: isBranchTip ? "start" : "straight",
        color: colorIndex,
      });

      // Additional parents (merge)
      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p]!;
        const existingLane = findLane(parentHash);

        if (existingLane >= 0) {
          // Merge into existing lane
          const type = existingLane < laneIndex ? "merge-left" : "merge-right";
          edges.push({
            fromLane: laneIndex,
            toLane: existingLane,
            type,
            color: activeLanes[existingLane]!.colorIndex,
          });
        } else {
          // Fork — allocate new lane for this parent
          const newLane = findFreeLane();
          const newColor = allocColor();
          if (newLane >= activeLanes.length) {
            activeLanes.push({ commitHash: parentHash, colorIndex: newColor });
          } else {
            activeLanes[newLane] = { commitHash: parentHash, colorIndex: newColor };
          }
          const type = newLane < laneIndex ? "fork-left" : "fork-right";
          edges.push({
            fromLane: laneIndex,
            toLane: newLane,
            type,
            color: newColor,
          });
        }
      }
    }

    // Compact trailing nulls
    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    rows.push({
      commit,
      laneIndex,
      edges,
      activeLaneCount: activeLanes.filter(Boolean).length,
    });
  }

  return rows;
}
