import { create } from "zustand";
import type { CommandLogEntry, CommandOutputLine } from "../../shared/git-types";

export interface OutputLine {
  stream: "stdout" | "stderr";
  text: string;
  /** Which command entry this line belongs to */
  entryId: string;
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
}

export const useGitOperationStore = create<GitOperationState>((set, get) => ({
  open: false,
  label: "",
  entries: [],
  outputLines: [],
  running: false,
  error: null,
  _autoCloseTimer: null,

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
      _autoCloseTimer: null,
    });
  },

  addEntry: (entry: CommandLogEntry) => {
    if (!get().open) return;
    set((s) => {
      const idx = s.entries.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...s.entries];
        updated[idx] = entry;
        return { entries: updated };
      }
      return { entries: [...s.entries, entry] };
    });
  },

  addOutputLine: (line: CommandOutputLine) => {
    if (!get().open) return;
    set((s) => ({
      outputLines: [...s.outputLines, { stream: line.stream, text: line.text, entryId: line.id }],
    }));
  },

  finish: (error?: string) => {
    if (!error) {
      // Auto-close after 1.5s on success
      const timer = setTimeout(() => {
        const state = get();
        if (state.open && !state.error) {
          set({ open: false, entries: [], outputLines: [], running: false });
        }
      }, 1500);
      set({ running: false, error: null, _autoCloseTimer: timer });
    } else {
      set({ running: false, error });
    }
  },

  close: () => {
    const prev = get()._autoCloseTimer;
    if (prev) clearTimeout(prev);
    set({ open: false, entries: [], outputLines: [], running: false, error: null, _autoCloseTimer: null });
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
    useGitOperationStore.getState().finish();
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    useGitOperationStore.getState().finish(message);
    throw err;
  }
}
