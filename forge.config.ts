import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerWix } from "@electron-forge/maker-wix";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { createHash } from "crypto";
import { readFile, writeFile, stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

async function computeSha512(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha512").update(data).digest("base64");
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "{**/*.node,**/node-pty/**}",
    },
    name: "GitSmith",
    executableName: "gitsmith",
    appBundleId: "com.gitsmith.app",
    icon: "./assets/icon",
    extraResource: ["./USER_MANUAL.pdf"],
  },
  rebuildConfig: {
    // Rebuild node-pty against Electron's ABI (skipped on Windows where prebuilds work without rebuild)
    onlyModules: process.platform !== "win32" ? ["node-pty"] : [],
  },
  makers: [
    new MakerWix({
      name: "GitSmith",
      manufacturer: "GitSmith",
      exe: "gitsmith",
      icon: "./assets/icon.ico",
      shortcutName: "GitSmith",
      shortcutFolderName: "GitSmith",
      programFilesFolderName: "GitSmith",
      upgradeCode: "b8e5b4a0-7c1f-4e3a-9d2f-1a5c8b6e4f30",
      ui: {
        chooseDirectory: true,
      },
    }),
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDeb({
      options: {
        name: "gitsmith",
        productName: "GitSmith",
        genericName: "Git GUI",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
        mimeType: ["x-scheme-handler/gitsmith"],
      },
    }),
    new MakerRpm({
      options: {
        name: "gitsmith",
        productName: "GitSmith",
        license: "MIT",
        description: "Cross-platform Git GUI inspired by GitExtensions",
        categories: ["Development", "RevisionControl"],
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: { owner: "Schengatto", name: "git-smith" },
      prerelease: false,
      draft: false,
    }),
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      // node-pty is a native module externalized from Vite — copy it into the package
      const nativeModules = ["node-pty", "node-addon-api"];
      for (const mod of nativeModules) {
        const src = path.join(__dirname, "node_modules", mod);
        const dest = path.join(buildPath, "node_modules", mod);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }

      // Strip node-pty bloat: debug symbols, wrong-platform prebuilds, source code
      const ptyDest = path.join(buildPath, "node_modules", "node-pty");
      if (fs.existsSync(ptyDest)) {
        const keepPrebuild = `${platform}-${arch}`;

        // Remove prebuilds for other platforms/architectures
        const prebuildsDir = path.join(ptyDest, "prebuilds");
        if (fs.existsSync(prebuildsDir)) {
          for (const dir of fs.readdirSync(prebuildsDir)) {
            if (dir !== keepPrebuild) {
              fs.rmSync(path.join(prebuildsDir, dir), { recursive: true, force: true });
            }
          }
        }

        // Remove debug symbols (.pdb) from remaining prebuilds
        const keptDir = path.join(prebuildsDir, keepPrebuild);
        if (fs.existsSync(keptDir)) {
          for (const file of fs.readdirSync(keptDir)) {
            if (file.endsWith(".pdb")) {
              fs.rmSync(path.join(keptDir, file));
            }
          }
        }

        // Remove directories not needed at runtime
        for (const dir of ["src", "vendor", "scripts", "third_party", "build"]) {
          const p = path.join(ptyDest, dir);
          if (fs.existsSync(p)) {
            fs.rmSync(p, { recursive: true, force: true });
          }
        }

        // Remove unnecessary files from root
        for (const file of fs.readdirSync(ptyDest)) {
          const ext = path.extname(file).toLowerCase();
          if ([".md", ".ts", ".map", ".gyp"].includes(ext) || file === "binding.gyp") {
            fs.rmSync(path.join(ptyDest, file), { force: true });
          }
        }
      }
    },
    postPackage: async (_config, { outputPaths, platform }) => {
      // Ad-hoc codesign on macOS to avoid "app is damaged" Gatekeeper error
      if (platform === "darwin") {
        for (const outputPath of outputPaths) {
          const appBundles = fs.readdirSync(outputPath).filter((f) => f.endsWith(".app"));
          for (const app of appBundles) {
            const appPath = path.join(outputPath, app);
            console.log(`Ad-hoc signing ${appPath}...`);
            await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", appPath]);
            console.log(`Ad-hoc signed ${app}`);
          }
        }
      }

      // Generate app-update.yml for electron-updater (must be in resources/, outside asar)
      const appUpdateYml = [
        "provider: github",
        "owner: Schengatto",
        "repo: git-smith",
      ].join("\n");
      for (const outputPath of outputPaths) {
        const resourcesDir = path.join(outputPath, "resources");
        if (fs.existsSync(resourcesDir)) {
          fs.writeFileSync(
            path.join(resourcesDir, "app-update.yml"),
            appUpdateYml,
            "utf-8"
          );
        }
      }
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

        // Find the primary distributable artifact (msi, zip, deb, rpm)
        const artifact = result.artifacts.find(
          (a) =>
            a.endsWith(".msi") ||
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
