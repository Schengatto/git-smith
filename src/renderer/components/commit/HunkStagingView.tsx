import React, { useMemo, useState } from "react";

interface Props {
  rawDiff: string;
  fileName: string;
  isStaged: boolean;
  isConflicted?: boolean;
  onStageHunk: (patch: string) => void;
  onUnstageHunk: (patch: string) => void;
}

interface Hunk {
  header: string;
  lines: string[];
  startIndex: number;
}

/** Splits a raw unified diff string into its file header lines and individual hunks. */
export function parseHunks(rawDiff: string): { header: string[]; hunks: Hunk[] } {
  const lines = rawDiff.split("\n");
  const header: string[] = [];
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: line, lines: [], startIndex: i };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    } else {
      header.push(line);
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  return { header, hunks };
}

/**
 * Builds a patch string for a single hunk, optionally including only selected lines.
 * Unselected deletions are converted to context lines to preserve the patch format.
 */
export function buildPatch(
  headerLines: string[],
  hunk: Hunk,
  selectedLineIndices?: Set<number>,
  isReverse?: boolean
): string {
  let hunkLines: string[];

  if (!selectedLineIndices) {
    // Stage/unstage entire hunk
    hunkLines = [hunk.header, ...hunk.lines];
  } else {
    // Build partial hunk: keep context and selected +/- lines
    // For staging (forward apply): unselected "-" become context, unselected "+" are skipped
    // For unstaging (reverse apply): unselected "+" become context, unselected "-" are skipped
    const newLines: string[] = [];
    let oldCount = 0;
    let newCount = 0;

    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i];
      if (line.startsWith("+")) {
        if (selectedLineIndices.has(i)) {
          newLines.push(line);
          newCount++;
        } else if (isReverse) {
          // Convert unselected add to context for reverse apply
          newLines.push(" " + line.slice(1));
          oldCount++;
          newCount++;
        }
      } else if (line.startsWith("-")) {
        if (selectedLineIndices.has(i)) {
          newLines.push(line);
          oldCount++;
        } else if (!isReverse) {
          // Convert unselected remove to context for forward apply
          newLines.push(" " + line.slice(1));
          oldCount++;
          newCount++;
        }
      } else if (line.startsWith("\\")) {
        // "\ No newline at end of file" marker — preserve but don't count
        newLines.push(line);
      } else {
        // Context line
        newLines.push(line);
        oldCount++;
        newCount++;
      }
    }

    // Parse original header for start line
    const match = hunk.header.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
    const oldStart = match ? parseInt(match[1]) : 1;
    const newStart = match ? parseInt(match[2]) : 1;
    const newHeader = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    hunkLines = [newHeader, ...newLines];
  }

  // Remove trailing empty line if present
  while (hunkLines.length > 0 && hunkLines[hunkLines.length - 1] === "") {
    hunkLines.pop();
  }

  return headerLines.join("\n") + "\n" + hunkLines.join("\n") + "\n";
}

export const HunkStagingView: React.FC<Props> = ({
  rawDiff,
  fileName,
  isStaged,
  isConflicted,
  onStageHunk,
  onUnstageHunk,
}) => {
  const { header, hunks } = useMemo(() => parseHunks(rawDiff), [rawDiff]);
  const [selectedLines, setSelectedLines] = useState<Record<number, Set<number>>>({});

  const toggleLine = (hunkIdx: number, lineIdx: number) => {
    setSelectedLines((prev) => {
      const next = { ...prev };
      const set = new Set(next[hunkIdx] || []);
      if (set.has(lineIdx)) set.delete(lineIdx);
      else set.add(lineIdx);
      next[hunkIdx] = set;
      return next;
    });
  };

  const handleStageHunk = (hunkIdx: number) => {
    const hunk = hunks[hunkIdx];
    const selected = selectedLines[hunkIdx];
    let sel = selected && selected.size > 0 ? selected : undefined;

    // When unstaging: if all + lines in the hunk are selected, unstage the
    // whole hunk instead of building a partial patch.  A partial reverse patch
    // that contains only + lines (oldCount=0) is invalid for git apply --reverse
    // and this also matches VS Code behaviour (unstaging every changed line = unstage file).
    if (isStaged && sel) {
      const plusIndices = hunk.lines.reduce<number[]>((acc, l, i) => {
        if (l.startsWith("+")) acc.push(i);
        return acc;
      }, []);
      if (plusIndices.length > 0 && plusIndices.every((i) => sel!.has(i))) {
        sel = undefined;
      }
    }

    const patch = buildPatch(header, hunk, sel, isStaged);
    if (isStaged) {
      onUnstageHunk(patch);
    } else {
      onStageHunk(patch);
    }
  };

  if (!rawDiff || rawDiff.startsWith("(") || hunks.length === 0) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {rawDiff?.startsWith("(") ? rawDiff : "No diff available"}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="mono"
        style={{
          padding: "6px 16px",
          fontSize: 11,
          color: "var(--text-secondary)",
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        {fileName}
      </div>

      {hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 12px",
              background: "rgba(137,180,250,0.06)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
              {hunk.header}
            </span>
            {!isConflicted && (
              <button
                onClick={() => handleStageHunk(hunkIdx)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: isStaged ? "var(--red-dim)" : "var(--green-dim)",
                  color: isStaged ? "var(--red)" : "var(--green)",
                  transition: "all 0.15s",
                }}
              >
                {isStaged
                  ? selectedLines[hunkIdx]?.size
                    ? `Unstage ${selectedLines[hunkIdx].size} lines`
                    : "Unstage Hunk"
                  : selectedLines[hunkIdx]?.size
                  ? `Stage ${selectedLines[hunkIdx].size} lines`
                  : "Stage Hunk"}
              </button>
            )}
          </div>

          <pre
            className="mono"
            style={{ margin: 0, padding: 0, fontSize: 11, lineHeight: 1.6 }}
          >
            {hunk.lines.map((line, lineIdx) => {
              const isAdd = line.startsWith("+");
              const isDel = line.startsWith("-");
              const isChangeLine = isAdd || isDel;
              const isSelected = selectedLines[hunkIdx]?.has(lineIdx);

              let bg = "transparent";
              let color = "var(--text-secondary)";

              if (isAdd) {
                bg = "rgba(166,227,161,0.08)";
                color = "var(--green)";
              } else if (isDel) {
                bg = "rgba(243,139,168,0.08)";
                color = "var(--red)";
              }

              if (isSelected) {
                bg = isAdd
                  ? "rgba(166,227,161,0.2)"
                  : isDel
                  ? "rgba(243,139,168,0.2)"
                  : bg;
              }

              return (
                <div
                  key={lineIdx}
                  style={{
                    display: "flex",
                    padding: "0 12px",
                    background: bg,
                    color,
                    cursor: isChangeLine && !isConflicted ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  onClick={() => isChangeLine && !isConflicted && toggleLine(hunkIdx, lineIdx)}
                >
                  <span
                    style={{
                      width: 16,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isChangeLine && !isConflicted && (
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          border: isSelected
                            ? "none"
                            : "1.5px solid var(--border)",
                          background: isSelected
                            ? isAdd
                              ? "var(--green)"
                              : "var(--red)"
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.1s",
                        }}
                      >
                        {isSelected && (
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--surface-0)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    )}
                  </span>
                  <span style={{ paddingLeft: 4 }}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      ))}
    </div>
  );
};
