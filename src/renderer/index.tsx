import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "dockview/dist/styles/dockview.css";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove splash screen once React has mounted
const splash = document.getElementById("splash");
if (splash) {
  splash.style.transition = "opacity 0.3s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 300);
}
