import { ipcMain } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { IPC } from "../../shared/ipc-channels";
import { getSettings } from "../store";
import { gitService } from "../git/git-service";

const ALLOWED_ARGS = /^[\w\s"'\-/\\.=:$]*$/;

function validateEditorPath(editorPath: string): void {
  if (!editorPath) {
    throw new Error("No editor configured");
  }
  if (path.isAbsolute(editorPath)) {
    try {
      fs.accessSync(editorPath, fs.constants.F_OK);
    } catch {
      throw new Error(`Editor not found: ${editorPath}`);
    }
  }
}

function validateArgs(argsPattern: string): void {
  const stripped = argsPattern.replace(/\$FILE/g, "");
  if (!ALLOWED_ARGS.test(stripped)) {
    throw new Error("Editor arguments contain invalid characters");
  }
}

function spawnDetached(executable: string, args: string[]): void {
  const proc = spawn(executable, args, {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  proc.on("error", (err) => {
    console.error(`Failed to launch editor: ${err.message}`);
  });
  proc.unref();
}

export function registerEditorHandlers() {
  ipcMain.handle(IPC.EDITOR.LAUNCH, async (_event, repoPath: string) => {
    const { editorPath } = getSettings();
    validateEditorPath(editorPath);
    spawnDetached(editorPath, [repoPath]);
  });

  ipcMain.handle(IPC.EDITOR.LAUNCH_FILE, async (_event, filePath: string) => {
    const { editorPath, editorArgs } = getSettings();
    validateEditorPath(editorPath);
    validateArgs(editorArgs);

    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository open");

    const absolutePath = path.resolve(repoPath, filePath);

    const resolvedArgs = editorArgs.includes("$FILE")
      ? editorArgs.replace(/\$FILE/g, absolutePath)
      : `"${absolutePath}"`;

    const args =
      resolvedArgs.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, "")) || [];

    spawnDetached(editorPath, args);
  });
}
