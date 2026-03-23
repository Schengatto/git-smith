// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "blame.title": "Blame",
        "blame.lines": "{{count}} lines",
        "blame.showInGraph": "Show in graph",
        "blame.loadingBlame": "Loading blame...",
        "blame.noBlameData": "No blame data",
        "blame.older": "older",
        "blame.newer": "newer",
      };
      let result = translations[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
      }
      return result;
    },
    i18n: { language: "en" },
  }),
}));

import { BlameView } from "./BlameView";

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockSelectCommit = vi.fn();

vi.mock("../../store/graph-store", () => ({
  useGraphStore: (selector?: (s: unknown) => unknown) => {
    const state = { selectCommit: mockSelectCommit };
    return selector ? selector(state) : state;
  },
}));

// A minimal but realistic porcelain blame output for two distinct commits.
// timestamp 1609459200 = 2021-01-01, timestamp 1640995200 = 2022-01-01
// Use distinct 8-char prefixes: "aabbccdd" vs "11223344"
const BLAME_RAW = [
  "aabbccdd00000000000000000000000000000001 1 1",
  "author Alice",
  "author-time 1609459200",
  "author-tz +0000",
  "\tconsole.log('hello');",
  "1122334400000000000000000000000000000002 2 2",
  "author Bob",
  "author-time 1640995200",
  "author-tz +0000",
  "\tconsole.log('world');",
].join("\n");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockBlameFile: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockBlameFile = vi.fn().mockResolvedValue(BLAME_RAW);
  (
    window as unknown as { electronAPI: { blame: { file: ReturnType<typeof vi.fn> } } }
  ).electronAPI = { blame: { file: mockBlameFile } };
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  filePath: "src/app.ts",
};

