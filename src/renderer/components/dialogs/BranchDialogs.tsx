import React, { useState, useEffect } from "react";
import { ModalDialog, DialogInput, DialogActions, DialogError, DialogCheckbox } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

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

  useEffect(() => {
    if (open) { setName(""); setError(null); }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.create(name.trim(), startPoint);
      if (checkout) {
        await window.electronAPI.branch.checkout(name.trim());
      }
      await refresh();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Create Branch" onClose={onClose}>
      <DialogInput
        label="Branch name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="feature/my-branch"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      {startPoint && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          From: <span className="mono" style={{ color: "var(--text-secondary)" }}>{startPoint}</span>
        </div>
      )}
      <DialogCheckbox label="Checkout after creating" checked={checkout} onChange={setCheckout} />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCreate}
        confirmLabel="Create"
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

  useEffect(() => {
    if (open) { setForce(false); setError(null); }
  }, [open]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.delete(branchName, force);
      await refresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not fully merged")) {
        setError("Branch is not fully merged. Enable force delete to proceed.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Delete Branch" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        Delete branch <span className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>{branchName}</span>?
      </div>
      <DialogCheckbox label="Force delete (even if not fully merged)" checked={force} onChange={setForce} />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleDelete}
        confirmLabel={force ? "Force Delete" : "Delete"}
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

  useEffect(() => {
    if (open) { setNewName(branchName); setError(null); }
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Rename Branch" onClose={onClose}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        Current: <span className="mono" style={{ color: "var(--text-secondary)" }}>{branchName}</span>
      </div>
      <DialogInput
        label="New name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleRename()}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleRename}
        confirmLabel="Rename"
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

  useEffect(() => {
    if (open) { setError(null); setResult(null); }
  }, [open]);

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.branch.merge(branchName);
      setResult(res);
      await refresh();
      if (res === "success" || !res.includes("CONFLICT")) {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Merge Branch" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        Merge <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{branchName}</span> into{" "}
        <span className="mono" style={{ color: "var(--green)", fontWeight: 600 }}>{repo?.currentBranch}</span>
      </div>
      {result && result.includes("CONFLICT") && (
        <div style={{ padding: 10, borderRadius: 6, background: "var(--yellow-dim)", color: "var(--yellow)", fontSize: 12, marginBottom: 8 }}>
          Merge resulted in conflicts. Resolve them and commit manually.
        </div>
      )}
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleMerge}
        confirmLabel="Merge"
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

  useEffect(() => {
    if (open) { setError(null); }
  }, [open]);

  const handleRebase = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.rebase(onto);
      await refresh();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Rebase" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 12 }}>
        Rebase <span className="mono" style={{ color: "var(--green)", fontWeight: 600 }}>{repo?.currentBranch}</span> onto{" "}
        <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{onto}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        This will replay your commits on top of {onto}.
      </div>
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleRebase}
        confirmLabel="Rebase"
        confirmColor="var(--peach)"
        loading={loading}
      />
    </ModalDialog>
  );
};

export const CherryPickDialog: React.FC<BaseProps & { commitHash: string; commitSubject: string }> = ({
  open,
  onClose,
  commitHash,
  commitSubject,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRefreshAfter();

  useEffect(() => {
    if (open) { setError(null); }
  }, [open]);

  const handleCherryPick = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.cherryPick(commitHash);
      await refresh();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Cherry Pick" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
        Cherry-pick commit:
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        {commitHash.slice(0, 10)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 12 }}>
        {commitSubject}
      </div>
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCherryPick}
        confirmLabel="Cherry Pick"
        confirmColor="var(--mauve)"
        loading={loading}
      />
    </ModalDialog>
  );
};
