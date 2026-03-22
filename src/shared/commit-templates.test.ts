import { describe, it, expect } from "vitest";
import type { CommitTemplate } from "./settings-types";

describe("CommitTemplate", () => {
  const templates: CommitTemplate[] = [
    { name: "Feature", prefix: "feat: ", body: "", description: "A new feature" },
    { name: "Fix", prefix: "fix: ", body: "", description: "A bug fix" },
    {
      name: "Custom",
      prefix: "custom({scope}): ",
      body: "BREAKING CHANGE: {breaking}",
      description: "Custom template",
    },
  ];

  describe("applyTemplate", () => {
    function applyTemplate(tpl: CommitTemplate, prev: string): string {
      const prefix = tpl.prefix || "";
      const body = tpl.body || "";
      if (prev.match(/^[a-z]+(\(.+\))?:/)) {
        return prev.replace(/^[a-z]+(\(.+\))?:/, prefix.replace(/\s+$/, ""));
      }
      return body ? `${prefix}${prev}\n\n${body}` : `${prefix}${prev}`;
    }

    it("should apply prefix to empty message", () => {
      expect(applyTemplate(templates[0]!, "")).toBe("feat: ");
    });

    it("should apply prefix with existing text", () => {
      expect(applyTemplate(templates[0]!, "add login")).toBe("feat: add login");
    });

    it("should replace existing conventional commit prefix", () => {
      expect(applyTemplate(templates[1]!, "feat: something")).toBe("fix: something");
    });

    it("should replace prefix with scope", () => {
      expect(applyTemplate(templates[1]!, "feat(ui): something")).toBe("fix: something");
    });

    it("should append body template when present", () => {
      const result = applyTemplate(templates[2]!, "add feature");
      expect(result).toBe("custom({scope}): add feature\n\nBREAKING CHANGE: {breaking}");
    });

    it("should not append body when body is empty", () => {
      const result = applyTemplate(templates[0]!, "add feature");
      expect(result).toBe("feat: add feature");
    });
  });

  describe("template validation", () => {
    it("should have required fields", () => {
      for (const tpl of templates) {
        expect(tpl).toHaveProperty("name");
        expect(tpl).toHaveProperty("prefix");
        expect(tpl).toHaveProperty("body");
        expect(tpl).toHaveProperty("description");
      }
    });

    it("should have non-empty name", () => {
      for (const tpl of templates) {
        expect(tpl.name.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
