import React, { useRef, useCallback } from "react";
import type { GitStatus, GitOperation } from "../../../shared/git-types";
import { openDialogWindow } from "../../utils/open-dialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface ConflictBannerProps {
  status: GitStatus;
}

const operationLabel: Record<NonNullable<GitOperation>, string> = {
  merge: "Merge",
  rebase: "Rebase",
  "cherry-pick": "Cherry-pick",
};

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ status }) => {
  const { operationInProgress, conflicted, rebaseStep } = status;

  // Track total conflicts for progress display (updated synchronously during render)
  const totalConflictsRef = useRef(0);
  const lastRebaseStepRef = useRef<number | undefined>(undefined);

  // Synchronous ref update so the value is available in the same render pass
  if (!operationInProgress) {
    totalConflictsRef.current = 0;
    lastRebaseStepRef.current = undefined;
  } else {
    const currentStep = rebaseStep?.current;

    // Reset total if rebase step changed
    if (
      operationInProgress === "rebase" &&
      currentStep !== lastRebaseStepRef.current
    ) {
      totalConflictsRef.current = conflicted.length;
      lastRebaseStepRef.current = currentStep;
    } else {
      // If conflicts increased or first appearance, update total
      if (conflicted.length > totalConflictsRef.current) {
        totalConflictsRef.current = conflicted.length;
      }
    }
  }

  const refreshAfterAction = useCallback(async () => {
    await useRepoStore.getState().refreshStatus();
    await useRepoStore.getState().refreshInfo();
    useGraphStore.getState().loadGraph();
  }, []);

  const handleAbort = useCallback(async () => {
    if (!operationInProgress) return;
    const label = operationLabel[operationInProgress];
    if (!window.confirm(`Are you sure you want to abort the ${label.toLowerCase()}?`))
      return;

    const api = window.electronAPI.branch;
    if (operationInProgress === "merge") await api.mergeAbort();
    else if (operationInProgress === "rebase") await api.rebaseAbort();
    else if (operationInProgress === "cherry-pick") await api.cherryPickAbort();

    await refreshAfterAction();
  }, [operationInProgress, refreshAfterAction]);

  const handleContinue = useCallback(async () => {
    if (!operationInProgress) return;
    const api = window.electronAPI.branch;
    if (operationInProgress === "merge") await api.mergeContinue();
    else if (operationInProgress === "rebase") await api.rebaseContinue();
    else if (operationInProgress === "cherry-pick")
      await api.cherryPickContinue();

    await refreshAfterAction();
  }, [operationInProgress, refreshAfterAction]);

  const handleSkip = useCallback(async () => {
    await window.electronAPI.branch.rebaseSkip();
    await refreshAfterAction();
  }, [refreshAfterAction]);

  const handleResolveConflicts = useCallback(() => {
    openDialogWindow({ dialog: "MergeConflictDialog" });
  }, []);

  if (!operationInProgress) return null;

  const hasConflicts = conflicted.length > 0;
  const total = totalConflictsRef.current;
  const resolved = total - conflicted.length;
  const label = operationLabel[operationInProgress];
  const isGreen = !hasConflicts;

  const accentVar = isGreen ? "var(--green)" : "var(--red)";
  const bgColor = isGreen
    ? "rgba(var(--green-rgb, 80, 200, 120), 0.12)"
    : "rgba(var(--red-rgb, 210, 80, 80), 0.12)";

  // Build status text
  let statusText: string;
  if (isGreen) {
    statusText = "All conflicts resolved";
  } else {
    let prefix = `${label} in progress`;
    if (operationInProgress === "rebase" && rebaseStep) {
      prefix = `${label} in progress (step ${rebaseStep.current}/${rebaseStep.total})`;
    }
    statusText = `${prefix} — ${resolved}/${total} conflicts resolved`;
  }

  const containerStyle: React.CSSProperties = {
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: bgColor,
    borderBottom: `1px solid ${accentVar}`,
    flexShrink: 0,
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: "4px 12px",
    borderRadius: 5,
    border: `1px solid ${accentVar}`,
    background: accentVar,
    color: "var(--surface-0)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: "4px 12px",
    borderRadius: 5,
    border: `1px solid ${accentVar}`,
    background: "transparent",
    color: accentVar,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const accentColor = accentVar;

  return (
    <div style={containerStyle}>
      {isGreen ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}

      <span style={{ fontSize: 12, color: accentColor, fontWeight: 600, flex: 1 }}>
        {statusText}
      </span>

      {hasConflicts ? (
        <>
          <button style={primaryButtonStyle} onClick={handleResolveConflicts}>
            Resolve Conflicts
          </button>
          {operationInProgress === "rebase" && (
            <button style={secondaryButtonStyle} onClick={handleSkip}>
              Skip Commit
            </button>
          )}
          <button style={secondaryButtonStyle} onClick={handleAbort}>
            Abort {label}
          </button>
        </>
      ) : (
        <>
          <button style={primaryButtonStyle} onClick={handleContinue}>
            Continue {label}
          </button>
          <button style={secondaryButtonStyle} onClick={handleAbort}>
            Abort
          </button>
        </>
      )}
    </div>
  );
};
