// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "mergeConflict.resolveMergeConflicts": "Resolve merge conflicts",
        "mergeConflict.unresolvedFile": "{{count}} unresolved file",
        "mergeConflict.unresolvedFiles": "{{count}} unresolved files",
        "mergeConflict.conflict": "{{count}} conflict",
        "mergeConflict.conflicts": "{{count}} conflicts",
        "mergeConflict.noConflictsRemaining": "No conflicts remaining",
        "mergeConflict.conflictNumber": "Conflict {{index}}",
        "mergeConflict.conflictResolved": "Conflict {{index}} (resolved)",
        "mergeConflict.prevConflict": "Prev conflict",
        "mergeConflict.nextConflict": "Next conflict",
        "mergeConflict.acceptAllLocal": "Accept all LOCAL",
        "mergeConflict.acceptAllRemote": "Accept all REMOTE",
        "mergeConflict.resolving": "Resolving...",
        "mergeConflict.resolveWithAi": "Resolve with AI",
        "mergeConflict.waitingForTool": "Waiting for {{tool}}...",
        "mergeConflict.resolveInExternalTool":
          "Resolve the conflict in the external tool, then save and close it.",
        "mergeConflict.useInternalEditorInstead": "Use internal editor instead",
        "mergeConflict.openInTool": "Open in {{tool}}",
        "mergeConflict.current": "CURRENT",
        "mergeConflict.incoming": "INCOMING",
        "mergeConflict.ours": "(ours)",
        "mergeConflict.theirs": "(theirs)",
        "mergeConflict.localOurs": "LOCAL",
        "mergeConflict.merged": "MERGED",
        "mergeConflict.result": "(result)",
        "mergeConflict.remoteTheirs": "REMOTE",
        "mergeConflict.resolvedLabel": "Resolved ({{resolution}})",
        "mergeConflict.editResolution": "Edit resolution",
        "mergeConflict.edit": "Edit",
        "mergeConflict.undoResolution": "Undo resolution",
        "mergeConflict.undoLabel": "Undo",
        "mergeConflict.acceptCurrent": "Accept Current",
        "mergeConflict.acceptIncoming": "Accept Incoming",
        "mergeConflict.acceptBoth": "Accept Both",
        "mergeConflict.emptyBothSidesRemoved": "(empty — both sides removed)",
        "mergeConflict.resolveAllThenMark": "Resolve all conflicts, then mark as resolved",
        "mergeConflict.recheckConflicts": "Recheck conflicts",
        "mergeConflict.saving": "Saving...",
        "mergeConflict.markAsResolved": "Mark as resolved",
        "mergeConflict.allConflictsResolvedMessage": "All conflicts resolved!",
        "mergeConflict.continueOperation": "You can now continue the operation.",
        "mergeConflict.noConflictedFiles": "No conflicted files found",
        "mergeConflict.selectFileToResolve": "Select a file to resolve",
        "mergeConflict.filesResolvedCount": "{{resolved}} of {{total}} files resolved",
        "mergeConflict.continue": "Continue",
        "mergeConflict.unresolvedMergeConflicts": "Unresolved merge conflicts",
        "mergeConflict.customEdit": "Custom edit",
        "mergeConflict.done": "Done",
        "mergeConflict.aiSuggestion": "AI Suggestion",
        "mergeConflict.fileTooLarge":
          "File too large for inline diff ({{count}} lines). Showing AI output directly — click Apply to resolve all conflicts.",
        "mergeConflict.dismiss": "Dismiss",
        "mergeConflict.externalTool": "external tool",
        "mergeConflict.aiCouldNotExtract":
          "Could not extract AI resolutions — try the toolbar 'Resolve with AI' button for manual review.",
        "dialogs.close": "Close",
        "dialogs.loading": "Loading...",
        "dialogs.cancel": "Cancel",
        "dialogs.apply": "Apply",
        "ai.aiButtonLabel": "AI",
      };
      let result = translations[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
      }
      return result;
    },
    i18n: { language: "en" },
  }),
}));

