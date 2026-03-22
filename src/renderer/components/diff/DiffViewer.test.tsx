// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock diff2html so we don't need real CSS/browser rendering
vi.mock("diff2html", () => ({
  html: vi.fn().mockReturnValue("<div class='d2h-wrapper'>mock diff html</div>"),
}));

vi.mock("diff2html/lib/ui/js/diff2html-ui-slim", () => ({
  Diff2HtmlUI: vi.fn().mockImplementation(() => ({
    draw: vi.fn(),
    highlightCode: vi.fn(),
  })),
}));

vi.mock("diff2html/bundles/css/diff2html.min.css", () => ({}));

vi.mock("diff2html/lib/types", () => ({
  ColorSchemeType: { DARK: "dark" },
}));

import { DiffViewer } from "./DiffViewer";
import { ImageDiffViewer, isImageFile } from "./ImageDiffViewer";

const SAMPLE_DIFF = `--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,4 @@
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 export { x, y };`;

describe("DiffViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing with a valid diff", () => {
    const { container } = render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(container).toBeTruthy();
  });

  it("renders 'No diff available' when rawDiff is empty", () => {
    render(<DiffViewer rawDiff="" />);
    expect(screen.getByText("No diff available")).toBeInTheDocument();
  });

  it("renders the diff message when rawDiff starts with '('", () => {
    render(<DiffViewer rawDiff="(Binary file not shown)" />);
    expect(screen.getByText("(Binary file not shown)")).toBeInTheDocument();
  });

  it("renders file name in header when fileName prop is provided", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} fileName="src/example.ts" />);
    expect(screen.getByText("src/example.ts")).toBeInTheDocument();
  });

  it("does not render file name span when fileName is not provided", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(screen.queryByText("src/example.ts")).not.toBeInTheDocument();
  });

  it("renders format toggle buttons when showFormatToggle is true (default)", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(screen.getByText("Unified")).toBeInTheDocument();
    expect(screen.getByText("Split")).toBeInTheDocument();
  });

  it("does not render format toggle buttons when showFormatToggle is false", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} showFormatToggle={false} />);
    expect(screen.queryByText("Unified")).not.toBeInTheDocument();
    expect(screen.queryByText("Split")).not.toBeInTheDocument();
  });

  it("renders syntax highlight toggle button", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(screen.getByText("Syntax")).toBeInTheDocument();
  });

  it("toggles syntax highlighting when Syntax button is clicked", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    const btn = screen.getByText("Syntax");
    expect(btn).toBeInTheDocument();
    // Initially enabled; click to disable
    fireEvent.click(btn);
    // After click syntax highlight is off → button title changes
    expect(btn.closest("button")).toHaveAttribute("title", "Enable syntax highlighting");
  });

  it("toggles back to syntax highlighting when clicked again", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    const btn = screen.getByText("Syntax");
    fireEvent.click(btn); // disable
    fireEvent.click(btn); // re-enable
    expect(btn.closest("button")).toHaveAttribute("title", "Disable syntax highlighting");
  });

  it("switches to side-by-side format when Split button is clicked", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    const splitBtn = screen.getByText("Split");
    fireEvent.click(splitBtn);
    // Unified button should not be active (no accent background via inline style)
    const unifiedBtn = screen.getByText("Unified");
    expect(unifiedBtn).toBeInTheDocument();
  });

  it("switches back to unified when Unified button is clicked after Split", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    fireEvent.click(screen.getByText("Split"));
    fireEvent.click(screen.getByText("Unified"));
    expect(screen.getByText("Unified")).toBeInTheDocument();
  });

  it("respects initialFormat prop 'side-by-side'", () => {
    render(<DiffViewer rawDiff={SAMPLE_DIFF} outputFormat="side-by-side" />);
    // Both buttons should render; Split should be active
    expect(screen.getByText("Split")).toBeInTheDocument();
    expect(screen.getByText("Unified")).toBeInTheDocument();
  });

  it("renders the diff container div", () => {
    const { container } = render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(container.querySelector(".diff-viewer")).toBeInTheDocument();
  });

  it("renders the diff2html wrapper div", () => {
    const { container } = render(<DiffViewer rawDiff={SAMPLE_DIFF} />);
    expect(container.querySelector(".diff2html-wrapper")).toBeInTheDocument();
  });

  it("renders empty state container for empty rawDiff", () => {
    const { container } = render(<DiffViewer rawDiff="" />);
    expect(container.querySelector(".empty-state")).toBeInTheDocument();
  });
});

describe("ImageDiffViewer", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ImageDiffViewer commitHash="abc123" filePath="images/logo.png" />
    );
    expect(container).toBeTruthy();
  });

  it("renders the file path", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="images/logo.png" />);
    expect(screen.getByText("images/logo.png")).toBeInTheDocument();
  });

  it("renders 'Binary image file' label", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.jpg" />);
    expect(screen.getByText("Binary image file")).toBeInTheDocument();
  });

  it("renders mode selector buttons", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    expect(screen.getByText("Side by Side")).toBeInTheDocument();
    expect(screen.getByText("Slider")).toBeInTheDocument();
    expect(screen.getByText("Onion Skin")).toBeInTheDocument();
  });

  it("shows slider input when Slider mode is selected", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    fireEvent.click(screen.getByText("Slider"));
    const slider = document.querySelector("input[type=range]");
    expect(slider).toBeInTheDocument();
  });

  it("shows opacity slider when Onion Skin mode is selected", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    fireEvent.click(screen.getByText("Onion Skin"));
    expect(screen.getByText(/Opacity:/)).toBeInTheDocument();
  });

  it("does not show slider in default side-by-side mode", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    expect(document.querySelector("input[type=range]")).not.toBeInTheDocument();
  });

  it("updates slider percentage label on input change", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    fireEvent.click(screen.getByText("Slider"));
    const slider = document.querySelector("input[type=range]") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "30" } });
    expect(screen.getByText(/Old 30%/)).toBeInTheDocument();
  });

  it("updates opacity label on input change", () => {
    render(<ImageDiffViewer commitHash="abc123" filePath="test.png" />);
    fireEvent.click(screen.getByText("Onion Skin"));
    const slider = document.querySelector("input[type=range]") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "75" } });
    expect(screen.getByText(/Opacity: 75%/)).toBeInTheDocument();
  });
});

describe("isImageFile", () => {
  it("returns true for .png files", () => {
    expect(isImageFile("photo.png")).toBe(true);
  });

  it("returns true for .jpg files", () => {
    expect(isImageFile("photo.jpg")).toBe(true);
  });

  it("returns true for .jpeg files", () => {
    expect(isImageFile("photo.jpeg")).toBe(true);
  });

  it("returns true for .gif files", () => {
    expect(isImageFile("animation.gif")).toBe(true);
  });

  it("returns true for .svg files", () => {
    expect(isImageFile("icon.svg")).toBe(true);
  });

  it("returns true for .webp files", () => {
    expect(isImageFile("image.webp")).toBe(true);
  });

  it("returns true for .ico files", () => {
    expect(isImageFile("favicon.ico")).toBe(true);
  });

  it("returns false for .ts files", () => {
    expect(isImageFile("script.ts")).toBe(false);
  });

  it("returns false for .tsx files", () => {
    expect(isImageFile("Component.tsx")).toBe(false);
  });

  it("returns false for files with no extension", () => {
    expect(isImageFile("Makefile")).toBe(false);
  });

  it("is case-insensitive for extensions", () => {
    expect(isImageFile("photo.PNG")).toBe(true);
    expect(isImageFile("image.JPG")).toBe(true);
  });
});
