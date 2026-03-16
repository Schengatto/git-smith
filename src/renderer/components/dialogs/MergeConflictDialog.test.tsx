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

  it("populates merged content with conflict markers in center textarea", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      expect(textareas[1].value).toContain("<<<<<<<");
      expect(textareas[1].value).toContain(">>>>>>>");
    });
  });

  it("shows conflict count", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 conflict")).toBeInTheDocument();
    });
  });

  it("shows conflict action row with LOCAL/REMOTE/Both/None buttons", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("LOCAL →")).toBeInTheDocument();
      expect(screen.getByText("← REMOTE")).toBeInTheDocument();
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

  it("disables Mark as resolved when conflicts remain", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const btn = screen.getByText("Mark as resolved");
      expect(btn).toBeDisabled();
    });
  });

  it("resolves conflict by clicking LOCAL button", async () => {
    render(<MergeConflictDialog open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("LOCAL →")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("LOCAL →"));

    await waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      // Conflict markers should be gone, replaced with ours content
      expect(textareas[1].value).not.toContain("<<<<<<<");
      expect(textareas[1].value).toContain("our version of the line");
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