function renderOpen(props: Partial<typeof defaultProps> = {}) {
  const merged = { ...defaultProps, onClose: vi.fn(), ...props };
  return { ...render(<BlameView {...merged} />), onClose: merged.onClose };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("BlameView", () => {
  // ── Not rendered when closed ─────────────────────────────────────────────────

  it("renders nothing when closed", () => {
    const { container } = render(
      <BlameView open={false} onClose={vi.fn()} filePath="src/app.ts" />
    );
    expect(container.innerHTML).toBe("");
  });

  // ── Loading state ────────────────────────────────────────────────────────────

  it("shows 'Loading blame...' while fetching", () => {
    // Return a promise that never resolves so we stay in loading state
    mockBlameFile.mockReturnValue(new Promise(() => {}));
    renderOpen();
    expect(screen.getByText("Loading blame...")).toBeInTheDocument();
  });

  it("does not call blame.file when filePath is empty", () => {
    renderOpen({ filePath: "" });
    expect(mockBlameFile).not.toHaveBeenCalled();
  });

  it("calls electronAPI.blame.file with the correct filePath", async () => {
    renderOpen({ filePath: "src/foo/bar.ts" });
    await waitFor(() => expect(mockBlameFile).toHaveBeenCalledWith("src/foo/bar.ts"));
  });

  // ── Empty state ──────────────────────────────────────────────────────────────

  it("shows 'No blame data' when blame returns empty string", async () => {
    mockBlameFile.mockResolvedValue("");
    renderOpen();
    await waitFor(() => expect(screen.getByText("No blame data")).toBeInTheDocument());
  });

  it("shows 'No blame data' when blame API rejects", async () => {
    mockBlameFile.mockRejectedValue(new Error("git error"));
    renderOpen();
    await waitFor(() => expect(screen.getByText("No blame data")).toBeInTheDocument());
  });

  // ── Blame data rendering ─────────────────────────────────────────────────────

  it("renders the file path in the header", async () => {
    renderOpen({ filePath: "src/app.ts" });
    await waitFor(() => screen.getByText("Alice")); // data loaded
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("renders line count badge after loading", async () => {
    renderOpen();
    await waitFor(() => expect(screen.getByText("2 lines")).toBeInTheDocument());
  });

  it("renders author names for each distinct commit", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders abbreviated commit hashes (8 chars)", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("aabbccdd"));
    const hash1 = screen.getByText("aabbccdd");
    expect(hash1).toBeInTheDocument();
    expect(hash1).toHaveStyle("color: var(--accent)");
    // Second commit's short hash
    const hash2 = screen.getByText("11223344");
    expect(hash2).toBeInTheDocument();
    expect(hash2).toHaveStyle("color: var(--accent)");
  });

  it("renders line numbers", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("1"));
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders source line content without leading tab", async () => {
    renderOpen();
    await waitFor(() => expect(screen.getByText("console.log('hello');")).toBeInTheDocument());
    expect(screen.getByText("console.log('world');")).toBeInTheDocument();
  });

  it("renders a table for blame output", async () => {
    const { container } = renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    expect(container.querySelector("table")).toBeInTheDocument();
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  // ── Legend ───────────────────────────────────────────────────────────────────

  it("renders the older/newer legend", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    // The legend text nodes sit next to coloured spans; use getAllByText to be safe.
    expect(screen.getAllByText(/older/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/newer/).length).toBeGreaterThan(0);
  });

  // ── Row selection ────────────────────────────────────────────────────────────

  it("clicking a blame row selects its hash", async () => {
    const { container } = renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    const rows = container.querySelectorAll("tbody tr");
    fireEvent.click(rows[0]!);
    // After selection the row gets accent-dim background
    expect(rows[0]).toHaveStyle("background: var(--accent-dim)");
  });

  it("clicking the same row twice deselects it", async () => {
    const { container } = renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    const rows = container.querySelectorAll("tbody tr");
    fireEvent.click(rows[0]!);
    fireEvent.click(rows[0]!);
    // Background should not be accent-dim anymore (it will be the ageColor value)
    expect(rows[0]).not.toHaveStyle("background: var(--accent-dim)");
  });

  // ── Navigate to commit ───────────────────────────────────────────────────────

  it("clicking a hash link calls selectCommit and onClose", async () => {
    const { onClose } = renderOpen();
    await waitFor(() => screen.getByText("aabbccdd"));
    // There is exactly one element with the first commit's short hash
    const hashLink = screen.getByText("aabbccdd");
    fireEvent.click(hashLink);
    expect(mockSelectCommit).toHaveBeenCalledWith("aabbccdd00000000000000000000000000000001");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking a hash link does not propagate to the row click handler", async () => {
    const { container } = renderOpen();
    await waitFor(() => screen.getByText("aabbccdd"));
    const hashLink = screen.getByText("aabbccdd");
    fireEvent.click(hashLink);
    // Row should NOT switch to selected state (event was stopped)
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).not.toHaveStyle("background: var(--accent-dim)");
  });

  // ── Close button ─────────────────────────────────────────────────────────────

  it("clicking the close button calls onClose", async () => {
    const { onClose } = renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    // The X close button (last SVG button in the header area)
    const closeBtns = screen.getAllByRole("button");
    fireEvent.click(closeBtns[closeBtns.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop overlay calls onClose", async () => {
    const { container, onClose } = renderOpen();
    await waitFor(() => screen.getByText("Alice"));
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Re-fetch when filePath or open changes ───────────────────────────────────

  it("re-fetches blame when filePath prop changes", async () => {
    const { rerender } = renderOpen({ filePath: "a.ts" });
    await waitFor(() => expect(mockBlameFile).toHaveBeenCalledWith("a.ts"));
    rerender(<BlameView open={true} onClose={vi.fn()} filePath="b.ts" />);
    await waitFor(() => expect(mockBlameFile).toHaveBeenCalledWith("b.ts"));
  });

  it("shows 'Blame' heading in header", async () => {
    renderOpen();
    expect(screen.getByText("Blame")).toBeInTheDocument();
  });
});
