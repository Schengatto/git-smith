import { describe, it, expect, beforeEach } from "vitest";
import type { CommandLogEntry } from "../../shared/git-types";
import { useCommandLogStore } from "./command-log-store";

const makeEntry = (
  id: string,
  command = "git",
  args: string[] = []
): CommandLogEntry => ({
  id,
  command,
  args,
  cwd: "/repo",
  timestamp: Date.now(),
});

const resetStore = () => {
  useCommandLogStore.setState({ entries: [] });
};

describe("command-log-store", () => {
  beforeEach(resetStore);

  describe("initial state", () => {
    it("entries starts empty", () => {
      expect(useCommandLogStore.getState().entries).toEqual([]);
    });
  });

  describe("addEntry", () => {
    it("adds a new entry to the front of the list", () => {
      const entry = makeEntry("1", "git", ["status"]);
      useCommandLogStore.getState().addEntry(entry);
      expect(useCommandLogStore.getState().entries[0]).toEqual(entry);
    });

    it("prepends new entries so the latest is first", () => {
      useCommandLogStore.getState().addEntry(makeEntry("1", "git", ["status"]));
      useCommandLogStore.getState().addEntry(makeEntry("2", "git", ["log"]));
      const { entries } = useCommandLogStore.getState();
      expect(entries[0]!.id).toBe("2");
      expect(entries[1]!.id).toBe("1");
    });

    it("updates an existing entry when the same id is added again", () => {
      const original = makeEntry("abc");
      useCommandLogStore.getState().addEntry(original);
      const updated: CommandLogEntry = { ...original, duration: 42, exitCode: 0 };
      useCommandLogStore.getState().addEntry(updated);
      const { entries } = useCommandLogStore.getState();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.duration).toBe(42);
      expect(entries[0]!.exitCode).toBe(0);
    });

    it("preserves the position of the updated entry in the list", () => {
      useCommandLogStore.getState().addEntry(makeEntry("first"));
      useCommandLogStore.getState().addEntry(makeEntry("second"));
      // "second" is at index 0, "first" is at index 1
      const updatedFirst: CommandLogEntry = { ...makeEntry("first"), exitCode: 0 };
      useCommandLogStore.getState().addEntry(updatedFirst);
      const { entries } = useCommandLogStore.getState();
      expect(entries[0]!.id).toBe("second");
      expect(entries[1]!.id).toBe("first");
      expect(entries[1]!.exitCode).toBe(0);
    });

    it("caps the list at 200 entries", () => {
      for (let i = 0; i < 205; i++) {
        useCommandLogStore.getState().addEntry(makeEntry(`entry-${i}`));
      }
      expect(useCommandLogStore.getState().entries).toHaveLength(200);
    });

    it("keeps the most recent entries when capped", () => {
      for (let i = 0; i < 205; i++) {
        useCommandLogStore.getState().addEntry(makeEntry(`entry-${i}`));
      }
      // The newest entry should be at index 0
      expect(useCommandLogStore.getState().entries[0]!.id).toBe("entry-204");
    });

    it("stores entries with all fields intact", () => {
      const entry: CommandLogEntry = {
        id: "x1",
        command: "git",
        args: ["commit", "-m", "test"],
        cwd: "/home/user/project",
        timestamp: 1700000000000,
        duration: 150,
        exitCode: 0,
      };
      useCommandLogStore.getState().addEntry(entry);
      expect(useCommandLogStore.getState().entries[0]).toEqual(entry);
    });

    it("handles entries with error field", () => {
      const entry: CommandLogEntry = {
        ...makeEntry("err-1"),
        error: "fatal: not a git repository",
        exitCode: 128,
      };
      useCommandLogStore.getState().addEntry(entry);
      expect(useCommandLogStore.getState().entries[0]!.error).toBe(
        "fatal: not a git repository"
      );
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      useCommandLogStore.getState().addEntry(makeEntry("1"));
      useCommandLogStore.getState().addEntry(makeEntry("2"));
      useCommandLogStore.getState().clear();
      expect(useCommandLogStore.getState().entries).toEqual([]);
    });

    it("is a no-op when already empty", () => {
      useCommandLogStore.getState().clear();
      expect(useCommandLogStore.getState().entries).toEqual([]);
    });
  });
});
