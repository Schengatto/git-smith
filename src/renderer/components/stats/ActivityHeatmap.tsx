import React from "react";
import { useTranslation } from "react-i18next";

interface ActivityHeatmapProps {
  hourlyDistribution: number[];
  dailyDistribution: number[];
}

const DAY_LABEL_KEYS = [
  "activityHeatmap.sun",
  "activityHeatmap.mon",
  "activityHeatmap.tue",
  "activityHeatmap.wed",
  "activityHeatmap.thu",
  "activityHeatmap.fri",
  "activityHeatmap.sat",
];
const HOUR_TICK_LABELS: { hour: number; label: string }[] = [
  { hour: 0, label: "0" },
  { hour: 6, label: "6" },
  { hour: 12, label: "12" },
  { hour: 18, label: "18" },
];

function cellOpacity(value: number, max: number): number {
  if (max === 0) return 0;
  return value / max;
}

function heatmapColor(value: number, max: number): string {
  const opacity = cellOpacity(value, max);
  if (opacity === 0) return "var(--surface-2)";
  const pct = Math.round((0.15 + opacity * 0.85) * 100);
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  hourlyDistribution,
  dailyDistribution,
}) => {
  const { t } = useTranslation();
  const hours = hourlyDistribution.length === 24 ? hourlyDistribution : Array(24).fill(0);
  const days = dailyDistribution.length === 7 ? dailyDistribution : Array(7).fill(0);

  const maxHour = Math.max(...hours, 1);
  const maxDay = Math.max(...days, 1);

  const cellSize = 18;
  const cellGap = 3;
  const labelW = 28;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hourly distribution */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {t("activityHeatmap.activityByHour")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div
            style={{
              width: labelW,
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "right",
              paddingRight: 6,
              flexShrink: 0,
            }}
          >
            {t("activityHeatmap.hour")}
          </div>
          <div style={{ display: "flex", gap: cellGap }}>
            {hours.map((val, i) => (
              <div
                key={i}
                title={t("activityHeatmap.hourCommits", { hour: i, count: val })}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 3,
                  backgroundColor: heatmapColor(val, maxHour),
                  flexShrink: 0,
                  cursor: "default",
                }}
              />
            ))}
          </div>
        </div>
        {/* Tick labels */}
        <div
          style={{
            display: "flex",
            marginLeft: labelW,
            position: "relative",
            height: 16,
          }}
        >
          {HOUR_TICK_LABELS.map(({ hour, label }) => (
            <span
              key={hour}
              style={{
                position: "absolute",
                left: hour * (cellSize + cellGap),
                fontSize: 10,
                color: "var(--text-muted)",
                transform: "translateX(-50%)",
                userSelect: "none",
              }}
            >
              {label}
            </span>
          ))}
          {/* Last label at 23 */}
          <span
            style={{
              position: "absolute",
              left: 23 * (cellSize + cellGap) + cellSize,
              fontSize: 10,
              color: "var(--text-muted)",
              transform: "translateX(-50%)",
              userSelect: "none",
            }}
          >
            24
          </span>
        </div>
      </div>

      {/* Daily distribution */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {t("activityHeatmap.activityByDay")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div
            style={{
              width: labelW,
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "right",
              paddingRight: 6,
              flexShrink: 0,
            }}
          >
            {t("activityHeatmap.day")}
          </div>
          <div style={{ display: "flex", gap: cellGap }}>
            {days.map((val, i) => (
              <div
                key={i}
                title={t("activityHeatmap.dayCommits", { day: t(DAY_LABEL_KEYS[i]!), count: val })}
                style={{
                  width: cellSize + 10,
                  height: cellSize,
                  borderRadius: 3,
                  backgroundColor: heatmapColor(val, maxDay),
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        </div>
        {/* Day labels */}
        <div
          style={{
            display: "flex",
            marginLeft: labelW,
            gap: cellGap,
          }}
        >
          {DAY_LABEL_KEYS.map((key, i) => (
            <span
              key={i}
              style={{
                width: cellSize + 10,
                textAlign: "center",
                fontSize: 10,
                color: "var(--text-muted)",
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {t("activityHeatmap.less")}
        </span>
        {[0, 0.25, 0.5, 0.75, 1].map((opacity, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor:
                opacity === 0
                  ? "var(--surface-2)"
                  : `rgba(147, 187, 255, ${0.15 + opacity * 0.85})`,
            }}
          />
        ))}
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {t("activityHeatmap.more")}
        </span>
      </div>
    </div>
  );
};
