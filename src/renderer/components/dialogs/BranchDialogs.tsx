import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ModalDialog,
  DialogInput,
  DialogActions,
  DialogError,
  DialogCheckbox,
} from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";

interface BaseProps {
  open: boolean;
  onClose: () => void;
}

const useRefreshAfter = () => {
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();
  return async () => {
    await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
  };
};

export const CreateBranchDialog: React.FC<BaseProps & { startPoint?: string }> = ({
  open,
  onClose,
  startPoint,
}) => {
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.create(name.trim(), startPoint);
      if (checkout) {
        await runGitOperation("Checkout", () => window.electronAPI.branch.checkout(name.trim()));
      }
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.createBranch")} onClose={onClose}>
      <DialogInput
        label={t("branchDialogs.branchName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("branchDialogs.branchNamePlaceholder")}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      {startPoint && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          {t("branchDialogs.fromLabel")}{" "}
          <span className="mono" style={{ color: "var(--text-secondary)" }}>
            {startPoint}
          </span>
        </div>
      )}
      <DialogCheckbox
        label={t("branchDialogs.checkoutAfterCreating")}
        checked={checkout}
        onChange={setCheckout}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCreate}
        confirmLabel={t("branchDialogs.create")}
        disabled={!name.trim()}
        loading={loading}
      />
    </ModalDialog>
  );
};

export const DeleteBranchDialog: React.FC<BaseProps & { branchName: string }> = ({
  open,
  onClose,
  branchName,
}) => {
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setForce(false);
      setError(null);
    }
  }, [open]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.delete(branchName, force);
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not fully merged")) {
        setError(t("branchDialogs.branchNotFullyMerged"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.deleteBranch")} onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        {t("branchDialogs.deleteBranchConfirm", { branch: branchName })}
      </div>
      <DialogCheckbox label={t("branchDialogs.forceDelete")} checked={force} onChange={setForce} />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleDelete}
        confirmLabel={force ? t("branchDialogs.forceDeleteButton") : t("dialogs.delete")}
        confirmColor="var(--red)"
        loading={loading}
      />
    </ModalDialog>
  );
};

export const RenameBranchDialog: React.FC<BaseProps & { branchName: string }> = ({
  open,
  onClose,
  branchName,
}) => {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setNewName(branchName);
      setError(null);
    }
  }, [open, branchName]);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === branchName) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.rename(branchName, newName.trim());
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.renameBranch")} onClose={onClose}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {t("branchDialogs.currentLabel")}{" "}
        <span className="mono" style={{ color: "var(--text-secondary)" }}>
          {branchName}
        </span>
      </div>
      <DialogInput
        label={t("branchDialogs.newName")}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleRename()}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleRename}
        confirmLabel={t("dialogs.rename")}
        disabled={!newName.trim() || newName.trim() === branchName}
        loading={loading}
      />
    </ModalDialog>
  );
};

export const MergeBranchDialog: React.FC<BaseProps & { branchName: string }> = ({
  open,
  onClose,
  branchName,
}) => {
  const { repo } = useRepoStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
    }
  }, [open]);

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runGitOperation("Merge", () => window.electronAPI.branch.merge(branchName));
      setResult(res);
      await refresh();
      if (res === "success" || !res.includes("CONFLICT")) {
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.mergeBranch")} onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        Merge{" "}
        <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
          {branchName}
        </span>{" "}
        into{" "}
        <span className="mono" style={{ color: "var(--green)", fontWeight: 600 }}>
          {repo?.currentBranch}
        </span>
      </div>
      {result && result.includes("CONFLICT") && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "var(--yellow-dim)",
            color: "var(--yellow)",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          {t("branchDialogs.mergeConflictsResult")}
        </div>
      )}
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleMerge}
        confirmLabel={t("toolbar.merge")}
        loading={loading}
      />
    </ModalDialog>
  );
};

