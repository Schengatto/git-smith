import { useState } from "react";
import type { CommitInfo, RefInfo } from "../../../shared/git-types";

export function useGraphDialogs() {
  const [cherryPickTarget, setCherryPickTarget] = useState<{ hash: string; subject: string; isMerge?: boolean } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ hash: string; subject: string; isMerge?: boolean } | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [createBranchFrom, setCreateBranchFrom] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [tagTarget, setTagTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<string | null>(null);
  const [deleteRemoteBranchTarget, setDeleteRemoteBranchTarget] = useState<string | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);
  const [deleteTagRemote, setDeleteTagRemote] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{ refs: RefInfo[]; hash: string; subject: string } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [rebaseTarget, setRebaseTarget] = useState<{ onto: string; interactive?: boolean } | null>(null);
  const [squashTarget, setSquashTarget] = useState<{ hash: string; subject: string } | null>(null);
  const [compareTarget, setCompareTarget] = useState<{ commit1: CommitInfo; commit2: CommitInfo } | null>(null);
  const [aiReviewHash, setAiReviewHash] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ ref: string; label: string } | null>(null);
  const [patchTarget, setPatchTarget] = useState<{ hashes: string[]; subjects: string[] } | null>(null);
  const [notesTarget, setNotesTarget] = useState<{ hash: string; subject: string } | null>(null);

  return {
    cherryPickTarget, setCherryPickTarget,
    revertTarget, setRevertTarget,
    searchDialogOpen, setSearchDialogOpen,
    createBranchFrom, setCreateBranchFrom,
    resetTarget, setResetTarget,
    tagTarget, setTagTarget,
    deleteBranchTarget, setDeleteBranchTarget,
    deleteRemoteBranchTarget, setDeleteRemoteBranchTarget,
    deleteTagTarget, setDeleteTagTarget,
    deleteTagRemote, setDeleteTagRemote,
    checkoutTarget, setCheckoutTarget,
    mergeTarget, setMergeTarget,
    rebaseTarget, setRebaseTarget,
    squashTarget, setSquashTarget,
    compareTarget, setCompareTarget,
    aiReviewHash, setAiReviewHash,
    archiveTarget, setArchiveTarget,
    patchTarget, setPatchTarget,
    notesTarget, setNotesTarget,
  };
}
