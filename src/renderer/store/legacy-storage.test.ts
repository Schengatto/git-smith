import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
});

import { getItemWithLegacy } from "./legacy-storage";

describe("getItemWithLegacy", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it("returns null when neither key exists", () => {
    expect(getItemWithLegacy("gitpress-x", "gitsmith-x")).toBeNull();
  });

  it("returns the current value and ignores the legacy one", () => {
    mockStorage["gitpress-x"] = "new";
    mockStorage["gitsmith-x"] = "old";
    expect(getItemWithLegacy("gitpress-x", "gitsmith-x")).toBe("new");
  });

  it("falls back to the legacy value and copies it to the new key", () => {
    mockStorage["gitsmith-x"] = "old";
    expect(getItemWithLegacy("gitpress-x", "gitsmith-x")).toBe("old");
    expect(mockStorage["gitpress-x"]).toBe("old");
  });
});
