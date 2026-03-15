import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Git Expansion",
    executableName: "git-expansion",
    appBundleId: "com.git-expansion.app",
    icon: "./assets/icon",
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "git-expansion",
      setupExe: "GitExpansion-Setup.exe",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDeb({
      options: {
        name: "git-expansion",
        productName: "Git Expansion",
        genericName: "Git GUI",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
        mimeType: ["x-scheme-handler/git-expansion"],
      },
    }),
    new MakerRpm({
      options: {
        name: "git-expansion",
        productName: "Git Expansion",
        license: "MIT",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
