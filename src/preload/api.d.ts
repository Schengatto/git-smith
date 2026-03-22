import type { ElectronAPI } from "./index";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  /** Injected by Vite define — reads package.json version at build time */
  const __APP_VERSION__: string;
}
