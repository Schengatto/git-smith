import React from "react";
import { useRepoStore } from "../../store/repo-store";

const IconGitBranch = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const StatusBar: React.FC = () => {
  const { repo, status } = useRepoStore();

  const changedCount = status
    ? (status.staged.length || 0) +
      (status.unstaged.length || 0) +
      (status.untracked.length || 0)
    : 0;

  return (
    <div
      className="shrink-0 flex items-center px-3 gap-3 text-[11px] select-none"
      style={{
        height: 24,
        background: repo ? "var(--accent)" : "var(--surface-1)",
        borderTop: repo ? "none" : "1px solid var(--border-subtle)",
        color: repo ? "var(--text-on-color)" : "var(--text-muted)",
      }}
    >
      {!repo ? (
        <span>No repository open</span>
      ) : (
        <>
          <span className="flex items-center gap-1 font-semibold">
            <IconGitBranch />
            {repo.currentBranch}
          </span>

          {changedCount > 0 && (
            <span className="flex items-center gap-1" style={{ opacity: 0.85 }}>
              <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  background: "var(--overlay-dim)",
                }}
              >
                {changedCount}
              </span>
              change{changedCount !== 1 ? "s" : ""}
            </span>
          )}

          {!repo.isDirty && (
            <span style={{ opacity: 0.7 }}>clean</span>
          )}

          <div className="flex-1" />

          <span className="mono" style={{ opacity: 0.7 }}>
            {repo.headCommit.slice(0, 8)}
          </span>
        </>
      )}
    </div>
  );
};
