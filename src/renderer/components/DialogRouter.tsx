import React, { Component, useEffect, useState } from "react";
import type { DialogResult } from "../../shared/dialog-types";

import { MergeConflictDialog as _MergeConflictDialog } from "./dialogs/MergeConflictDialog";
import { CommitInfoWindow as _CommitInfoWindow } from "./dialogs/CommitInfoWindow";
import { StashDialog as _StashDialog } from "./dialogs/StashDialog";
import { SettingsDialog as _SettingsDialog } from "./dialogs/SettingsDialog";
import { InteractiveRebaseDialog as _InteractiveRebaseDialog } from "./dialogs/InteractiveRebaseDialog";
import { ChangelogDialog } from "./dialogs/ChangelogDialog";

// Temporary casts until Tasks 6-10 add the `mode` prop to each dialog
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MergeConflictDialog = _MergeConflictDialog as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CommitInfoWindow = _CommitInfoWindow as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StashDialog = _StashDialog as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SettingsDialog = _SettingsDialog as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InteractiveRebaseDialog = _InteractiveRebaseDialog as React.ComponentType<any>;

interface Props {
  dialog: string;
}

/** Error boundary for child window dialogs */
class DialogErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[DialogRouter] Render error:", error);
    setTimeout(() => window.close(), 3000);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24, color: "var(--text-primary)", background: "var(--surface-0)",
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <p style={{ color: "var(--red)", fontSize: 14 }}>
            Dialog error: {this.state.error.message}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
            Window will close automatically...
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const DialogRouter: React.FC<Props> = ({ dialog }) => {
  const [initData, setInitData] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.electronAPI.dialog
      .getInitData()
      .then((data) => {
        if (data) setInitData(data);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const handleClose = () => {
    window.electronAPI.dialog.sendResult({
      dialogName: dialog as DialogResult["dialogName"],
      action: "cancelled",
    });
    window.close();
  };

  const handleResult = (action: DialogResult["action"], data?: Record<string, unknown>) => {
    window.electronAPI.dialog.sendResult({
      dialogName: dialog as DialogResult["dialogName"],
      action,
      data,
    });
    if (action !== "navigate") window.close();
  };

  if (!ready) {
    return (
      <div style={{
        height: "100vh", background: "var(--surface-0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)",
      }}>
        Loading...
      </div>
    );
  }

  const dialogContent = (() => {
    switch (dialog) {
      case "MergeConflictDialog":
        return (
          <MergeConflictDialog
            open={true}
            onClose={handleClose}
            onResolved={() => handleResult("resolved")}
            mode="window"
          />
        );
      case "CommitInfoWindow":
        return (
          <CommitInfoWindow
            open={true}
            onClose={handleClose}
            commitHash={(initData.commitHash as string) || "HEAD"}
            onNavigateToCommit={(hash: string) => handleResult("navigate", { hash })}
            mode="window"
          />
        );
      case "StashDialog":
        return (
          <StashDialog open={true} onClose={handleClose} mode="window" />
        );
      case "SettingsDialog":
        return (
          <SettingsDialog open={true} onClose={handleClose} mode="window" />
        );
      case "InteractiveRebaseDialog":
        return (
          <InteractiveRebaseDialog
            open={true}
            onClose={handleClose}
            onto={(initData.onto as string) || ""}
            mode="window"
          />
        );
      case "ChangelogDialog":
        return (
          <ChangelogDialog
            open={true}
            onClose={handleClose}
            commitHash={(initData.commitHash as string) || "HEAD"}
            commitSubject={initData.commitSubject as string | undefined}
            mode="window"
          />
        );
      default:
        return (
          <div style={{
            padding: 24, color: "var(--text-primary)", background: "var(--surface-0)",
            height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <p style={{ color: "var(--red)" }}>Unknown dialog: {dialog}</p>
          </div>
        );
    }
  })();

  return <DialogErrorBoundary>{dialogContent}</DialogErrorBoundary>;
};