// Mock react-virtuoso — Virtuoso doesn't render in jsdom (no viewport dimensions)
vi.mock("react-virtuoso", () => ({
  Virtuoso: React.forwardRef(
    (
      {
        totalCount,
        itemContent,
      }: { totalCount: number; itemContent: (index: number) => React.ReactNode },
      ref: React.Ref<unknown>
    ) => {
      React.useImperativeHandle(ref, () => ({ scrollToIndex: () => {} }));
      return React.createElement(
        "div",
        { "data-testid": "virtuoso-mock" },
        Array.from({ length: totalCount }, (_, i) =>
          React.createElement("div", { key: i }, itemContent(i))
        )
      );
    }
  ),
}));

import {
  MergeConflictDialog,
  parseMergeSections,
  resolveAllConflicts,
  buildMergedContent,
  computeLineDiff,
} from "./MergeConflictDialog";
import type { MergeSection } from "./MergeConflictDialog";
import type { ConflictFile, ConflictFileContent } from "../../../shared/git-types";

const mockFiles: ConflictFile[] = [
  { path: "CHANGELOG.md", reason: "both-modified" },
  { path: "v.info", reason: "both-modified" },
];

const conflictContent = [
  "line 1 before conflict",
  "<<<<<<< HEAD",
  "our version of the line",
  "=======",
  "their version of the line",
  ">>>>>>> feature-branch",
  "line after conflict",
].join("\n");

const mockFileContent: ConflictFileContent = {
  ours: "our version of the line",
  theirs: "their version of the line",
  base: "original version of the line",
  merged: conflictContent,
};