export const RebaseBranchDialog: React.FC<BaseProps & { onto: string }> = ({
  open,
  onClose,
  onto,
}) => {
  const { repo } = useRepoStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleRebase = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Rebase", () => window.electronAPI.branch.rebase(onto));
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.rebase")} onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        Rebase{" "}
        <span className="mono" style={{ color: "var(--green)", fontWeight: 600 }}>
          {repo?.currentBranch}
        </span>{" "}
        onto{" "}
        <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
          {onto}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("branchDialogs.rebaseDescription", { target: onto })}
      </div>
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleRebase}
        confirmLabel={t("branchDialogs.rebase")}
        confirmColor="var(--peach)"
        loading={loading}
      />
    </ModalDialog>
  );
};

export const CherryPickDialog: React.FC<
  BaseProps & { commitHash: string; commitSubject: string; isMerge?: boolean }
> = ({ open, onClose, commitHash, commitSubject, isMerge }) => {
  const [noCommit, setNoCommit] = useState(false);
  const [mainline, setMainline] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setError(null);
      setNoCommit(false);
      setMainline(1);
    }
  }, [open]);

  const handleCherryPick = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Cherry Pick", () =>
        window.electronAPI.branch.cherryPickWithOptions({
          hash: commitHash,
          noCommit: noCommit || undefined,
          mainline: isMerge ? mainline : undefined,
        })
      );
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.cherryPick")} onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
        {t("branchDialogs.cherryPickCommit")}
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}
      >
        {commitHash.slice(0, 10)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 12 }}>
        {commitSubject}
      </div>
      <DialogCheckbox
        label={t("branchDialogs.noCommitStageOnly")}
        checked={noCommit}
        onChange={setNoCommit}
      />
      {isMerge && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t("branchDialogs.parentNumber")}
            <select
              value={mainline}
              onChange={(e) => setMainline(Number(e.target.value))}
              style={{
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 12,
              }}
            >
              <option value={1}>{t("branchDialogs.firstParent")}</option>
              <option value={2}>{t("branchDialogs.secondParent")}</option>
            </select>
          </label>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            {t("branchDialogs.mergeCommitHint")}
          </div>
        </div>
      )}
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCherryPick}
        confirmLabel={t("branchDialogs.cherryPick")}
        confirmColor="var(--mauve)"
        loading={loading}
      />
    </ModalDialog>
  );
};

export const RevertDialog: React.FC<
  BaseProps & { commitHash: string; commitSubject: string; isMerge?: boolean }
> = ({ open, onClose, commitHash, commitSubject, isMerge }) => {
  const [noCommit, setNoCommit] = useState(false);
  const [mainline, setMainline] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setError(null);
      setNoCommit(false);
      setMainline(1);
    }
  }, [open]);

  const handleRevert = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Revert", () =>
        window.electronAPI.branch.revert({
          hash: commitHash,
          noCommit: noCommit || undefined,
          mainline: isMerge ? mainline : undefined,
        })
      );
      await refresh();
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("branchDialogs.revertCommit")} onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
        {t("branchDialogs.revertCommitLabel")}
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}
      >
        {commitHash.slice(0, 10)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 12 }}>
        {commitSubject}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("branchDialogs.revertDescription")}
      </div>
      <DialogCheckbox
        label={t("branchDialogs.noCommitStageOnly")}
        checked={noCommit}
        onChange={setNoCommit}
      />
      {isMerge && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t("branchDialogs.parentNumber")}
            <select
              value={mainline}
              onChange={(e) => setMainline(Number(e.target.value))}
              style={{
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 12,
              }}
            >
              <option value={1}>{t("branchDialogs.firstParent")}</option>
              <option value={2}>{t("branchDialogs.secondParent")}</option>
            </select>
          </label>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            {t("branchDialogs.mergeCommitHint")}
          </div>
        </div>
      )}
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleRevert}
        confirmLabel={t("branchDialogs.revertButton")}
        confirmColor="var(--peach)"
        loading={loading}
      />
    </ModalDialog>
  );
};
