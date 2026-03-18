export type DialogName =
  | "MergeConflictDialog"
  | "CommitInfoWindow"
  | "StashDialog"
  | "SettingsDialog"
  | "InteractiveRebaseDialog"
  | "ChangelogDialog";

export interface DialogWindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  modal: boolean;
}

export const DIALOG_CONFIGS: Record<DialogName, DialogWindowConfig> = {
  MergeConflictDialog:     { width: 1200, height: 800, minWidth: 800, minHeight: 500, modal: false },
  CommitInfoWindow:        { width: 900,  height: 700, minWidth: 600, minHeight: 400, modal: false },
  StashDialog:             { width: 850,  height: 600, minWidth: 600, minHeight: 400, modal: true },
  SettingsDialog:          { width: 800,  height: 600, minWidth: 600, minHeight: 400, modal: true },
  InteractiveRebaseDialog: { width: 900,  height: 650, minWidth: 700, minHeight: 400, modal: true },
  ChangelogDialog:         { width: 700,  height: 550, minWidth: 500, minHeight: 400, modal: false },
};

export interface DialogOpenRequest {
  dialog: DialogName;
  data?: Record<string, unknown>;
}

export interface DialogResult {
  dialogName: DialogName;
  action: "resolved" | "cancelled" | "navigate" | "closed";
  data?: Record<string, unknown>;
}
