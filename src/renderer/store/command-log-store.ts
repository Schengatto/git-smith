import { create } from "zustand";
import type { CommandLogEntry } from "../../shared/git-types";

interface CommandLogState {
  entries: CommandLogEntry[];
  addEntry: (entry: CommandLogEntry) => void;
  clear: () => void;
}

export const useCommandLogStore = create<CommandLogState>((set) => ({
  entries: [],

  addEntry: (entry: CommandLogEntry) =>
    set((s) => {
      // Update existing entry (when duration/exitCode arrives) or add new
      const idx = s.entries.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...s.entries];
        updated[idx] = entry;
        return { entries: updated };
      }
      return { entries: [entry, ...s.entries].slice(0, 200) };
    }),

  clear: () => set({ entries: [] }),
}));
