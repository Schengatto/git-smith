import React, { useEffect, useCallback } from "react";
import { useStatsStore } from "../../store/stats-store";
import { useRepoStore } from "../../store/repo-store";
import { AuthorDetailExpander } from "./AuthorDetailExpander";
import type { Timeframe } from "../../../shared/stats-types";

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const TIMEFRAME_OPTIONS: { label: string; value: Timeframe }[] = [
  { label: "All Time", value: "all" },
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
];

export const StatsPanel: React.FC = () => {
  const repo = useRepoStore((s) => s.repo);
  const {
    leaderboard,
    selectedEmail,
    selectedAuthor,
    detailLoading,
    detailError,
    timeframe,
    loading,
    error,
    sortField,
    sortDirection,
    loadLeaderboard,
    loadAuthorDetail,
    setTimeframe,
    setSortField,
    clearSelection,
  } = useStatsStore();

  // Load leaderboard on mount (when repo is open) and when timeframe changes
  useEffect(() => {
    if (!repo) return;
    loadLeaderboard(timeframe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path, timeframe]);

  // Listen for repoChanged events to reload stats (e.g. after auto-fetch)
  useEffect(() => {
    const cleanup = window.electronAPI.on.repoChanged(() => {
      clearSelection();
      loadLeaderboard(useStatsStore.getState().timeframe);
    });
    return () => { cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRowClick = useCallback(
    (email: string) => {
      if (selectedEmail === email) {
        clearSelection();
      } else {
        loadAuthorDetail(email);
      }
    },
    [selectedEmail, clearSelection, loadAuthorDetail]
  );

  const handleTimeframe = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      clearSelection();
    },
    [setTimeframe, clearSelection]
  );

  const handleRefresh = useCallback(() => {
    if (repo) loadLeaderboard(timeframe);
  }, [repo, timeframe, loadLeaderboard]);

  const handleSort = useCallback(
    (field: "commits" | "linesAdded" | "linesRemoved" | "longestStreak") => {
      setSortField(field);
    },
    [setSortField]
  );

  // Sort leaderboard client-side
  const sorted = [...leaderboard].sort((a, b) => {
    const diff = a[sortField] - b[sortField];
    return sortDirection === "desc" ? -diff : diff;
  });

  const maxCommits = Math.max(...leaderboard.map((e) => e.commits), 1);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const SortIcon: React.FC<{ field: "commits" | "linesAdded" | "linesRemoved" | "longestStreak" }> = ({ field }) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span>;
    }
    return (
      <span style={{ marginLeft: 3, color: "var(--accent)" }}>
        {sortDirection === "desc" ? "↓" : "↑"}
      </span>
    );
  };

  if (!repo) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Open a repository to view statistics.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--surface-0)",
        color: "var(--text-primary)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, flex: "0 0 auto" }}>
          Author Statistics
        </span>

        <div style={{ flex: 1 }} />

        {/* Timeframe segmented control */}
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              aria-label={opt.label}
              onClick={() => handleTimeframe(opt.value)}
              style={{
                padding: "3px 10px",
                fontSize: 12,
                border: "none",
                borderRight: opt.value !== "week" ? "1px solid var(--border)" : "none",
                backgroundColor:
                  timeframe === opt.value ? "var(--accent)" : "var(--surface-1)",
                color:
                  timeframe === opt.value ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: timeframe === opt.value ? 600 : 400,
                transition: "background-color 0.15s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          aria-label="Refresh"
          onClick={handleRefresh}
          title="Refresh statistics"
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 5,
            backgroundColor: "var(--surface-1)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          ↻
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div
            role="status"
            aria-label="Loading"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 120,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div
            style={{
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
            <button
              aria-label="Retry"
              onClick={handleRefresh}
              style={{
                padding: "4px 14px",
                fontSize: 12,
                border: "1px solid var(--border)",
                borderRadius: 5,
                backgroundColor: "var(--surface-1)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 100,
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No data for this timeframe.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <th
                  style={{
                    padding: "5px 8px",
                    textAlign: "center",
                    width: 36,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "5px 8px",
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  Author
                </th>
                <th
                  onClick={() => handleSort("commits")}
                  style={{
                    padding: "5px 8px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Commits <SortIcon field="commits" />
                </th>
                <th
                  onClick={() => handleSort("linesAdded")}
                  style={{
                    padding: "5px 8px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  +Lines <SortIcon field="linesAdded" />
                </th>
                <th
                  onClick={() => handleSort("linesRemoved")}
                  style={{
                    padding: "5px 8px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  -Lines <SortIcon field="linesRemoved" />
                </th>
                <th
                  onClick={() => handleSort("longestStreak")}
                  style={{
                    padding: "5px 8px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Streak <SortIcon field="longestStreak" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => {
                const isSelected = selectedEmail === entry.authorEmail;
                const barWidth = Math.round(
                  (entry.commits / maxCommits) * 100
                );
                return (
                  <React.Fragment key={entry.authorEmail}>
                    <tr
                      onClick={() => handleRowClick(entry.authorEmail)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: isSelected
                          ? "var(--surface-1)"
                          : "transparent",
                        backgroundImage: `linear-gradient(to right, rgba(147,187,255,0.07) ${barWidth}%, transparent ${barWidth}%)`,
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {entry.rank}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",

                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <img
                            src={`https://www.gravatar.com/avatar/${entry.gravatarHash}?s=48&d=identicon`}
                            alt=""
                            width={24}
                            height={24}
                            style={{ borderRadius: "50%", flexShrink: 0 }}
                          />
                          <span
                            style={{
                              color: "var(--text-primary)",
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            {entry.authorName}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "var(--text-secondary)",

                        }}
                      >
                        {entry.commits}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "var(--green)",

                        }}
                      >
                        +{formatNumber(entry.linesAdded)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "var(--red)",

                        }}
                      >
                        -{formatNumber(entry.linesRemoved)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "var(--text-secondary)",

                        }}
                      >
                        {entry.longestStreak}d
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isSelected && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ padding: 0, backgroundColor: "var(--surface-0)" }}
                        >
                          <AuthorDetailExpander
                            detail={selectedAuthor}
                            loading={detailLoading}
                            error={detailError}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
