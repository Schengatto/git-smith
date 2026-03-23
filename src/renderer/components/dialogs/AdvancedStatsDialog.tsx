import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";
import type {
  TimelineEntry,
  ChurnEntry,
  ContributorTimelineEntry,
} from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Period = "day" | "week" | "month";
type Tab = "timeline" | "churn" | "contributors";

const PERIODS: { value: Period; labelKey: string }[] = [
  { value: "day", labelKey: "advancedStats.day" },
  { value: "week", labelKey: "advancedStats.week" },
  { value: "month", labelKey: "advancedStats.month" },
];

const TABS: { value: Tab; labelKey: string }[] = [
  { value: "timeline", labelKey: "advancedStats.commitsTimeline" },
  { value: "churn", labelKey: "advancedStats.codeChurn" },
  { value: "contributors", labelKey: "advancedStats.contributors" },
];

const MAX_BARS = 30;

/* ------------------------------------------------------------------ */
/* Sub-components                                                        */
/* ------------------------------------------------------------------ */

const PeriodSelector: React.FC<{
  value: Period;
  onChange: (p: Period) => void;
  t: (key: string) => string;
}> = ({ value, onChange, t }) => (
  <div
    style={{
      display: "flex",
      gap: 0,
      borderRadius: 6,
      overflow: "hidden",
      border: "1px solid var(--border)",
    }}
  >
    {PERIODS.map((p, i) => (
      <button
        key={p.value}
        onClick={() => onChange(p.value)}
        style={{
          padding: "5px 14px",
          fontSize: 12,
          fontWeight: 500,
          border: "none",
          borderLeft: i > 0 ? "1px solid var(--border)" : "none",
          borderRadius: 0,
          background: value === p.value ? "var(--accent)" : "var(--surface-0)",
          color: value === p.value ? "var(--text-on-color)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        {t(p.labelKey)}
      </button>
    ))}
  </div>
);

const TabBar: React.FC<{
  value: Tab;
  onChange: (t: Tab) => void;
  t: (key: string) => string;
}> = ({ value, onChange, t }) => (
  <div
    style={{
      display: "flex",
      gap: 0,
      borderBottom: "1px solid var(--border)",
    }}
  >
    {TABS.map((tabItem) => (
      <button
        key={tabItem.value}
        onClick={() => onChange(tabItem.value)}
        style={{
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: value === tabItem.value ? 600 : 400,
          border: "none",
          borderBottom:
            value === tabItem.value ? "2px solid var(--accent)" : "2px solid transparent",
          background: "transparent",
          color: value === tabItem.value ? "var(--accent)" : "var(--text-muted)",
          cursor: "pointer",
          transition: "color 0.12s, border-color 0.12s",
          marginBottom: -1,
        }}
      >
        {t(tabItem.labelKey)}
      </button>
    ))}
  </div>
);

const LoadingState: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 200,
      color: "var(--text-muted)",
      fontSize: 13,
    }}
  >
    {t("dialogs.loading")}
  </div>
);

const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 200,
      color: "var(--text-muted)",
      fontSize: 13,
    }}
  >
    {message}
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 200,
      color: "var(--red)",
      fontSize: 13,
    }}
  >
    {message}
  </div>
);

/* ------------------------------------------------------------------ */
/* Timeline chart                                                        */
/* ------------------------------------------------------------------ */

const TimelineChart: React.FC<{ entries: TimelineEntry[] }> = ({ entries }) => {
  const visible = entries.slice(-MAX_BARS);
  const maxCount = Math.max(...visible.map((e) => e.count), 1);

  return (
    <div
      style={{
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: visible.length > 15 ? visible.length * 28 : "auto",
        }}
      >
        {visible.map((entry) => {
          const pct = (entry.count / maxCount) * 100;
          return (
            <div
              key={entry.date}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 90,
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.date}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 18,
                  background: "var(--surface-0)",
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--accent)",
                    borderRadius: 3,
                    transition: "width 0.3s ease",
                    minWidth: pct > 0 ? 4 : 0,
                  }}
                />
              </div>
              <span
                style={{
                  width: 28,
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  textAlign: "right",
                }}
              >
                {entry.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Churn chart                                                           */
/* ------------------------------------------------------------------ */

const ChurnChart: React.FC<{ entries: ChurnEntry[]; t: (key: string) => string }> = ({
  entries,
  t,
}) => {
  const visible = entries.slice(-MAX_BARS);
  const maxVal = Math.max(...visible.map((e) => Math.max(e.additions, e.deletions)), 1);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: visible.length > 15 ? visible.length * 28 : "auto",
        }}
      >
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, paddingLeft: 98, marginBottom: 4 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "var(--green)",
              }}
            />
            {t("advancedStats.additions")}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "var(--red)",
              }}
            />
            {t("advancedStats.deletions")}
          </span>
        </div>

        {visible.map((entry) => {
          const addPct = (entry.additions / maxVal) * 100;
          const delPct = (entry.deletions / maxVal) * 100;
          return (
            <div key={entry.date} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  paddingLeft: 0,
                }}
              >
                {entry.date}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 90,
                    flexShrink: 0,
                    fontSize: 11,
                    color: "var(--green)",
                    textAlign: "right",
                  }}
                >
                  +{entry.additions}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 12,
                    background: "var(--surface-0)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${addPct}%`,
                      height: "100%",
                      background: "var(--green)",
                      borderRadius: 3,
                      minWidth: addPct > 0 ? 4 : 0,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 90,
                    flexShrink: 0,
                    fontSize: 11,
                    color: "var(--red)",
                    textAlign: "right",
                  }}
                >
                  -{entry.deletions}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 12,
                    background: "var(--surface-0)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${delPct}%`,
                      height: "100%",
                      background: "var(--red)",
                      borderRadius: 3,
                      minWidth: delPct > 0 ? 4 : 0,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Contributors table                                                    */
