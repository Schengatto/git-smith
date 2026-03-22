import { describe, it, expect } from "vitest";

describe("Drag & Drop Staging logic", () => {
  describe("dataTransfer format", () => {
    it("should serialize single file path as JSON array", () => {
      const paths = ["src/index.ts"];
      const serialized = JSON.stringify(paths);
      expect(JSON.parse(serialized)).toEqual(["src/index.ts"]);
    });

    it("should serialize multiple file paths as JSON array", () => {
      const paths = ["src/a.ts", "src/b.ts", "src/c.ts"];
      const serialized = JSON.stringify(paths);
      expect(JSON.parse(serialized)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    });
  });

  describe("multi-select drag logic", () => {
    it("should use selected paths when file is in selection and selection > 1", () => {
      const selectedPaths = new Set(["a.ts", "b.ts"]);
      const filePath = "a.ts";
      const dragPaths =
        selectedPaths.has(filePath) && selectedPaths.size > 1
          ? Array.from(selectedPaths)
          : undefined;
      expect(dragPaths).toEqual(["a.ts", "b.ts"]);
    });

    it("should not use selected paths when only one file selected", () => {
      const selectedPaths = new Set(["a.ts"]);
      const filePath = "a.ts";
      const dragPaths =
        selectedPaths.has(filePath) && selectedPaths.size > 1
          ? Array.from(selectedPaths)
          : undefined;
      expect(dragPaths).toBeUndefined();
    });

    it("should not use selected paths when file is not in selection", () => {
      const selectedPaths = new Set(["a.ts", "b.ts"]);
      const filePath = "c.ts";
      const dragPaths =
        selectedPaths.has(filePath) && selectedPaths.size > 1
          ? Array.from(selectedPaths)
          : undefined;
      expect(dragPaths).toBeUndefined();
    });

    it("should fallback to single file path when dragPaths is undefined", () => {
      const dragPaths = undefined as string[] | undefined;
      const filePath = "src/index.ts";
      const paths = dragPaths !== undefined && dragPaths.length > 0 ? dragPaths : [filePath];
      expect(paths).toEqual(["src/index.ts"]);
    });

    it("should use dragPaths when provided", () => {
      const dragPaths = ["a.ts", "b.ts"];
      const filePath = "a.ts";
      const paths = dragPaths && dragPaths.length > 0 ? dragPaths : [filePath];
      expect(paths).toEqual(["a.ts", "b.ts"]);
    });
  });
});
