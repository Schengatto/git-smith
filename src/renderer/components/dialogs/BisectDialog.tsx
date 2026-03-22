import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog } from "./ModalDialog";
import { useGraphStore } from "../../store/graph-store";
import { useRepoStore } from "../../store/repo-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const BisectDialog: React.FC<Props> = ({ open, onClose }) => {
  const [active, setActive] = useState(false);
  const [good, setGood] = useState<string[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | undefined>();
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const { loadGraph, selectCommit } = useGraphStore();
  const { refreshInfo, refreshStatus } = useRepoStore();

  const refreshBisectStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.bisect.status();
      setActive(status.active);
      setGood(status.good || []);
      setBad(status.bad || []);
      setCurrent(status.current);
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      refreshBisectStatus();
      setOutput("");
      setError("");
    }
  }, [open, refreshBisectStatus]);

  const handleAction = async (action: () => Promise<string>) => {
    setError("");
    try {
      const result = await action();
      setOutput(result);
      await refreshBisectStatus();
      await loadGraph();
      await refreshInfo();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStart = () => handleAction(() => window.electronAPI.bisect.start());
  const handleGood = () => handleAction(() => window.electronAPI.bisect.good());
  const handleBad = () => handleAction(() => window.electronAPI.bisect.bad());
  const handleSkip = () => handleAction(() => window.electronAPI.bisect.skip());
  const handleReset = () => handleAction(() => window.electronAPI.bisect.reset());

  const handleShowCurrent = () => {
    if (current) {
      selectCommit(current);
      onClose();
    }
  };

  return (
    <ModalDialog open={open} title="Git Bisect" onClose={onClose} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
        {/* Status */}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: active ? "var(--accent-dim)" : "var(--surface-0)",
            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {active ? "Bisect in Progress" : "Bisect Not Active"}
          </div>
          {active && (
            <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
              {good.length > 0 && <div>Good: {good.map((h) => h.slice(0, 7)).join(", ")}</div>}
              {bad.length > 0 && <div>Bad: {bad.map((h) => h.slice(0, 7)).join(", ")}</div>}
              {current && (
                <div style={{ marginTop: 4 }}>
                  Current:{" "}
                  <span
                    className="mono"
                    style={{
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    onClick={handleShowCurrent}
                  >
                    {current.slice(0, 7)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {!active ? (
            <button
              className="toolbar-btn"
              onClick={handleStart}
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              Start Bisect
            </button>
          ) : (
            <>
              <button
                className="toolbar-btn"
                onClick={handleGood}
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  background: "var(--green)",
                  color: "var(--text-on-color)",
                }}
              >
                Good
              </button>
              <button
                className="toolbar-btn"
                onClick={handleBad}
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  background: "var(--red)",
                  color: "var(--text-on-color)",
                }}
              >
                Bad
              </button>
              <button
                className="toolbar-btn"
                onClick={handleSkip}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                Skip
              </button>
              <button
                className="toolbar-btn"
                onClick={handleReset}
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  background: "var(--peach)",
                  color: "var(--text-on-color)",
                }}
              >
                Reset Bisect
              </button>
            </>
          )}
        </div>

        {/* Output */}
        {output && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              background: "var(--surface-0)",
              padding: "8px 10px",
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {output}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 11, color: "var(--red)", padding: "4px 0" }}>{error}</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
        <button
          className="toolbar-btn"
          onClick={onClose}
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          Close
        </button>
      </div>
    </ModalDialog>
  );
};
