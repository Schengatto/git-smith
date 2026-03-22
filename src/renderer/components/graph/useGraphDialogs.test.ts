// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGraphDialogs } from "./useGraphDialogs";

describe("useGraphDialogs", () => {
  it("initializes all dialog states to null or false", () => {
    const { result } = renderHook(() => useGraphDialogs());
    expect(result.current.cherryPickTarget).toBeNull();
    expect(result.current.revertTarget).toBeNull();
    expect(result.current.searchDialogOpen).toBe(false);
    expect(result.current.createBranchFrom).toBeNull();
    expect(result.current.resetTarget).toBeNull();
    expect(result.current.tagTarget).toBeNull();
    expect(result.current.deleteBranchTarget).toBeNull();
    expect(result.current.deleteRemoteBranchTarget).toBeNull();
    expect(result.current.deleteTagTarget).toBeNull();
    expect(result.current.deleteTagRemote).toBe(false);
    expect(result.current.checkoutTarget).toBeNull();
    expect(result.current.mergeTarget).toBeNull();
    expect(result.current.rebaseTarget).toBeNull();
    expect(result.current.squashTarget).toBeNull();
    expect(result.current.compareTarget).toBeNull();
    expect(result.current.aiReviewHash).toBeNull();
    expect(result.current.archiveTarget).toBeNull();
    expect(result.current.patchTarget).toBeNull();
    expect(result.current.notesTarget).toBeNull();
  });

  it("sets and clears cherryPickTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setCherryPickTarget({
        hash: "abc123",
        subject: "feat: cherry pick me",
      });
    });
    expect(result.current.cherryPickTarget).toEqual({
      hash: "abc123",
      subject: "feat: cherry pick me",
    });
    act(() => {
      result.current.setCherryPickTarget(null);
    });
    expect(result.current.cherryPickTarget).toBeNull();
  });

  it("sets cherryPickTarget with isMerge flag", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setCherryPickTarget({
        hash: "merge123",
        subject: "Merge branch",
        isMerge: true,
      });
    });
    expect(result.current.cherryPickTarget?.isMerge).toBe(true);
  });

  it("sets and clears revertTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setRevertTarget({ hash: "rev456", subject: "fix: revert this" });
    });
    expect(result.current.revertTarget).toEqual({
      hash: "rev456",
      subject: "fix: revert this",
    });
    act(() => {
      result.current.setRevertTarget(null);
    });
    expect(result.current.revertTarget).toBeNull();
  });

  it("toggles searchDialogOpen", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setSearchDialogOpen(true);
    });
    expect(result.current.searchDialogOpen).toBe(true);
    act(() => {
      result.current.setSearchDialogOpen(false);
    });
    expect(result.current.searchDialogOpen).toBe(false);
  });

  it("sets and clears createBranchFrom", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setCreateBranchFrom("abc1234567");
    });
    expect(result.current.createBranchFrom).toBe("abc1234567");
    act(() => {
      result.current.setCreateBranchFrom(null);
    });
    expect(result.current.createBranchFrom).toBeNull();
  });

  it("sets and clears resetTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setResetTarget({ hash: "rst789", subject: "chore: reset point" });
    });
    expect(result.current.resetTarget).toEqual({
      hash: "rst789",
      subject: "chore: reset point",
    });
    act(() => {
      result.current.setResetTarget(null);
    });
    expect(result.current.resetTarget).toBeNull();
  });

  it("sets and clears tagTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setTagTarget({ hash: "tag001", subject: "release: v1.0.0" });
    });
    expect(result.current.tagTarget).toEqual({
      hash: "tag001",
      subject: "release: v1.0.0",
    });
    act(() => {
      result.current.setTagTarget(null);
    });
    expect(result.current.tagTarget).toBeNull();
  });

  it("sets and clears deleteBranchTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setDeleteBranchTarget("feature/old-branch");
    });
    expect(result.current.deleteBranchTarget).toBe("feature/old-branch");
    act(() => {
      result.current.setDeleteBranchTarget(null);
    });
    expect(result.current.deleteBranchTarget).toBeNull();
  });

  it("sets and clears deleteRemoteBranchTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setDeleteRemoteBranchTarget("origin/feature/old");
    });
    expect(result.current.deleteRemoteBranchTarget).toBe("origin/feature/old");
    act(() => {
      result.current.setDeleteRemoteBranchTarget(null);
    });
    expect(result.current.deleteRemoteBranchTarget).toBeNull();
  });

  it("sets and clears deleteTagTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setDeleteTagTarget("v0.9.0");
    });
    expect(result.current.deleteTagTarget).toBe("v0.9.0");
    act(() => {
      result.current.setDeleteTagTarget(null);
    });
    expect(result.current.deleteTagTarget).toBeNull();
  });

  it("sets deleteTagRemote flag", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setDeleteTagRemote(true);
    });
    expect(result.current.deleteTagRemote).toBe(true);
  });

  it("sets and clears checkoutTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    const target = {
      refs: [{ name: "main", type: "head" as const, current: true }],
      hash: "co123",
      subject: "HEAD",
    };
    act(() => {
      result.current.setCheckoutTarget(target);
    });
    expect(result.current.checkoutTarget).toEqual(target);
    act(() => {
      result.current.setCheckoutTarget(null);
    });
    expect(result.current.checkoutTarget).toBeNull();
  });

  it("sets and clears mergeTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setMergeTarget("feature/merge-me");
    });
    expect(result.current.mergeTarget).toBe("feature/merge-me");
    act(() => {
      result.current.setMergeTarget(null);
    });
    expect(result.current.mergeTarget).toBeNull();
  });

  it("sets and clears rebaseTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setRebaseTarget({ onto: "main" });
    });
    expect(result.current.rebaseTarget).toEqual({ onto: "main" });
    act(() => {
      result.current.setRebaseTarget(null);
    });
    expect(result.current.rebaseTarget).toBeNull();
  });

  it("sets rebaseTarget with interactive flag", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setRebaseTarget({ onto: "main", interactive: true });
    });
    expect(result.current.rebaseTarget?.interactive).toBe(true);
  });

  it("sets and clears squashTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setSquashTarget({ hash: "sq001", subject: "squash these commits" });
    });
    expect(result.current.squashTarget).toEqual({
      hash: "sq001",
      subject: "squash these commits",
    });
    act(() => {
      result.current.setSquashTarget(null);
    });
    expect(result.current.squashTarget).toBeNull();
  });

  it("sets and clears compareTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    const commit1 = {
      hash: "aaa",
      abbreviatedHash: "aaa",
      subject: "first",
      body: "",
      authorName: "Alice",
      authorEmail: "a@a.com",
      authorDate: "",
      committerDate: "",
      parentHashes: [],
      refs: [],
    };
    const commit2 = {
      hash: "bbb",
      abbreviatedHash: "bbb",
      subject: "second",
      body: "",
      authorName: "Bob",
      authorEmail: "b@b.com",
      authorDate: "",
      committerDate: "",
      parentHashes: [],
      refs: [],
    };
    act(() => {
      result.current.setCompareTarget({ commit1, commit2 });
    });
    expect(result.current.compareTarget?.commit1.hash).toBe("aaa");
    expect(result.current.compareTarget?.commit2.hash).toBe("bbb");
    act(() => {
      result.current.setCompareTarget(null);
    });
    expect(result.current.compareTarget).toBeNull();
  });

  it("sets and clears aiReviewHash", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setAiReviewHash("ai-hash-123");
    });
    expect(result.current.aiReviewHash).toBe("ai-hash-123");
    act(() => {
      result.current.setAiReviewHash(null);
    });
    expect(result.current.aiReviewHash).toBeNull();
  });

  it("sets and clears archiveTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setArchiveTarget({ ref: "v1.0.0", label: "Release 1.0.0" });
    });
    expect(result.current.archiveTarget).toEqual({
      ref: "v1.0.0",
      label: "Release 1.0.0",
    });
    act(() => {
      result.current.setArchiveTarget(null);
    });
    expect(result.current.archiveTarget).toBeNull();
  });

  it("sets and clears patchTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setPatchTarget({
        hashes: ["abc", "def"],
        subjects: ["first patch", "second patch"],
      });
    });
    expect(result.current.patchTarget?.hashes).toEqual(["abc", "def"]);
    act(() => {
      result.current.setPatchTarget(null);
    });
    expect(result.current.patchTarget).toBeNull();
  });

  it("sets and clears notesTarget", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setNotesTarget({ hash: "note123", subject: "note commit" });
    });
    expect(result.current.notesTarget).toEqual({
      hash: "note123",
      subject: "note commit",
    });
    act(() => {
      result.current.setNotesTarget(null);
    });
    expect(result.current.notesTarget).toBeNull();
  });

  it("maintains independent state for multiple dialog targets simultaneously", () => {
    const { result } = renderHook(() => useGraphDialogs());
    act(() => {
      result.current.setCherryPickTarget({ hash: "cp1", subject: "cherry pick" });
      result.current.setSearchDialogOpen(true);
      result.current.setMergeTarget("feature/x");
    });
    expect(result.current.cherryPickTarget?.hash).toBe("cp1");
    expect(result.current.searchDialogOpen).toBe(true);
    expect(result.current.mergeTarget).toBe("feature/x");
    // Others remain null
    expect(result.current.revertTarget).toBeNull();
    expect(result.current.resetTarget).toBeNull();
  });
});
