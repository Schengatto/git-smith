import { Notification, BrowserWindow } from "electron";
import { getSettings } from "../store";

export function showNotification(
  title: string,
  body: string,
  category: "fetch" | "push" | "error"
): void {
  const settings = getSettings();
  if (!settings.notifications.enabled) return;
  if (category === "fetch" && !settings.notifications.onFetch) return;
  if (category === "push" && !settings.notifications.onPush) return;
  if (category === "error" && !settings.notifications.onError) return;

  // Don't show if window is focused
  const windows = BrowserWindow.getAllWindows();
  if (windows.some((w) => w.isFocused())) return;

  const notification = new Notification({ title, body, silent: false });
  notification.on("click", () => {
    const win = windows[0];
    if (win) {
      win.show();
      win.focus();
    }
  });
  notification.show();
}
