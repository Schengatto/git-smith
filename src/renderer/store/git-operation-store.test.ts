import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const mockStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => Object.keys(mockStorage).forEach((k) => delete mockStorage[k]),
  length: 0,
  key: () => null,
});

import { useGitOperationStore, runGitOperation } from "./git-operation-store";
import type { CommandLogEntry } from "../../shared/git-types";

const resetStore = () => {
  useGitOperationStore.setState({
    open: false,
    label: "",
    entries: [],
    outputLines: [],
    running: false,
    error: null,
    _autoCloseTimer: null,
    autoClose: true,
  });
};

describe("Git Operation Store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeEntry = (id: string, exitCode?: number, error?: string): CommandLogEntry => ({
    id,
    command: "git",
    args: ["push"],
    cwd: "/repo",
    timestamp: Date.now(),
    ...(exitCode !== undefined ? { exitCode, duration: 100 } : {}),
    ...(error ? { error } : {}),
  });

  it("starts closed", () => {
    expect(useGitOperationStore.getState().open).toBe(false);
  });

  it("start() opens dialog with label and running state", () => {
    useGitOperationStore.getState().start("Push");
    const state = useGitOperationStore.getState();
    expect(state.open).toBe(true);
    expect(state.label).toBe("Push");
    expect(state.running).toBe(true);
    expect(state.error).toBeNull();
    expect(state.entries).toEqual([]);
  });

  it("addEntry() collects entries while open", () => {
    useGitOperationStore.getState().start("Fetch");
    const entry = makeEntry("cmd-1");
    useGitOperationStore.getState().addEntry(entry);
    expect(useGitOperationStore.getState().entries).toHaveLength(1);
    expect(useGitOperationStore.getState().entries[0].id).toBe("cmd-1");
  });

  it("addEntry() updates existing entry by id", () => {
    useGitOperationStore.getState().start("Fetch");
    useGitOperationStore.getState().addEntry(makeEntry("cmd-1"));
    useGitOperationStore.getState().addEntry(makeEntry("cmd-1", 0));
    expect(useGitOperationStore.getState().entries).toHaveLength(1);
    expect(useGitOperationStore.getState().entries[0].exitCode).toBe(0);
  });

  it("addEntry() ignores entries when dialog is closed", () => {
    useGitOperationStore.getState().addEntry(makeEntry("cmd-1"));
    expect(useGitOperationStore.getState().entries).toHaveLength(0);
  });

  it("finish() with autoClose=true auto-closes after 1.5s", () => {
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().finish();

    expect(useGitOperationStore.getState().running).toBe(false);
    expect(useGitOperationStore.getState().open).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(useGitOperationStore.getState().open).toBe(false);
  });

  it("finish() with autoClose=false keeps dialog open on success", () => {
    useGitOperationStore.getState().setAutoClose(false);
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().finish();

    expect(useGitOperationStore.getState().running).toBe(false);
    expect(useGitOperationStore.getState().error).toBeNull();
    expect(useGitOperationStore.getState().open).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(useGitOperationStore.getState().open).toBe(true); // stays open
  });

  it("finish() with error keeps dialog open regardless of autoClose", () => {
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().finish("pre-push hook failed");

    const state = useGitOperationStore.getState();
    expect(state.running).toBe(false);
    expect(state.error).toBe("pre-push hook failed");
    expect(state.open).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(useGitOperationStore.getState().open).toBe(true);
  });

  it("close() immediately closes dialog and clears state", () => {
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().addEntry(makeEntry("cmd-1"));
    useGitOperationStore.getState().close();

    const state = useGitOperationStore.getState();
    expect(state.open).toBe(false);
    expect(state.entries).toEqual([]);
    expect(state.running).toBe(false);
    expect(state.error).toBeNull();
  });

  it("close() cancels auto-close timer", () => {
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().finish();
    useGitOperationStore.getState().close();

    useGitOperationStore.getState().start("Pull");
    vi.advanceTimersByTime(1500);
    expect(useGitOperationStore.getState().open).toBe(true);
  });

  it("setAutoClose() persists to localStorage", () => {
    useGitOperationStore.getState().setAutoClose(false);
    expect(mockStorage["git-expansion-operation-autoclose"]).toBe("false");
    expect(useGitOperationStore.getState().autoClose).toBe(false);

    useGitOperationStore.getState().setAutoClose(true);
    expect(mockStorage["git-expansion-operation-autoclose"]).toBe("true");
    expect(useGitOperationStore.getState().autoClose).toBe(true);
  });

  it("toggling autoClose on while showing success starts auto-close timer", () => {
    useGitOperationStore.getState().setAutoClose(false);
    useGitOperationStore.getState().start("Push");
    useGitOperationStore.getState().finish();
    expect(useGitOperationStore.getState().open).toBe(true);

    // Toggle auto-close on — should start auto-close
    useGitOperationStore.getState().setAutoClose(true);
    vi.advanceTimersByTime(1500);
    expect(useGitOperationStore.getState().open).toBe(false);
  });

  it("addOutputLine() collects output while open", () => {
    useGitOperationStore.getState().start("Commit");
    useGitOperationStore.getState().addOutputLine({ id: "cmd-1", stream: "stderr", text: "Running pre-commit hook..." });
    expect(useGitOperationStore.getState().outputLines).toHaveLength(1);
    expect(useGitOperationStore.getState().outputLines[0].text).toBe("Running pre-commit hook...");
  });

  it("addOutputLine() ignores lines when dialog is closed", () => {
    useGitOperationStore.getState().addOutputLine({ id: "cmd-1", stream: "stderr", text: "ignored" });
    expect(useGitOperationStore.getState().outputLines).toHaveLength(0);
  });
});

describe("runGitOperation()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens dialog, runs operation, and auto-closes on success", async () => {
    const result = await runGitOperation("Push", async () => {
      expect(useGitOperationStore.getState().open).toBe(true);
      expect(useGitOperationStore.getState().running).toBe(true);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(useGitOperationStore.getState().running).toBe(false);
    expect(useGitOperationStore.getState().error).toBeNull();
  });

  it("keeps dialog open on error and re-throws", async () => {
    await expect(
      runGitOperation("Push", async () => {
        throw new Error("hook failed");
      })
    ).rejects.toThrow("hook failed");

    const state = useGitOperationStore.getState();
    expect(state.open).toBe(true);
    expect(state.running).toBe(false);
    expect(state.error).toBe("hook failed");
  });

  it("returns the value from the operation", async () => {
    const result = await runGitOperation("Merge", async () => "merge-result");
    expect(result).toBe("merge-result");
  });
});
