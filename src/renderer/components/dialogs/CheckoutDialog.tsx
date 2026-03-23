import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import type { RefInfo } from "../../../shared/git-types";

type LocalChangesStrategy = "none" | "merge" | "stash" | "reset";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The refs (branches) on the commit being right-clicked */
  refs?: RefInfo[];
  /** The commit hash (for detached HEAD checkout) */
  commitHash?: string;
  commitSubject?: string;
  /** Direct branch name — when set, skips branch picker and checks out this branch */
  branchName?: string;
}

export const CheckoutDialog: React.FC<Props> = ({
  open,
  onClose,
  refs = [],
  commitHash = "",
  commitSubject = "",
  branchName,
}) => {
  const { t } = useTranslation();
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  // Direct branch mode — skip branch picker
  const directMode = !!branchName;

  // Filter checkable branches (non-current local + remote)
  const localBranches = refs.filter((r) => r.type === "head" && !r.current);
  const remoteBranches = refs.filter((r) => r.type === "remote");
  const allBranches = [...localBranches, ...remoteBranches];

  const [branchType, setBranchType] = useState<"local" | "remote">("local");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [localChanges, setLocalChanges] = useState<LocalChangesStrategy>("none");
  const [checkoutDetached, setCheckoutDetached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
      setCheckoutDetached(false);
      setLocalChanges("none");

      if (directMode) {
        setSelectedBranch(branchName!);
      } else if (localBranches.length > 0) {
        setBranchType("local");
        setSelectedBranch(localBranches[0]!.name);
      } else if (remoteBranches.length > 0) {
        setBranchType("remote");
        setSelectedBranch(remoteBranches[0]!.name);
      } else {
        setCheckoutDetached(true);
        setSelectedBranch("");
      }
    }
    // Only run when dialog opens/closes; initializes branch selection on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredBranches = branchType === "local" ? localBranches : remoteBranches;

  // Update selected branch when switching type
  const handleTypeChange = (type: "local" | "remote") => {
    setBranchType(type);
    setCheckoutDetached(false);
    const list = type === "local" ? localBranches : remoteBranches;
    if (list.length > 0) {
      setSelectedBranch(list[0]!.name);
    } else {
      setSelectedBranch("");
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      // Handle local changes
      if (localChanges === "stash") {
        await runGitOperation("Stash", () => window.electronAPI.stash.create());
      } else if (localChanges === "reset") {
        await window.electronAPI.status.discardAll();
      }

      // Checkout
      if (checkoutDetached) {
        await runGitOperation("Checkout (detached)", () =>
          window.electronAPI.branch.checkout(commitHash)
        );
      } else {
        const ref = selectedBranch;
        const checkoutOpts: string[] = [];
        if (localChanges === "merge") checkoutOpts.push("--merge");

        if (checkoutOpts.length > 0) {
          // Use raw checkout with merge flag
          await runGitOperation("Checkout", () =>
            window.electronAPI.branch.checkoutWithOptions(ref, { merge: true })
          );
        } else {
          await runGitOperation("Checkout", () => window.electronAPI.branch.checkout(ref));
        }
      }

      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const hasNoBranches = allBranches.length === 0;

  return (
    <ModalDialog open={open} title={t("checkout.title")} onClose={onClose} width={480}>
      {/* Direct branch mode — show branch name */}
      {directMode && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabelStyle}>{t("checkout.branch")}</label>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              padding: "7px 10px",
              borderRadius: 6,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {branchName}
          </div>
        </div>
      )}

      {/* Branch type tabs */}
      {!directMode && !hasNoBranches && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                checked={!checkoutDetached && branchType === "local"}
                onChange={() => handleTypeChange("local")}
                disabled={localBranches.length === 0}
                style={radioStyle}
              />
              {t("checkout.localBranch")}
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                checked={!checkoutDetached && branchType === "remote"}
                onChange={() => handleTypeChange("remote")}
                disabled={remoteBranches.length === 0}
                style={radioStyle}
              />
              {t("checkout.remoteBranch")}
            </label>
          </div>

          {/* Branch selector */}
          {!checkoutDetached && (
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabelStyle}>{t("checkout.selectBranch")}</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={selectStyle}
              >
                {filteredBranches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                checked={checkoutDetached}
                onChange={() => {
                  setCheckoutDetached(true);
                  setSelectedBranch("");
                }}
                style={radioStyle}
              />
              {t("checkout.detachedHead")}
            </label>
          </div>

          {checkoutDetached && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 12,
                padding: "6px 10px",
                background: "var(--surface-0)",
                borderRadius: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {commitHash.slice(0, 10)} — {commitSubject}
            </div>
          )}
        </>
      )}

      {/* No branches — only detached HEAD */}
      {!directMode && hasNoBranches && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
            {t("checkout.detachedHeadTitle")}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "6px 10px",
              background: "var(--surface-0)",
              borderRadius: 6,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {commitHash.slice(0, 10)} — {commitSubject}
          </div>
        </div>
      )}

      {/* Local changes strategy */}
      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "8px 12px 10px",
          margin: "0 0 12px",
        }}
      >
        <legend
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "0 6px",
          }}
        >
          {t("checkout.localChanges")}
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
          {(
            [
              ["none", t("checkout.dontChange")],
              ["merge", t("checkout.mergeChanges")],
              ["stash", t("checkout.stashChanges")],
              ["reset", t("checkout.resetChanges")],
            ] as [LocalChangesStrategy, string][]
          ).map(([value, label]) => (
            <label key={value} style={radioLabelStyle}>
              <input
                type="radio"
                name="localChanges"
                checked={localChanges === value}
                onChange={() => setLocalChanges(value)}
                style={radioStyle}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {localChanges === "reset" && (
        <div
          style={{
            fontSize: 11,
            color: "var(--peach)",
            marginBottom: 8,
          }}
        >
          {t("checkout.warningDiscardChanges")}
        </div>
      )}

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCheckout}
        confirmLabel={t("checkout.checkoutButton")}
        loading={loading}
        disabled={!checkoutDetached && !selectedBranch}
      />
    </ModalDialog>
  );
};

/* ---------- Styles ---------- */

const radioLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  userSelect: "none",
};

const radioStyle: React.CSSProperties = {
  margin: 0,
  accentColor: "var(--accent)",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
};
