// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Sparkline } from "./Sparkline";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeData(counts: number[]) {
  return counts.map((count, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, "0")}`,
    count,
  }));
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("Sparkline", () => {
  // ── Empty data ───────────────────────────────────────────────────────────────

  it("renders an SVG when data is empty", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders 'No data' text when data is empty", () => {
    render(<Sparkline data={[]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("sets aria-label to 'No data' on empty SVG", () => {
    const { container } = render(<Sparkline data={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-label", "No data");
  });

  it("uses provided width and height on empty SVG", () => {
    const { container } = render(<Sparkline data={[]} width={300} height={60} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "300");
    expect(svg).toHaveAttribute("height", "60");
  });

  it("defaults to width=400 height=80 when not specified", () => {
    const { container } = render(<Sparkline data={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "400");
    expect(svg).toHaveAttribute("height", "80");
  });

  // ── Non-empty data ───────────────────────────────────────────────────────────

  it("renders an SVG with aria-label 'Commit activity sparkline' when data is present", () => {
    const { container } = render(<Sparkline data={makeData([5, 10, 3])} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-label", "Commit activity sparkline");
  });

  it("does NOT render 'No data' when data is present", () => {
    render(<Sparkline data={makeData([5, 10, 3])} />);
    expect(screen.queryByText("No data")).not.toBeInTheDocument();
  });

  it("renders the author polyline", () => {
    const { container } = render(<Sparkline data={makeData([5, 10, 3])} />);
    const polylines = container.querySelectorAll("polyline");
    expect(polylines.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the fill path element", () => {
    const { container } = render(<Sparkline data={makeData([5, 10, 3])} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
  });

  it("author polyline has a non-empty points attribute", () => {
    const { container } = render(<Sparkline data={makeData([5, 10, 3])} />);
    // The last polyline is the solid author line
    const polylines = container.querySelectorAll("polyline");
    const authorPolyline = polylines[polylines.length - 1]!;
    expect(authorPolyline.getAttribute("points")).not.toBe("");
  });

  it("fill path has a non-empty d attribute", () => {
    const { container } = render(<Sparkline data={makeData([5, 10])} />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).not.toBe("");
  });

  it("uses provided width and height on the data SVG", () => {
    const { container } = render(<Sparkline data={makeData([1, 2])} width={200} height={50} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "200");
    expect(svg).toHaveAttribute("height", "50");
  });

  // ── Single data point ─────────────────────────────────────────────────────────

  it("renders with a single data point without crashing", () => {
    const { container } = render(<Sparkline data={makeData([7])} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("single data point polyline has points attribute", () => {
    const { container } = render(<Sparkline data={makeData([7])} />);
    const polylines = container.querySelectorAll("polyline");
    const authorPolyline = polylines[polylines.length - 1]!;
    expect(authorPolyline.getAttribute("points")).toBeTruthy();
  });

  // ── All-zero data ─────────────────────────────────────────────────────────────

  it("renders without crashing when all counts are 0", () => {
    const { container } = render(<Sparkline data={makeData([0, 0, 0])} />);
    // maxVal is Math.max(...counts, 1) = 1, so no division by zero
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText("No data")).not.toBeInTheDocument();
  });

  // ── Team data overlay ─────────────────────────────────────────────────────────

  it("renders no dashed team polyline when teamData is not provided", () => {
    const { container } = render(<Sparkline data={makeData([3, 5])} />);
    const polylines = container.querySelectorAll("polyline");
    // Only the author polyline — no dashed one
    expect(polylines).toHaveLength(1);
  });

  it("renders a dashed team polyline when teamData is provided", () => {
    const { container } = render(<Sparkline data={makeData([3, 5])} teamData={makeData([4, 6])} />);
    const polylines = container.querySelectorAll("polyline");
    // Should have team (dashed) + author (solid)
    expect(polylines).toHaveLength(2);
  });

  it("team polyline has strokeDasharray attribute", () => {
    const { container } = render(<Sparkline data={makeData([3, 5])} teamData={makeData([4, 6])} />);
    const polylines = container.querySelectorAll("polyline");
    // First polyline is the dashed team line
    expect(polylines[0]).toHaveAttribute("stroke-dasharray");
  });

  it("does not render team polyline when teamData is empty array", () => {
    const { container } = render(<Sparkline data={makeData([3, 5])} teamData={[]} />);
    const polylines = container.querySelectorAll("polyline");
    expect(polylines).toHaveLength(1);
  });

  // ── SVG gradient defs ─────────────────────────────────────────────────────────

  it("renders a linearGradient in defs", () => {
    const { container } = render(<Sparkline data={makeData([2, 8])} />);
    expect(container.querySelector("defs linearGradient")).toBeInTheDocument();
  });

  it("fill path references the gradient", () => {
    const { container } = render(<Sparkline data={makeData([2, 8])} />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("fill")).toMatch(/^url\(#/);
  });

  // ── Point coordinate correctness (regression) ─────────────────────────────────

  it("author line contains correct number of coordinate pairs", () => {
    const data = makeData([1, 2, 3, 4, 5]);
    const { container } = render(<Sparkline data={data} />);
    const polylines = container.querySelectorAll("polyline");
    const author = polylines[polylines.length - 1]!;
    const points = author.getAttribute("points")!.trim().split(/\s+/);
    // One "x,y" pair per data point
    expect(points).toHaveLength(5);
  });
});
