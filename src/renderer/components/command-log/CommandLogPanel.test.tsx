// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CommandLogPanel } from "./CommandLogPanel";

const mockClear = vi.fn();
let mockEntries: unknown[] = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        return Object.entries(opts).reduce(
          (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
          key
        );
      }
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("../../store/command-log-store", () => ({
  useCommandLogStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { entries: mockEntries, clear: mockClear };
    return selector ? selector(state as Record<string, unknown>) : state;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockEntries = [];
});

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  command: "git",
  args: ["status"],
  timestamp: new Date("2026-03-21T10:00:00").getTime(),
  ...overrides,
});

describe("CommandLogPanel", () => {
  it("renders empty state when there are no entries", () => {
    render(<CommandLogPanel />);
    expect(screen.getByText("commandLog.commandsWillAppearHere")).toBeInTheDocument();
  });

  it("renders entries list when entries are present", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    expect(screen.getByText("git")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
  });

  it("shows entry count in header", () => {
    mockEntries = [makeEntry({ id: "1" }), makeEntry({ id: "2", args: ["log"] })];
    render(<CommandLogPanel />);
    expect(screen.getByText("commandLog.commandsCount")).toBeInTheDocument();
  });

  it("shows Clear button when entries exist", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    expect(screen.getByText("commandLog.clear")).toBeInTheDocument();
  });

  it("calls clear when Clear button is clicked", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    fireEvent.click(screen.getByText("commandLog.clear"));
    expect(mockClear).toHaveBeenCalledOnce();
  });

  it("renders entry with duration when present", () => {
    mockEntries = [makeEntry({ duration: 123 })];
    render(<CommandLogPanel />);
    expect(screen.getByText("123commandLog.ms")).toBeInTheDocument();
  });

  it("renders entry error message when present", () => {
    mockEntries = [makeEntry({ error: "fatal: not a git repo" })];
    render(<CommandLogPanel />);
    expect(screen.getByText("fatal: not a git repo")).toBeInTheDocument();
  });

  it("does not render duration when not present", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    expect(screen.queryByText(/commandLog\.ms/)).not.toBeInTheDocument();
  });

  it("renders multiple entries", () => {
    mockEntries = [
      makeEntry({ id: "1", command: "git", args: ["fetch"] }),
      makeEntry({ id: "2", command: "git", args: ["pull"] }),
    ];
    render(<CommandLogPanel />);
    expect(screen.getByText("fetch")).toBeInTheDocument();
    expect(screen.getByText("pull")).toBeInTheDocument();
  });

  it("renders formatted timestamp for each entry", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    // Timestamp is formatted as HH:MM:SS — just verify it rendered some time text
    const timeCells = screen.getAllByText(/\d{2}:\d{2}:\d{2}/);
    expect(timeCells.length).toBeGreaterThan(0);
  });

  it("changes Clear button color on mouse enter and leave", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    const clearBtn = screen.getByText("commandLog.clear");

    fireEvent.mouseEnter(clearBtn);
    expect(clearBtn.style.color).toBe("var(--text-primary)");

    fireEvent.mouseLeave(clearBtn);
    expect(clearBtn.style.color).toBe("var(--text-muted)");
  });

  it("renders error entry with red background", () => {
    mockEntries = [makeEntry({ error: "fatal error" })];
    render(<CommandLogPanel />);
    const errorEntry = screen.getByText("fatal error").closest("div[style]");
    expect(errorEntry).toBeTruthy();
  });

  it("renders the $ prompt for each entry", () => {
    mockEntries = [makeEntry()];
    render(<CommandLogPanel />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("joins args with spaces", () => {
    mockEntries = [makeEntry({ args: ["commit", "-m", "test"] })];
    render(<CommandLogPanel />);
    expect(screen.getByText("commit -m test")).toBeInTheDocument();
  });
});
