import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DialogRouter } from "./components/DialogRouter";
import "dockview/dist/styles/dockview.css";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const dialogName = params.get("dialog");

// Remove splash screen immediately for dialog windows, with animation for main
const splash = document.getElementById("splash");
if (splash) {
  if (dialogName) {
    splash.remove();
  } else {
    splash.style.transition = "opacity 0.3s ease";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 300);
  }
}

const root = createRoot(document.getElementById("root")!);

if (dialogName) {
  root.render(
    <React.StrictMode>
      <DialogRouter dialog={dialogName} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
