// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";

// Use vi.hoisted so mocks are available when vi.mock factory runs
const { MockTerminal, MockFitAddon } = vi.hoisted(() => {
  class MockTerminal {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
    cols = 80;
    rows = 24;
    onData = vi.fn((_cb: (data: string) => void) => ({ dispose: vi.fn() }));
  }

  class MockFitAddon {
    fit = vi.fn();
  }

  return { MockTerminal, MockFitAddon };
});

vi.mock("@xterm/xterm", () => ({
  Terminal: MockTerminal,
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: MockFitAddon,
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      repo: {
        path: "/repo/my-project",
        name: "my-project",
        currentBranch: "main",
        isDirty: false,
        headCommit: "abc",
      },
    };
    return selector ? selector(state as Record<string, unknown>) : state;
  }),
}));

const spawnMock = vi.fn().mockResolvedValue(undefined);
const inputMock = vi.fn();
const resizeMock = vi.fn();
const killMock = vi.fn();
const onTerminalDataMock = vi.fn().mockReturnValue(() => {});
const onTerminalExitMock = vi.fn().mockReturnValue(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  spawnMock.mockResolvedValue(undefined);
  onTerminalDataMock.mockReturnValue(() => {});
  onTerminalExitMock.mockReturnValue(() => {});

  (window as unknown as Record<string, unknown>).electronAPI = {
    terminal: {
      spawn: spawnMock,
      input: inputMock,
      resize: resizeMock,
      kill: killMock,
    },
    on: {
      terminalData: onTerminalDataMock,
      terminalExit: onTerminalExitMock,
    },
  };

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });

  // ResizeObserver must be a proper class (not arrow fn) for `new ResizeObserver()` to work
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: ResizeObserverCallback) {}
  }
  (globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver;
});

import { ConsolePanel } from "./ConsolePanel";

describe("ConsolePanel", () => {
  it("renders a container div", () => {
    const { container } = render(<ConsolePanel />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders an outer flex column div", () => {
    const { container } = render(<ConsolePanel />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("flex-col");
  });

  it("calls terminal.spawn on mount", async () => {
    render(<ConsolePanel />);
    await waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });
  });

  it("subscribes to terminal data events after spawn", async () => {
    render(<ConsolePanel />);
    await waitFor(() => {
      expect(onTerminalDataMock).toHaveBeenCalled();
    });
  });

  it("subscribes to terminal exit events after spawn", async () => {
    render(<ConsolePanel />);
    await waitFor(() => {
      expect(onTerminalExitMock).toHaveBeenCalled();
    });
  });

  it("calls terminal.kill on unmount", async () => {
    const { unmount } = render(<ConsolePanel />);
    await waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });
    unmount();
    expect(killMock).toHaveBeenCalled();
  });

  it("renders inner xterm container div", () => {
    const { container } = render(<ConsolePanel />);
    const outer = container.firstChild as HTMLElement;
    const inner = outer.firstChild as HTMLElement;
    expect(inner).toBeInTheDocument();
    expect(inner.style.overflow).toBe("hidden");
  });

  it("does not crash when repo is null", async () => {
    const { useRepoStore } = await import("../../store/repo-store");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(useRepoStore) as any).mockImplementation(
      (selector?: (s: Record<string, unknown>) => unknown) => {
        const state = { repo: null };
        return selector ? selector(state as Record<string, unknown>) : state;
      }
    );
    const { container } = render(<ConsolePanel />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
