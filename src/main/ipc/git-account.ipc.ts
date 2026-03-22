import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import os from "os";
import { IPC } from "../../shared/ipc-channels";
import type { GitAccount, SshHostEntry } from "../../shared/git-types";
import { gitService } from "../git/git-service";
import {
  getGitAccounts,
  addGitAccount,
  updateGitAccount,
  deleteGitAccount,
  getRepoAccount,
  setRepoAccount,
  getDefaultAccountId,
  setDefaultAccountId,
} from "../store";

export function registerAccountHandlers() {
  ipcMain.handle(IPC.ACCOUNT.LIST, () => getGitAccounts());

  ipcMain.handle(IPC.ACCOUNT.ADD, (_e, account: GitAccount) => {
    addGitAccount(account);
  });

  ipcMain.handle(IPC.ACCOUNT.UPDATE, (_e, id: string, partial: Partial<GitAccount>) => {
    updateGitAccount(id, partial);
  });

  ipcMain.handle(IPC.ACCOUNT.DELETE, (_e, id: string) => {
    deleteGitAccount(id);
  });

  ipcMain.handle(IPC.ACCOUNT.GET_FOR_REPO, (_e, repoPath: string) => {
    const accountId = getRepoAccount(repoPath);
    if (!accountId) return null;
    return getGitAccounts().find((a) => a.id === accountId) || null;
  });

  ipcMain.handle(
    IPC.ACCOUNT.SET_FOR_REPO,
    async (_e, repoPath: string, accountId: string | null) => {
      setRepoAccount(repoPath, accountId);
      if (accountId && gitService.isOpen()) {
        const account = getGitAccounts().find((a) => a.id === accountId);
        if (account) {
          await gitService.applyAccount(account.name, account.email, {
            signingKey: account.signingKey,
            sshKeyPath: account.sshKeyPath,
          });
        }
      }
    }
  );

  ipcMain.handle(IPC.ACCOUNT.GET_DEFAULT, () => {
    const id = getDefaultAccountId();
    if (!id) return null;
    return getGitAccounts().find((a) => a.id === id) || null;
  });

  ipcMain.handle(IPC.ACCOUNT.SET_DEFAULT, async (_e, accountId: string | null) => {
    setDefaultAccountId(accountId);
    if (accountId) {
      const account = getGitAccounts().find((a) => a.id === accountId);
      if (account && gitService.isOpen()) {
        await gitService.applyAccount(account.name, account.email, {
          signingKey: account.signingKey,
          sshKeyPath: account.sshKeyPath,
          global: true,
        });
      }
    }
  });

  ipcMain.handle(IPC.ACCOUNT.PARSE_SSH_CONFIG, () => parseSshConfig());
}

export function parseSshConfig(): SshHostEntry[] {
  const sshConfigPath = path.join(os.homedir(), ".ssh", "config");
  let content: string;
  try {
    content = fs.readFileSync(sshConfigPath, "utf-8");
  } catch {
    return [];
  }

  const entries: SshHostEntry[] = [];
  let current: SshHostEntry | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;

    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();

    if (key === "host") {
      // Skip wildcard-only entries
      if (value === "*") continue;
      if (current) entries.push(current);
      current = { host: value };
    } else if (current) {
      if (key === "hostname") current.hostName = value;
      else if (key === "user") current.user = value;
      else if (key === "identityfile") {
        // Resolve ~ to home directory
        current.identityFile = value.replace(/^~/, os.homedir());
      }
    }
  }
  if (current) entries.push(current);

  // Only return entries that have an IdentityFile
  return entries.filter((e) => e.identityFile);
}