const listMock = vi.fn().mockResolvedValue(mockFiles);
const fileContentMock = vi.fn().mockResolvedValue(mockFileContent);
const resolveMock = vi.fn().mockResolvedValue(undefined);
const saveMergedMock = vi.fn().mockResolvedValue(undefined);
const launchMergeToolMock = vi.fn().mockResolvedValue({ exitCode: 0, mergedContent: "" });
const settingsGetMock = vi
  .fn()
  .mockResolvedValue({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" });
const suggestConflictResolutionMock = vi.fn().mockResolvedValue("resolved by AI");

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations (clearAllMocks only clears call history, not implementations)
  listMock.mockResolvedValue(mockFiles);
  fileContentMock.mockResolvedValue(mockFileContent);
  resolveMock.mockResolvedValue(undefined);
  saveMergedMock.mockResolvedValue(undefined);
  launchMergeToolMock.mockResolvedValue({ exitCode: 0, mergedContent: "" });
  settingsGetMock.mockResolvedValue({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" });
  suggestConflictResolutionMock.mockResolvedValue("resolved by AI");
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    conflict: {
      list: listMock,
      fileContent: fileContentMock,
      resolve: resolveMock,
      saveMerged: saveMergedMock,
      launchMergeTool: launchMergeToolMock,
    },
    settings: {
      get: settingsGetMock,
    },
    mcp: {
      suggestConflictResolution: suggestConflictResolutionMock,
    },
  };
});

describe("MergeConflictDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<MergeConflictDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders without overlay backdrop in window mode", () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} mode="window" />);
    const container = document.querySelector('[style*="position: fixed"]');
    expect(container).toBeNull();
  });

  it("loads and displays conflict files when opened", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("CHANGELOG.md")).toBeInTheDocument();
      expect(screen.getByText("v.info")).toBeInTheDocument();
    });
  });

  it("shows unresolved file count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("2 unresolved files")).toBeInTheDocument();
    });
  });

  it("loads file content when a file is selected", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(fileContentMock).toHaveBeenCalledWith("CHANGELOG.md");
    });
  });

  it("shows 3-pane headers (LOCAL, MERGED, REMOTE)", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("LOCAL")).toBeInTheDocument();
      expect(screen.getByText("MERGED")).toBeInTheDocument();
      expect(screen.getByText("REMOTE")).toBeInTheDocument();
    });
  });

  it("renders ours and theirs content in section-based view", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // In the section-based view, ours/theirs appear as text in the conflict section
      const allText = document.body.textContent || "";
      expect(allText).toContain("our version of the line");
      expect(allText).toContain("their version of the line");
    });
  });

  it("shows conflict count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });
  });

  it("shows per-conflict action buttons", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
      expect(screen.getByText("Accept Incoming")).toBeInTheDocument();
      expect(screen.getByText("Accept Both")).toBeInTheDocument();
    });
  });

  it("shows navigation buttons for prev/next conflict", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Prev conflict")).toBeInTheDocument();
      expect(screen.getByLabelText("Next conflict")).toBeInTheDocument();
    });
  });

  it("shows merged pane header with result label", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("(result)")).toBeInTheDocument();
    });
  });

  it("shows quick accept all buttons", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
      expect(screen.getByText("Accept all REMOTE")).toBeInTheDocument();
    });
  });

  it("shows Recheck conflicts button", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Recheck conflicts")).toBeInTheDocument();
    });
  });

  it("resolves conflict by clicking Accept Current and updates count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Accept Current"));

    await waitFor(() => {
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });

  it("resolves conflict by clicking Accept Incoming", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Incoming")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Accept Incoming"));

    await waitFor(() => {
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });

  it("resolves conflict by clicking Accept Both", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Both")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Accept Both"));

    await waitFor(() => {
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });

  it("shows undo button after resolving and can unresolve", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Accept Current"));

    await waitFor(() => {
      expect(screen.getByText("↩ Undo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("↩ Undo"));

    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
    });
  });

  it("shows conflict navigation badges", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // Should show badge "1" for the single conflict
      expect(screen.getByTitle("Conflict 1")).toBeInTheDocument();
    });
  });

  it("shows current/incoming labels in conflict center", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("CURRENT")).toBeInTheDocument();
      expect(screen.getByText("INCOMING")).toBeInTheDocument();
    });
  });

  it("shows 'all resolved' state and Continue button when all files resolved", async () => {
    listMock.mockResolvedValue([{ path: "test.txt", reason: "both-modified" }]);
    fileContentMock.mockResolvedValue({
      ours: "ours",
      theirs: "theirs",
      base: null,
      merged: "no conflict here",
    });

    const onResolved = vi.fn();
    render(<MergeConflictDialog open={true} onClose={vi.fn()} onResolved={onResolved} />);

    await waitFor(() => {
      const btn = screen.getByText("Mark as resolved");
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Mark as resolved"));

    await waitFor(() => {
      expect(saveMergedMock).toHaveBeenCalled();
      expect(resolveMock).toHaveBeenCalledWith("test.txt");
    });

    await waitFor(() => {
      expect(screen.getByText("All conflicts resolved!")).toBeInTheDocument();
      expect(screen.getByText("Continue")).toBeInTheDocument();
    });
  });

  it("shows edit mode when Edit button is clicked", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
    });

    // Find the Edit button in the conflict action bar (exact match)
    const editBtns = screen.getAllByText("Edit");
    fireEvent.click(editBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText("Custom edit")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  it("saves custom edit and resolves conflict", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept Current")).toBeInTheDocument();
    });

    const editBtns = screen.getAllByText("Edit");
    fireEvent.click(editBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    // The textarea in edit mode should be present
    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();

    fireEvent.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });
});

