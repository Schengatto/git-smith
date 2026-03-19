import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { createHash } from "crypto";
import { readFile, writeFile, stat } from "fs/promises";
import fs from "fs";
import path from "path";

async function computeSha512(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha512").update(data).digest("base64");
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "{**/*.node,**/node-pty/**}",
    },
    name: "Git Expansion",
    executableName: "git-expansion",
    appBundleId: "com.git-expansion.app",
    icon: "./assets/icon",
  },
  rebuildConfig: {
    // node-pty ships prebuilt NAPI binaries — skip native rebuild (no VS C++ needed)
    onlyModules: [],
  },
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
  publishers: [
    new PublisherGithub({
      repository: { owner: "Schengatto", name: "git-expansion" },
      prerelease: false,
      draft: true,
    }),
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // node-pty is a native module externalized from Vite — copy it into the package
      const nativeModules = ["node-pty", "node-addon-api"];
      for (const mod of nativeModules) {
        const src = path.join(__dirname, "node_modules", mod);
        const dest = path.join(buildPath, "node_modules", mod);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }

      // Generate app-update.yml for electron-updater (normally created by electron-builder)
      const appUpdateYml = [
        "provider: github",
        "owner: Schengatto",
        "repo: git-expansion",
      ].join("\n");
      fs.writeFileSync(path.join(buildPath, "app-update.yml"), appUpdateYml, "utf-8");
    },
    postMake: async (_forgeConfig, makeResults) => {
      const releaseDate = new Date().toISOString();

      for (const result of makeResults) {
        const version = result.packageJSON.version;

        // Determine which latest-*.yml to generate based on platform
        let ymlName: string | null = null;
        if (result.platform === "win32") ymlName = "latest.yml";
        else if (result.platform === "darwin") ymlName = "latest-mac.yml";
        else if (result.platform === "linux") ymlName = "latest-linux.yml";

        if (!ymlName) continue;

        // Find the primary distributable artifact (exe, zip, deb)
        const artifact = result.artifacts.find(
          (a) =>
            a.endsWith(".exe") ||
            a.endsWith(".zip") ||
            a.endsWith(".deb") ||
            a.endsWith(".rpm")
        );
        if (!artifact) continue;

        const { size } = await stat(artifact);
        const sha512 = await computeSha512(artifact);
        const fileName = path.basename(artifact);

        const yml = [
          `version: ${version}`,
          `files:`,
          `  - url: ${fileName}`,
          `    sha512: ${sha512}`,
          `    size: ${size}`,
          `path: ${fileName}`,
          `sha512: ${sha512}`,
          `releaseDate: '${releaseDate}'`,
        ].join("\n");

        const ymlPath = path.join(path.dirname(artifact), ymlName);
        await writeFile(ymlPath, yml, "utf-8");

        // Add to artifacts so publisher uploads it
        result.artifacts.push(ymlPath);
      }

      return makeResults;
    },
  },
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
