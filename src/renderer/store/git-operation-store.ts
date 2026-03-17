import { create } from "zustand";
import type { CommandLogEntry, CommandOutputLine } from "../../shared/git-types";

export interface OutputLine {
  stream: "stdout" | "stderr";
  text: string;
  /** Which command entry this line belongs to */
  entryId: string;
}

/** Thrown when the user cancels a running git operation */
export class GitOperationCancelledError extends Error {
  readonly cancelled = true;
  constructor() {
    super("Cancelled");
  }
}

const AUTOCLOSE_KEY = "git-expansion-operation-autoclose";

function getPersistedAutoClose(): boolean {
  try {
    return localStorage.getItem(AUTOCLOSE_KEY) !== "false";
  } catch {
    return true;
  }
}

interface GitOperationState {
  /** Whether the operation log dialog is visible */
  open: boolean;
  /** Label shown in the dialog title (e.g. "Push", "Pull --rebase") */
  label: string;
  /** Command log entries collected during the current operation */
  entries: CommandLogEntry[];
  /** Output lines (stdout/stderr) collected during the current operation */
  outputLines: OutputLine[];
  /** Whether the operation is still running */
  running: boolean;
  /** Error message if the operation failed */
  error: string | null;
  /** Auto-close timer id */
  _autoCloseTimer: ReturnType<typeof setTimeout> | null;
  /** Whether to auto-close the dialog on success */
  autoClose: boolean;
  /** Whether the current operation was cancelled by the user */
  cancelled: boolean;

  /** Start tracking a new operation */
  start: (label: string) => void;
  /** Feed a command log entry (called from the commandLog listener) */
  addEntry: (entry: CommandLogEntry) => void;
  /** Feed an output line (called from the commandOutput listener) */
  addOutputLine: (line: CommandOutputLine) => void;
  /** Mark the operation as completed (success or error) */
  finish: (error?: string) => void;
  /** Close the dialog */
  close: () => void;
  /** Cancel the running operation: kill the git process and close the dialog */
  cancel: () => void;
  /** Toggle auto-close preference */
  setAutoClose: (value: boolean) => void;
}

export const useGitOperationStore = create<GitOperationState>((set, get) => ({
  open: false,
  label: "",
  entries: [],
  outputLines: [],
  running: false,
  error: null,
  _autoCloseTimer: null,
  autoClose: getPersistedAutoClose(),
  cancelled: false,

  start: (label: string) => {
    const prev = get()._autoCloseTimer;
    if (prev) clearTimeout(prev);
    set({
      open: true,
      label,
      entries: [],
      outputLines: [],
      running: true,
      error: null,
      cancelled: false,
      _autoCloseTimer: null,
    });
  },

  addEntry: (entry: CommandLogEntry) => {
    const state = get();
    if (!state.open) return;
    // Only accept new entries while the operation is running;
    // allow updates to existing entries (e.g. exitCode/duration) even after finish
    const idx = state.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      set((s) => {
        const updated = [...s.entries];
        updated[idx] = entry;
        return { entries: updated };
      });
    } else if (state.running) {
      set((s) => ({ entries: [...s.entries, entry] }));
    }
  },

  addOutputLine: (line: CommandOutputLine) => {
    const state = get();
    if (!state.open || !state.running) return;
    set((s) => ({
      outputLines: [...s.outputLines, { stream: line.stream, text: line.text, entryId: line.id }],
    }));
  },

  finish: (error?: string) => {
    if (!error) {
      if (get().autoClose) {
        // Auto-close after 1.5s on success
        const timer = setTimeout(() => {
          const state = get();
          if (state.open && !state.error) {
            set({ open: false, entries: [], outputLines: [], running: false });
          }
        }, 1500);
        set({ running: false, error: null, _autoCloseTimer: timer });
      } else {
        set({ running: false, error: null });
      }
    } else {
      set({ running: false, error });
    }
  },

  close: () => {
    const prev = get()._autoCloseTimer;
    if (prev) clearTimeout(prev);
    set({ open: false, entries: [], outputLines: [], running: false, error: null, _autoCloseTimer: null });
  },

  cancel: () => {
    const prev = get()._autoCloseTimer;
    if (prev) clearTimeout(prev);
    set({ open: false, entries: [], outputLines: [], running: false, error: null, cancelled: true, _autoCloseTimer: null });
    window.electronAPI.operation.cancel().catch(() => {});
  },

  setAutoClose: (value: boolean) => {
    try { localStorage.setItem(AUTOCLOSE_KEY, String(value)); } catch {}
    // If toggling to auto-close while showing a successful result, start the timer
    if (value && get().open && !get().running && !get().error) {
      const timer = setTimeout(() => {
        const state = get();
        if (state.open && !state.error) {
          set({ open: false, entries: [], outputLines: [], running: false });
        }
      }, 1500);
      set({ autoClose: value, _autoCloseTimer: timer });
    } else {
      // If toggling off auto-close, cancel any pending timer
      const prev = get()._autoCloseTimer;
      if (prev && !value) clearTimeout(prev);
      set({ autoClose: value, _autoCloseTimer: !value ? null : get()._autoCloseTimer });
    }
  },
}));

/**
 * Run a git operation with the log dialog.
 * Opens the dialog, executes the operation, collects logs, and auto-closes on success.
 */
export async function runGitOperation<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const store = useGitOperationStore.getState();
  store.start(label);
  try {
    const result = await fn();
    const state = useGitOperationStore.getState();
    if (state.cancelled) {
      throw new GitOperationCancelledError();
    }
    state.finish();
    return result;
  } catch (err: unknown) {
    const state = useGitOperationStore.getState();
    if (state.cancelled) {
      throw new GitOperationCancelledError();
    }
    const message = err instanceof Error ? err.message : String(err);
    useGitOperationStore.getState().finish(message);
    throw err;
  }
}
