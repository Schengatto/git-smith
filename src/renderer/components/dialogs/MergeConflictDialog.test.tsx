// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
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
const settingsGetMock = vi.fn().mockResolvedValue({ mergeToolName: "", mergeToolPath: "", mergeToolArgs: "" });
const suggestConflictResolutionMock = vi.fn().mockResolvedValue("resolved by AI");

beforeEach(() => {
  vi.clearAllMocks();
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
    const { container } = render(
      <MergeConflictDialog open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
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

  it("populates ours and theirs in textareas", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      // 3 textareas: left, center, right
      expect(textareas.length).toBe(3);
      expect(textareas[0].value).toBe("our version of the line");
      expect(textareas[2].value).toBe("their version of the line");
    });
  });

  it("loads merged content into center textarea (uncontrolled)", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    // Center textarea is uncontrolled — content is set via ref after load
    // We verify the conflict count badge instead, which confirms content was parsed
    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });
  });

  it("shows conflict count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });
  });

  it("shows conflict action buttons", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Use LOCAL →")).toBeInTheDocument();
      expect(screen.getByText("← Use REMOTE")).toBeInTheDocument();
      expect(screen.getByText("Both")).toBeInTheDocument();
      expect(screen.getByText("None")).toBeInTheDocument();
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

  it("resolves conflict by clicking LOCAL button and updates count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Use LOCAL →")).toBeInTheDocument();
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Use LOCAL →"));

    // After resolving, conflict count should drop to 0
    await waitFor(() => {
      expect(screen.getByText("No conflicts remaining")).toBeInTheDocument();
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
});

describe("parseMergeSections", () => {
  it("parses a simple conflict section", () => {
    const content = "before\n<<<<<<< HEAD\nours line\n=======\ntheirs line\n>>>>>>> branch\nafter";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe("common");
    expect(sections[0].common).toEqual(["before"]);
    expect(sections[1].type).toBe("conflict");
    expect(sections[1].ours).toEqual(["ours line"]);
    expect(sections[1].theirs).toEqual(["theirs line"]);
    expect(sections[2].type).toBe("common");
    expect(sections[2].common).toEqual(["after"]);
  });

  it("parses diff3 format with base section", () => {
    const content = "<<<<<<< HEAD\nours\n||||||| merged common ancestors\nbase\n=======\ntheirs\n>>>>>>> branch";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].ours).toEqual(["ours"]);
    expect(sections[0].theirs).toEqual(["theirs"]);
  });

  it("parses multiple conflict sections", () => {
    const content = "<<<<<<< HEAD\nours1\n=======\ntheirs1\n>>>>>>> branch\nmiddle\n<<<<<<< HEAD\nours2\n=======\ntheirs2\n>>>>>>> branch";
    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe("conflict");
    expect(sections[1].type).toBe("common");
    expect(sections[2].type).toBe("conflict");
  });

  it("returns single common section for non-conflicting content", () => {
    const sections = parseMergeSections("no conflicts here");
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe("common");
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
    const multi = "<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\nmid\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> x";
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
      mergeToolArgs: "\"$BASE\" \"$LOCAL\" \"$REMOTE\" -o \"$MERGED\"",
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
      mergeToolArgs: "\"$LOCAL\" \"$REMOTE\"",
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
      mergeToolArgs: "\"$LOCAL\" \"$BASE\" \"$REMOTE\" -o \"$MERGED\"",
    });

    launchMergeToolMock.mockResolvedValue({ exitCode: 0, mergedContent: "resolved content without markers" });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Open in meld")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open in meld"));

    await waitFor(() => {
      expect(launchMergeToolMock).toHaveBeenCalledWith(
        "CHANGELOG.md",
        "meld",
        "\"$LOCAL\" \"$BASE\" \"$REMOTE\" -o \"$MERGED\""
      );
    });
  });
});

describe("buildMergedContent", () => {
  it("builds content from resolved sections", () => {
    const sections: MergeSection[] = [
      { type: "common", common: ["line 1"], resolution: null },
      { type: "conflict", ours: ["ours"], theirs: ["theirs"], resolution: "ours", resolved: ["ours"] },
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
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "none", aiApiKey: "",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
    });

    expect(screen.queryByText("Resolve with AI")).not.toBeInTheDocument();
  });

  it("shows Resolve with AI button when AI is configured", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test-key",
    });

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resolve with AI")).toBeInTheDocument();
    });
  });

  it("calls suggestConflictResolution and shows overlay on click", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "openai", aiApiKey: "sk-test",
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
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
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

  it("applies AI suggestion to center textarea on Apply", async () => {
    settingsGetMock.mockResolvedValue({
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
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
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    let resolveAi!: (value: string) => void;
    suggestConflictResolutionMock.mockReturnValue(
      new Promise<string>((resolve) => { resolveAi = resolve; })
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
      mergeToolName: "", mergeToolPath: "", mergeToolArgs: "",
      aiProvider: "anthropic", aiApiKey: "sk-test",
    });
    suggestConflictResolutionMock.mockRejectedValue(new Error("API rate limited"));

    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Resolve with AI")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Resolve with AI"));

    await waitFor(() => {
      expect(screen.getByText("API rate limited")).toBeInTheDocument();
    });
  });
});
