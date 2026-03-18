import type { DialogOpenRequest } from "../../shared/dialog-types";

export function openDialogWindow(request: DialogOpenRequest): void {
  window.electronAPI.dialog.open(request);
}
