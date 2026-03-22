// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { CommitCompareDialog } from "./CommitCompareDialog";
import type { CommitInfo } from "../../../shared/git-types";

vi.mock("../diff/DiffViewer", () => ({
  DiffViewer: () => <div data-testid="diff-viewer" />,
}));

const mockElectronAPI = {
  diff: {
    rangeFiles: vi.fn().mockResolvedValue([]),
    rangeFile: vi.fn().mockResolvedValue(""),
  },
};

const fakeCommit = (n: number): CommitInfo => ({
  hash: `hash${n}000000`,
  abbreviatedHash: `hash${n}`,
  subject: `Commit ${n}`,
  body: "",
  authorName: "Author",
  authorEmail: "a@b.com",
  authorDate: "2026-01-01",
  committerDate: "2026-01-01",
  parentHashes: [],
  refs: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("CommitCompareDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommitCompareDialog
        open={false}
        onClose={vi.fn()}
        commit1={fakeCommit(1)}
        commit2={fakeCommit(2)}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <CommitCompareDialog
        open={true}
        onClose={vi.fn()}
        commit1={fakeCommit(1)}
        commit2={fakeCommit(2)}
      />
    );
    expect(container.innerHTML).not.toBe("");
  });
});
