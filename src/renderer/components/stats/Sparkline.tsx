import React from "react";

interface DataPoint {
  date: string;
  count: number;
}

interface SparklineProps {
  data: DataPoint[];
  teamData?: DataPoint[];
  width?: number;
  height?: number;
}

function buildPolylinePoints(
  data: DataPoint[],
  width: number,
  height: number,
  padding: number
): string {
  if (data.length === 0) return "";
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return data
    .map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = padding + innerH - (d.count / maxVal) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildFillPath(data: DataPoint[], width: number, height: number, padding: number): string {
  if (data.length === 0) return "";
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = padding + innerH - (d.count / maxVal) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const firstX = padding;
  const lastX = padding + innerW;
  const bottomY = padding + innerH;
  return `M${firstX},${bottomY} L${points.join(" L")} L${lastX},${bottomY} Z`;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  teamData,
  width = 400,
  height = 80,
}) => {
  const padding = 6;
  const gradientId = React.useId();

  if (data.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: "block" }} aria-label="No data">
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "var(--text-muted)", fontSize: 12 }}
        >
          No data
        </text>
      </svg>
    );
  }

  const authorPoints = buildPolylinePoints(data, width, height, padding);
  const fillPath = buildFillPath(data, width, height, padding);
  const teamPoints =
    teamData && teamData.length > 0 ? buildPolylinePoints(teamData, width, height, padding) : null;

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", overflow: "visible" }}
      aria-label="Commit activity sparkline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Fill area below author line */}
      <path d={fillPath} fill={`url(#${gradientId})`} />

      {/* Team average line (dashed) */}
      {teamPoints && (
        <polyline
          points={teamPoints}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Author line (solid) */}
      <polyline
        points={authorPoints}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
