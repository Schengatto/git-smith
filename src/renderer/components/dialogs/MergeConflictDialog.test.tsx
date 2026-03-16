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

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    conflict: {
      list: listMock,
      fileContent: fileContentMock,
      resolve: resolveMock,
      saveMerged: saveMergedMock,
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

  it("shows ours and theirs content in side panes", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("our version of the line")).toBeInTheDocument();
      expect(screen.getByText("their version of the line")).toBeInTheDocument();
    });
  });

  it("shows conflict count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });
  });

  it("shows Unresolved indicator in center pane", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Unresolved")).toBeInTheDocument();
    });
  });

  it("shows quick accept all buttons", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Accept all LOCAL")).toBeInTheDocument();
      expect(screen.getByText("Accept all REMOTE")).toBeInTheDocument();
    });
  });

  it("disables Mark as resolved when conflicts remain unresolved", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const btn = screen.getByText("Mark as resolved");
      expect(btn).toBeDisabled();
    });
  });

  it("shows 'all resolved' state and Continue button when all files resolved", async () => {
    // File with no conflict markers
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
      // No conflicts to resolve, so button should be enabled
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
    const content = [
      "before",
      "<<<<<<< HEAD",
      "ours line",
      "=======",
      "theirs line",
      ">>>>>>> branch",
      "after",
    ].join("\n");

    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);

    // Common before
    expect(sections[0].type).toBe("common");
    expect(sections[0].common).toEqual(["before"]);

    // Conflict
    expect(sections[1].type).toBe("conflict");
    expect(sections[1].ours).toEqual(["ours line"]);
    expect(sections[1].theirs).toEqual(["theirs line"]);

    // Common after
    expect(sections[2].type).toBe("common");
    expect(sections[2].common).toEqual(["after"]);
  });

  it("parses diff3 format with base section", () => {
    const content = [
      "<<<<<<< HEAD",
      "ours",
      "||||||| merged common ancestors",
      "base",
      "=======",
      "theirs",
      ">>>>>>> branch",
    ].join("\n");

    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe("conflict");
    expect(sections[0].ours).toEqual(["ours"]);
    expect(sections[0].theirs).toEqual(["theirs"]);
  });

  it("parses multiple conflict sections", () => {
    const content = [
      "<<<<<<< HEAD",
      "ours1",
      "=======",
      "theirs1",
      ">>>>>>> branch",
      "middle",
      "<<<<<<< HEAD",
      "ours2",
      "=======",
      "theirs2",
      ">>>>>>> branch",
    ].join("\n");

    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe("conflict");
    expect(sections[0].ours).toEqual(["ours1"]);
    expect(sections[1].type).toBe("common");
    expect(sections[1].common).toEqual(["middle"]);
    expect(sections[2].type).toBe("conflict");
    expect(sections[2].ours).toEqual(["ours2"]);
  });

  it("handles multiline conflict sections", () => {
    const content = [
      "<<<<<<< HEAD",
      "line 1",
      "line 2",
      "=======",
      "line A",
      "line B",
      "line C",
      ">>>>>>> branch",
    ].join("\n");

    const sections = parseMergeSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].ours).toEqual(["line 1", "line 2"]);
    expect(sections[0].theirs).toEqual(["line A", "line B", "line C"]);
  });

  it("returns single common section for non-conflicting content", () => {
    const sections = parseMergeSections("no conflicts here");
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe("common");
  });
});

describe("resolveAllConflicts", () => {
  const content = [
    "before",
    "<<<<<<< HEAD",
    "ours line",
    "=======",
    "theirs line",
    ">>>>>>> branch",
    "after",
  ].join("\n");

  it("resolves all picking ours", () => {
    const result = resolveAllConflicts(content, "ours");
    expect(result).toBe("before\nours line\nafter");
  });

  it("resolves all picking theirs", () => {
    const result = resolveAllConflicts(content, "theirs");
    expect(result).toBe("before\ntheirs line\nafter");
  });

  it("handles multiple conflicts", () => {
    const multi = [
      "<<<<<<< HEAD", "a", "=======", "b", ">>>>>>> x",
      "mid",
      "<<<<<<< HEAD", "c", "=======", "d", ">>>>>>> x",
    ].join("\n");

    expect(resolveAllConflicts(multi, "ours")).toBe("a\nmid\nc");
    expect(resolveAllConflicts(multi, "theirs")).toBe("b\nmid\nd");
  });

  it("handles diff3 format", () => {
    const diff3 = [
      "<<<<<<< HEAD",
      "ours",
      "||||||| base",
      "original",
      "=======",
      "theirs",
      ">>>>>>> branch",
    ].join("\n");

    expect(resolveAllConflicts(diff3, "ours")).toBe("ours");
    expect(resolveAllConflicts(diff3, "theirs")).toBe("theirs");
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

  it("builds content with both resolution", () => {
    const sections: MergeSection[] = [
      { type: "conflict", ours: ["a"], theirs: ["b"], resolution: "both", resolved: ["a", "b"] },
    ];
    expect(buildMergedContent(sections)).toBe("a\nb");
  });
});
