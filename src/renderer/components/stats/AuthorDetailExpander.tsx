import React from "react";
import type { AuthorDetail, TeamTimeline } from "../../../shared/stats-types";
import { Sparkline } from "./Sparkline";
import { ActivityHeatmap } from "./ActivityHeatmap";

interface AuthorDetailExpanderProps {
  detail: AuthorDetail | null;
  teamTimeline?: TeamTimeline;
  loading?: boolean;
  error?: string | null;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const Spinner: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 0",
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
);

export const AuthorDetailExpander: React.FC<AuthorDetailExpanderProps> = ({
  detail,
  teamTimeline,
  loading = false,
  error = null,
}) => {
  if (loading || (!detail && !error)) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px 20px",
          color: "var(--red)",
          fontSize: 13,
        }}
      >
        Failed to load author details: {error}
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div
      style={{
        padding: "16px 20px",
        backgroundColor: "var(--surface-0)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Sparkline section */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Commit Activity
          {teamTimeline && (
            <span style={{ marginLeft: 12, fontStyle: "italic" }}>— dashed: team average</span>
          )}
        </div>
        <Sparkline
          data={detail.commitTimeline}
          teamData={teamTimeline?.timeline}
          width={400}
          height={80}
        />
      </div>

      {/* Activity heatmap + Top files side by side */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <ActivityHeatmap
            hourlyDistribution={detail.hourlyDistribution}
            dailyDistribution={detail.dailyDistribution}
          />
        </div>

        {/* Top files */}
        <div style={{ flex: "1 1 200px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Top Files
          </div>
          {detail.topFiles.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No data</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {detail.topFiles.slice(0, 10).map((f) => {
                const filename = f.path.split("/").pop() ?? f.path;
                const maxChanges = detail.topFiles[0]?.changes ?? 1;
                const barWidth = Math.round((f.changes / Math.max(maxChanges, 1)) * 100);
                return (
                  <div key={f.path} title={f.path} style={{ position: "relative" }}>
                    {/* Bar background */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${barWidth}%`,
                        backgroundColor: "var(--accent)",
                        opacity: 0.08,
                        borderRadius: 2,
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        padding: "2px 6px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "75%",
                        }}
                        title={f.path}
                      >
                        {filename}
                      </span>
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                        {formatNumber(f.changes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCell
          label="Avg Commit Size"
          value={`${formatNumber(detail.avgCommitSize)} lines`}
        />
        <SummaryCell
          label="Lines Added"
          value={`+${formatNumber(detail.linesAdded)}`}
          valueColor="var(--green)"
        />
        <SummaryCell
          label="Lines Removed"
          value={`-${formatNumber(detail.linesRemoved)}`}
          valueColor="var(--red)"
        />
        <SummaryCell
          label="Longest Streak"
          value={`${detail.longestStreak} day${detail.longestStreak === 1 ? "" : "s"}`}
        />
        <SummaryCell
          label="Current Streak"
          value={`${detail.currentStreak} day${detail.currentStreak === 1 ? "" : "s"}`}
        />
        <SummaryCell label="First Commit" value={formatDate(detail.firstCommitDate)} />
        <SummaryCell label="Last Commit" value={formatDate(detail.lastCommitDate)} />
      </div>
    </div>
  );
};

interface SummaryCellProps {
  label: string;
  value: string;
  valueColor?: string;
}

const SummaryCell: React.FC<SummaryCellProps> = ({ label, value, valueColor }) => (
  <div
    style={{
      backgroundColor: "var(--surface-1)",
      borderRadius: 6,
      padding: "8px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}
  >
    <span
      style={{
        fontSize: 10,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: valueColor ?? "var(--text-primary)",
      }}
    >
      {value}
    </span>
  </div>
);