/* ------------------------------------------------------------------ */

interface ContributorRow {
  author: string;
  byPeriod: Record<string, number>;
  total: number;
}

const ContributorsTable: React.FC<{
  entries: ContributorTimelineEntry[];
  t: (key: string) => string;
}> = ({ entries, t }) => {
  const allDates = Array.from(new Set(entries.map((e) => e.date)))
    .sort()
    .slice(-MAX_BARS);
  const authorMap = new Map<string, ContributorRow>();

  for (const entry of entries) {
    if (!allDates.includes(entry.date)) continue;
    if (!authorMap.has(entry.author)) {
      authorMap.set(entry.author, { author: entry.author, byPeriod: {}, total: 0 });
    }
    const row = authorMap.get(entry.author)!;
    row.byPeriod[entry.date] = (row.byPeriod[entry.date] ?? 0) + entry.count;
    row.total += entry.count;
  }

  const rows = Array.from(authorMap.values()).sort((a, b) => b.total - a.total);

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: "var(--text-primary)",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "6px 10px",
                background: "var(--surface-0)",
                color: "var(--text-muted)",
                fontWeight: 600,
                fontSize: 11,
                position: "sticky",
                left: 0,
                zIndex: 1,
                borderBottom: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}
            >
              {t("advancedStats.author")}
            </th>
            {allDates.map((date) => (
              <th
                key={date}
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  background: "var(--surface-0)",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 10,
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {date}
              </th>
            ))}
            <th
              style={{
                textAlign: "right",
                padding: "6px 10px",
                background: "var(--surface-0)",
                color: "var(--accent)",
                fontWeight: 700,
                fontSize: 11,
                borderBottom: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}
            >
              {t("advancedStats.total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.author}
              style={{
                background: i % 2 === 0 ? "transparent" : "var(--surface-0)",
              }}
            >
              <td
                style={{
                  padding: "5px 10px",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  position: "sticky",
                  left: 0,
                  background: i % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)",
                  whiteSpace: "nowrap",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {row.author}
              </td>
              {allDates.map((date) => (
                <td
                  key={date}
                  style={{
                    padding: "5px 8px",
                    textAlign: "right",
                    color: (row.byPeriod[date] ?? 0) > 0 ? "var(--blue)" : "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  {row.byPeriod[date] ?? "—"}
                </td>
              ))}
              <td
                style={{
                  padding: "5px 10px",
                  textAlign: "right",
                  fontWeight: 700,
                  color: "var(--accent)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main dialog                                                           */
/* ------------------------------------------------------------------ */

export const AdvancedStatsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("week");
  const [tab, setTab] = useState<Tab>("timeline");

  const [timelineData, setTimelineData] = useState<TimelineEntry[] | null>(null);
  const [churnData, setChurnData] = useState<ChurnEntry[] | null>(null);
  const [contributorsData, setContributorsData] = useState<ContributorTimelineEntry[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (currentTab: Tab, currentPeriod: Period) => {
    setLoading(true);
    setError(null);

    try {
      if (currentTab === "timeline") {
        const data = await window.electronAPI.statsAdvanced.timeline(currentPeriod);
        setTimelineData(data);
      } else if (currentTab === "churn") {
        const data = await window.electronAPI.statsAdvanced.churn(currentPeriod);
        setChurnData(data);
      } else {
        const data = await window.electronAPI.statsAdvanced.contributorsTimeline(currentPeriod);
        setContributorsData(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimelineData(null);
    setChurnData(null);
    setContributorsData(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void fetchData(tab, period);
  }, [open, tab, period, fetchData]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setTimelineData(null);
    setChurnData(null);
    setContributorsData(null);
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
  };

  const renderContent = () => {
    if (loading) return <LoadingState t={t} />;
    if (error) return <ErrorState message={error} />;

    if (tab === "timeline") {
      if (!timelineData) return <LoadingState t={t} />;
      if (timelineData.length === 0)
        return <EmptyState message={t("advancedStats.noDataForPeriod")} />;
      return <TimelineChart entries={timelineData} />;
    }

    if (tab === "churn") {
      if (!churnData) return <LoadingState t={t} />;
      if (churnData.length === 0)
        return <EmptyState message={t("advancedStats.noDataForPeriod")} />;
      return <ChurnChart entries={churnData} t={t} />;
    }

    if (!contributorsData) return <LoadingState t={t} />;
    if (contributorsData.length === 0)
      return <EmptyState message={t("advancedStats.noDataForPeriod")} />;
    return <ContributorsTable entries={contributorsData} t={t} />;
  };

  return (
    <ModalDialog open={open} title={t("advancedStats.title")} onClose={onClose} width={750}>
      {/* Controls bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("advancedStats.period")}
        </span>
        <PeriodSelector value={period} onChange={handlePeriodChange} t={t} />
      </div>

      {/* Tabs */}
      <TabBar value={tab} onChange={handleTabChange} t={t} />

      {/* Chart / table area */}
      <div
        style={{
          marginTop: 16,
          minHeight: 200,
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        {renderContent()}
      </div>

      {/* Footer note when data is capped */}
      {((tab === "timeline" && timelineData && timelineData.length > MAX_BARS) ||
        (tab === "churn" && churnData && churnData.length > MAX_BARS) ||
        (tab === "contributors" &&
          contributorsData &&
          Array.from(new Set(contributorsData.map((e) => e.date))).length > MAX_BARS)) && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "right",
          }}
        >
          {t("advancedStats.showingLast30")}
        </div>
      )}
    </ModalDialog>
  );
};
