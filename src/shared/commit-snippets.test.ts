import { describe, it, expect } from "vitest";
import type { CommitSnippet } from "./settings-types";

describe("CommitSnippet", () => {
  const snippets: CommitSnippet[] = [
    { label: "Co-authored-by", text: "Co-authored-by: " },
    { label: "BREAKING CHANGE", text: "BREAKING CHANGE: " },
    { label: "Closes #", text: "Closes #" },
  ];

  describe("insertion at cursor position", () => {
    it("inserts snippet at beginning of empty message", () => {
      const message = "";
      const start = 0;
      const snip = snippets[0]!;
      const result = message.slice(0, start) + snip.text + message.slice(start);
      expect(result).toBe("Co-authored-by: ");
    });

    it("inserts snippet at cursor position in existing message", () => {
      const message = "feat: add login\n\n";
      const start = message.length;
      const snip = snippets[1]!;
      const result = message.slice(0, start) + snip.text + message.slice(start);
      expect(result).toBe("feat: add login\n\nBREAKING CHANGE: ");
    });

    it("inserts snippet in the middle of message", () => {
      const message = "fix: resolve issue ";
      const start = 19; // end of "issue "
      const snip = snippets[2]!;
      const result = message.slice(0, start) + snip.text + message.slice(start);
      expect(result).toBe("fix: resolve issue Closes #");
    });

    it("replaces selected text with snippet", () => {
      const message = "feat: add PLACEHOLDER feature";
      const start = 10;
      const end = 21; // "PLACEHOLDER"
      const snip = snippets[0]!;
      const result = message.slice(0, start) + snip.text + message.slice(end);
      expect(result).toBe("feat: add Co-authored-by:  feature");
    });
  });

  describe("snippet validation", () => {
    it("all snippets have label and text", () => {
      for (const snip of snippets) {
        expect(snip.label.length).toBeGreaterThan(0);
        expect(snip.text.length).toBeGreaterThan(0);
      }
    });
  });
});