describe("parseMergeSections", () => {
  it("parses a simple conflict section", () => {
    const content = "before\n<<<<<<< HEAD\nours line\n=======\ntheirs line\n>>>>>>> branch\nafter";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0]!.type).toBe("common");
    expect(sections[0]!.common).toEqual(["before"]);
    expect(sections[1]!.type).toBe("conflict");
    expect(sections[1]!.ours).toEqual(["ours line"]);
    expect(sections[1]!.theirs).toEqual(["theirs line"]);
    expect(sections[2]!.type).toBe("common");
    expect(sections[2]!.common).toEqual(["after"]);
  });

  it("parses diff3 format with base section", () => {
    const content =
      "<<<<<<< HEAD\nours\n||||||| merged common ancestors\nbase\n=======\ntheirs\n>>>>>>> branch";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.ours).toEqual(["ours"]);
    expect(sections[0]!.theirs).toEqual(["theirs"]);
  });

  it("parses multiple conflict sections", () => {
    const content =
      "<<<<<<< HEAD\nours1\n=======\ntheirs1\n>>>>>>> branch\nmiddle\n<<<<<<< HEAD\nours2\n=======\ntheirs2\n>>>>>>> branch";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0]!.type).toBe("conflict");
    expect(sections[1]!.type).toBe("common");
    expect(sections[2]!.type).toBe("conflict");
  });

  it("returns single common section for non-conflicting content", () => {
    const sections = parseMergeSections("no conflicts here");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.type).toBe("common");
  });
});

describe("resolveAllConflicts", () => {
  const content = "before\n<<<<<<< HEAD\nours line\n=======\ntheirs line\n>>>>>>> branch\nafter";

  it("resolves all picking ours", () => {
    expect(resolveAllConflicts(content, "ours")).toBe("before\nours line\nafter");
  });

  it("resolves all picking theirs", () => {
    expect(resolveAllConflicts(content, "theirs")).toBe("before\ntheirs line\nafter");
  });

  it("handles multiple conflicts", () => {
    const multi =
      "<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\nmid\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> x";
    expect(resolveAllConflicts(multi, "ours")).toBe("a\nmid\nc");
    expect(resolveAllConflicts(multi, "theirs")).toBe("b\nmid\nd");
  });

  it("handles diff3 format", () => {
    const diff3 = "<<<<<<< HEAD\nours\n||||||| base\noriginal\n=======\ntheirs\n>>>>>>> branch";
    expect(resolveAllConflicts(diff3, "ours")).toBe("ours");
    expect(resolveAllConflicts(diff3, "theirs")).toBe("theirs");
  });
});

describe("MergeConflictDialog external merge tool", () => {
  it("does not show external tool button when no tool configured", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Open in/)).not.toBeInTheDocument();
  });

  it("shows external tool button when merge tool is configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "kdiff3",
      mergeToolPath: "kdiff3",
      mergeToolArgs: '"$BASE" "$LOCAL" "$REMOTE" -o "$MERGED"',
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Open in kdiff3")).toBeInTheDocument();
    });
  });

  it("shows generic label for custom tool", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "custom",
      mergeToolPath: "/usr/bin/my-tool",
      mergeToolArgs: '"$LOCAL" "$REMOTE"',
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Open in external tool")).toBeInTheDocument();
    });
  });

  it("calls launchMergeTool when external tool button is clicked", async () => {
    listMock.mockResolvedValue(mockFiles);
    fileContentMock.mockResolvedValue(mockFileContent);
    settingsGetMock.mockResolvedValue({
      mergeToolName: "meld",
      mergeToolPath: "meld",
      mergeToolArgs: '"$LOCAL" "$BASE" "$REMOTE" -o "$MERGED"',
    });

    launchMergeToolMock.mockResolvedValue({
      exitCode: 0,
      mergedContent: "resolved content without markers",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Open in meld")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open in meld"));

    await waitFor(() => {
      expect(launchMergeToolMock).toHaveBeenCalledWith(
        "CHANGELOG.md",
        "meld",
        '"$LOCAL" "$BASE" "$REMOTE" -o "$MERGED"'
      );
    });
  });
});

describe("buildMergedContent", () => {
  it("builds content from resolved sections", () => {
    const sections: MergeSection[] = [
      { type: "common", common: ["line 1"], resolution: null },
      {
        type: "conflict",
        ours: ["ours"],
        theirs: ["theirs"],
        resolution: "ours",
        resolved: ["ours"],
      },
      { type: "common", common: ["line 3"], resolution: null },
    ];
    expect(buildMergedContent(sections)).toBe("line 1\nours\nline 3");
  });
});

