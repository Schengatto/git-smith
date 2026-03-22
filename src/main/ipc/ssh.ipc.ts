import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import type { SshKeyInfo } from "../../shared/git-types";

const execFileAsync = promisify(execFile);

function getSshDir(): string {
  return path.join(os.homedir(), ".ssh");
}

export function registerSshHandlers() {
  ipcMain.handle(IPC.SSH.LIST, async (): Promise<SshKeyInfo[]> => {
    const sshDir = getSshDir();
    if (!fs.existsSync(sshDir)) return [];

    const entries = fs.readdirSync(sshDir);
    const keys: SshKeyInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(sshDir, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      // Skip public keys, config, known_hosts, etc.
      if (
        entry.endsWith(".pub") ||
        entry === "config" ||
        entry === "known_hosts" ||
        entry === "authorized_keys" ||
        entry === "known_hosts.old"
      )
        continue;

      const pubPath = fullPath + ".pub";
      const hasPublicKey = fs.existsSync(pubPath);

      let type = "unknown";
      let fingerprint = "";
      if (hasPublicKey) {
        try {
          const pubContent = fs.readFileSync(pubPath, "utf-8").trim();
          const parts = pubContent.split(" ");
          type = (parts[0] || "").replace("ssh-", "");
          // Get fingerprint
          try {
            const { stdout } = await execFileAsync("ssh-keygen", ["-lf", pubPath], {
              timeout: 5000,
            });
            fingerprint = stdout.trim().split(" ")[1] || "";
          } catch {}
        } catch {}
      }

      keys.push({ name: entry, type, fingerprint, path: fullPath, hasPublicKey });
    }

    return keys;
  });

  ipcMain.handle(
    IPC.SSH.GENERATE,
    async (
      _event,
      type: "ed25519" | "rsa",
      comment: string,
      passphrase: string,
      filename: string
    ): Promise<string> => {
      const sshDir = getSshDir();
      if (!fs.existsSync(sshDir)) fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });

      const keyPath = path.join(sshDir, filename);
      if (fs.existsSync(keyPath)) throw new Error(`Key file already exists: ${filename}`);

      const args = [
        "-t",
        type,
        "-C",
        comment || "",
        "-f",
        keyPath,
        "-N",
        passphrase || "",
      ];
      if (type === "rsa") args.push("-b", "4096");

      const { stderr } = await execFileAsync("ssh-keygen", args, { timeout: 30000 });
      if (stderr && stderr.includes("Error")) throw new Error(stderr);

      const pubPath = keyPath + ".pub";
      if (fs.existsSync(pubPath)) return fs.readFileSync(pubPath, "utf-8");
      return "";
    }
  );

  ipcMain.handle(IPC.SSH.GET_PUBLIC, async (_event, name: string): Promise<string> => {
    const pubPath = path.join(getSshDir(), name + ".pub");
    if (!fs.existsSync(pubPath)) {
      const keyPath = path.join(getSshDir(), name);
      if (!fs.existsSync(keyPath)) return "";
      return "";
    }
    return fs.readFileSync(pubPath, "utf-8");
  });

  ipcMain.handle(IPC.SSH.TEST, async (_event, host: string): Promise<string> => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "ssh",
        ["-T", "-o", "StrictHostKeyChecking=accept-new", host],
        { timeout: 15000 }
      );
      return stdout || stderr || "Connection successful";
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "stderr" in err
          ? String((err as { stderr: string }).stderr)
          : String(err);
      // ssh -T often exits with code 1 but still succeeds (GitHub returns "Hi username!")
      if (msg.includes("successfully authenticated") || msg.includes("Hi ")) return msg;
      throw new Error(msg);
    }
  });
}
