import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import fs from "fs";
import path from "path";

const KNOWN_HOOKS = [
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
  "pre-commit",
  "pre-merge-commit",
  "prepare-commit-msg",
  "commit-msg",
  "post-commit",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "pre-push",
  "pre-receive",
  "update",
  "proc-receive",
  "post-receive",
  "post-update",
  "reference-transaction",
  "push-to-checkout",
  "pre-auto-gc",
  "post-rewrite",
  "sendemail-validate",
  "fsmonitor-watchman",
  "p4-changelist",
  "p4-prepare-changelist",
  "p4-post-changelist",
  "p4-pre-submit",
  "post-index-change",
];

function getHooksDir(): string {
  const repoPath = gitService.getRepoPath();
  if (!repoPath) throw new Error("No repository open");
  const customPath = path.join(repoPath, ".git", "config");
  try {
    const config = fs.readFileSync(customPath, "utf-8");
    const match = config.match(/hooksPath\s*=\s*(.+)/);
    if (match) {
      const hookPath = match[1]!.trim();
      return path.isAbsolute(hookPath) ? hookPath : path.join(repoPath, hookPath);
    }
  } catch {}
  return path.join(repoPath, ".git", "hooks");
}

export function registerHooksHandlers() {
  ipcMain.handle(IPC.HOOKS.LIST, async () => {
    const hooksDir = getHooksDir();
    if (!fs.existsSync(hooksDir)) return [];
    const entries = fs.readdirSync(hooksDir);
    const hooks: import("../../shared/git-types").GitHookInfo[] = [];
    for (const entry of entries) {
      const fullPath = path.join(hooksDir, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const isSample = entry.endsWith(".sample");
      const baseName = isSample ? entry.replace(/\.sample$/, "") : entry;
      if (!KNOWN_HOOKS.includes(baseName) && !isSample) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      hooks.push({
        name: baseName,
        active: !isSample,
        content,
      });
    }
    // Add known hooks that don't exist yet
    const existing = new Set(hooks.map((h) => h.name));
    for (const name of KNOWN_HOOKS) {
      if (!existing.has(name)) {
        hooks.push({ name, active: false, content: "" });
      }
    }
    hooks.sort((a, b) => a.name.localeCompare(b.name));
    return hooks;
  });

  ipcMain.handle(IPC.HOOKS.READ, async (_event, name: string) => {
    const hooksDir = getHooksDir();
    const activePath = path.join(hooksDir, name);
    const samplePath = path.join(hooksDir, `${name}.sample`);
    if (fs.existsSync(activePath)) return fs.readFileSync(activePath, "utf-8");
    if (fs.existsSync(samplePath)) return fs.readFileSync(samplePath, "utf-8");
    return "";
  });

  ipcMain.handle(IPC.HOOKS.WRITE, async (_event, name: string, content: string) => {
    const hooksDir = getHooksDir();
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, name);
    fs.writeFileSync(hookPath, content, { mode: 0o755 });
    // Remove .sample if it exists
    const samplePath = path.join(hooksDir, `${name}.sample`);
    if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
  });

  ipcMain.handle(IPC.HOOKS.TOGGLE, async (_event, name: string) => {
    const hooksDir = getHooksDir();
    const activePath = path.join(hooksDir, name);
    const samplePath = path.join(hooksDir, `${name}.sample`);
    if (fs.existsSync(activePath)) {
      fs.renameSync(activePath, samplePath);
      return false;
    } else if (fs.existsSync(samplePath)) {
      fs.renameSync(samplePath, activePath);
      fs.chmodSync(activePath, 0o755);
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC.HOOKS.DELETE, async (_event, name: string) => {
    const hooksDir = getHooksDir();
    const activePath = path.join(hooksDir, name);
    const samplePath = path.join(hooksDir, `${name}.sample`);
    if (fs.existsSync(activePath)) fs.unlinkSync(activePath);
    if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
  });
}
