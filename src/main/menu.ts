import { app, Menu } from "electron";

export function createMenu() {
  const isMac = process.platform === "darwin";

  if (!isMac) {
    // On Windows/Linux, hide the native menu bar — the app provides its own React MenuBar
    Menu.setApplicationMenu(null);
    return;
  }

  // macOS: keep a minimal native menu (app name + Edit for clipboard shortcuts)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