describe("computeLineDiff", () => {
  it("returns all 'same' for identical texts", () => {
    const result = computeLineDiff("a\nb\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "same", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects added lines", () => {
    const result = computeLineDiff("a\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "added", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects removed lines", () => {
    const result = computeLineDiff("a\nb\nc", "a\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "b" },
      { type: "same", line: "c" },
    ]);
  });

  it("detects replaced lines", () => {
    const result = computeLineDiff("a\nold\nc", "a\nnew\nc");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "old" },
      { type: "added", line: "new" },
      { type: "same", line: "c" },
    ]);
  });

  it("handles empty old text", () => {
    const result = computeLineDiff("", "a\nb");
    expect(result).toEqual([
      { type: "added", line: "a" },
      { type: "added", line: "b" },
    ]);
  });

  it("handles empty new text", () => {
    const result = computeLineDiff("a\nb", "");
    expect(result).toEqual([
      { type: "removed", line: "a" },
      { type: "removed", line: "b" },
    ]);
  });

  it("handles multiple insertions and deletions", () => {
    const result = computeLineDiff("a\nb\nc\nd", "a\nc\nd\ne");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "removed", line: "b" },
      { type: "same", line: "c" },
      { type: "same", line: "d" },
      { type: "added", line: "e" },
    ]);
  });

  it("handles trailing newlines without phantom empty lines", () => {
    const result = computeLineDiff("a\nb\n", "a\nb\n");
    expect(result).toEqual([
      { type: "same", line: "a" },
      { type: "same", line: "b" },
    ]);
  });
});

describe("MergeConflictDialog AI conflict resolution", () => {
  it("does not show Resolve with AI button when AI is not configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "none",
      aiApiKey: "",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
    });

    expect(screen.queryByText("Resolve with AI")).not.toBeInTheDocument();
  });

  it("shows Resolve with AI button when AI is configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test-key",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resolve with AI")).toBeInTheDocument();
    });
  });

  it("calls suggestConflictResolution and shows overlay on click", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "openai",
      aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("resolved content by AI");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resolve with AI")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Resolve with AI"));

    await waitFor(() => {
      expect(suggestConflictResolutionMock).toHaveBeenCalledWith("CHANGELOG.md");
    });

    await waitFor(() => {
      expect(screen.getByText("AI Suggestion")).toBeInTheDocument();
      expect(screen.getByText("Apply")).toBeInTheDocument();
      expect(screen.getByText("Dismiss")).toBeInTheDocument();
    });
  });

  it("dismisses overlay without applying changes", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("ai resolved");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));
    await waitFor(() => expect(screen.getByText("AI Suggestion")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
    });
  });

  it("applies AI suggestion and resolves conflicts", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockResolvedValue("clean resolved content");

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));
    await waitFor(() => expect(screen.getByText("Apply")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
    });
  });

  it("discards stale AI result when file selection changes mid-flight", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
    });
    let resolveAi!: (value: string) => void;
    suggestConflictResolutionMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveAi = resolve;
      })
    );

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Resolve with AI"));

    fireEvent.click(screen.getByText("v.info"));

    resolveAi("stale suggestion for wrong file");

    await waitFor(() => {
      expect(screen.queryByText("AI Suggestion")).not.toBeInTheDocument();
    });
  });

  it("shows error when AI call fails", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockRejectedValue(new Error("API rate limited"));

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));

    await waitFor(() => {
      expect(screen.getByText("API rate limited")).toBeInTheDocument();
    });
  });

  it("shows per-conflict AI button when configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "",
      mergeToolPath: "",
      mergeToolArgs: "",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // Per-conflict AI button in the conflict action bar
      const aiButtons = screen.getAllByText("AI");
      expect(aiButtons.length).toBeGreaterThan(0);
    });
  });
});
