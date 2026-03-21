import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock store
const mockAccounts = [
  { id: "acc-1", label: "Work", name: "John Work", email: "john@work.com", signingKey: "", sshKeyPath: "" },
  { id: "acc-2", label: "Personal", name: "John Doe", email: "john@personal.com", signingKey: "", sshKeyPath: "/home/john/.ssh/id_ed25519" },
];
const mockRepoAccountMap: Record<string, string> = {};
let mockDefaultAccountId: string | null = null;

vi.mock("../store", () => ({
  getGitAccounts: vi.fn(() => [...mockAccounts]),
  addGitAccount: vi.fn((account) => mockAccounts.push(account)),
  updateGitAccount: vi.fn(),
  deleteGitAccount: vi.fn(),
  getRepoAccount: vi.fn((repoPath: string) => mockRepoAccountMap[repoPath] || null),
  setRepoAccount: vi.fn((repoPath: string, accountId: string | null) => {
    if (accountId) mockRepoAccountMap[repoPath] = accountId;
    else delete mockRepoAccountMap[repoPath];
  }),
  getDefaultAccountId: vi.fn(() => mockDefaultAccountId),
  setDefaultAccountId: vi.fn((id: string | null) => { mockDefaultAccountId = id; }),
}));

// Mock gitService
vi.mock("../git/git-service", () => ({
  gitService: {
    isOpen: vi.fn(() => true),
    applyAccount: vi.fn(),
  },
}));

import { ipcMain } from "electron";
import { registerAccountHandlers, parseSshConfig } from "./git-account.ipc";
import { gitService } from "../git/git-service";
import fs from "fs";
import path from "path";
import os from "os";

type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;

function getHandler(channel: string): HandlerFn {
  const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
  const call = handleMock.mock.calls.find((c: unknown[]) => c[0] === channel);
  if (!call) throw new Error(`Handler not registered for ${channel}`);
  return call[1];
}

describe("git-account IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAccountHandlers();
  });

  it("registers all ACCOUNT handlers including PARSE_SSH_CONFIG", () => {
    const handleMock = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    const channels = handleMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain("git:account:parse-ssh-config");
    expect(channels).toContain("git:account:list");
    expect(channels).toContain("git:account:add");
    expect(channels).toContain("git:account:update");
    expect(channels).toContain("git:account:delete");
    expect(channels).toContain("git:account:get-for-repo");
    expect(channels).toContain("git:account:set-for-repo");
    expect(channels).toContain("git:account:get-default");
    expect(channels).toContain("git:account:set-default");
  });

  it("LIST returns all accounts", async () => {
    const handler = getHandler("git:account:list");
    const result = await handler(null);
    expect(result).toEqual(mockAccounts);
  });

  it("GET_FOR_REPO returns null when no account is assigned", async () => {
    const handler = getHandler("git:account:get-for-repo");
    const result = await handler(null, "/some/repo");
    expect(result).toBeNull();
  });

  it("SET_FOR_REPO applies account when repo is open", async () => {
    const handler = getHandler("git:account:set-for-repo");
    await handler(null, "/some/repo", "acc-2");
    expect(gitService.applyAccount).toHaveBeenCalledWith(
      "John Doe",
      "john@personal.com",
      { signingKey: "", sshKeyPath: "/home/john/.ssh/id_ed25519" }
    );
  });

  it("SET_DEFAULT applies account globally", async () => {
    const handler = getHandler("git:account:set-default");
    await handler(null, "acc-1");
    expect(gitService.applyAccount).toHaveBeenCalledWith(
      "John Work",
      "john@work.com",
      { signingKey: "", sshKeyPath: "", global: true }
    );
  });
});

describe("parseSshConfig", () => {
  let tmpDir: string;
  const origHome = os.homedir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssh-config-test-"));
    fs.mkdirSync(path.join(tmpDir, ".ssh"), { recursive: true });
    // Override os.homedir to point to our temp dir
    (os as { homedir: () => string }).homedir = () => tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    (os as { homedir: () => string }).homedir = origHome;
  });

  it("returns empty array when no ssh config exists", () => {
    const entries = parseSshConfig();
    expect(entries).toEqual([]);
  });

  it("parses host entries with identity files", () => {
    fs.writeFileSync(path.join(tmpDir, ".ssh", "config"), [
      "Host github-work",
      "  HostName github.com",
      "  User git",
      "  IdentityFile ~/.ssh/id_work",
      "",
      "Host github-personal",
      "  HostName github.com",
      "  User git",
      "  IdentityFile ~/.ssh/id_personal",
    ].join("\n"));

    const entries = parseSshConfig();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.host).toBe("github-work");
    expect(entries[0]!.hostName).toBe("github.com");
    expect(entries[0]!.user).toBe("git");
    expect(entries[0]!.identityFile?.replace(/\\/g, "/")).toBe(path.join(tmpDir, ".ssh", "id_work").replace(/\\/g, "/"));
    expect(entries[1]!.host).toBe("github-personal");
  });

  it("skips wildcard entries and entries without IdentityFile", () => {
    fs.writeFileSync(path.join(tmpDir, ".ssh", "config"), [
      "Host *",
      "  ServerAliveInterval 60",
      "",
      "Host no-key",
      "  HostName example.com",
      "",
      "Host with-key",
      "  HostName example.com",
      "  IdentityFile ~/.ssh/id_example",
    ].join("\n"));

    const entries = parseSshConfig();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.host).toBe("with-key");
  });

  it("handles comments and blank lines", () => {
    fs.writeFileSync(path.join(tmpDir, ".ssh", "config"), [
      "# This is a comment",
      "",
      "Host myserver",
      "  # Another comment",
      "  HostName server.com",
      "  IdentityFile ~/.ssh/id_server",
    ].join("\n"));

    const entries = parseSshConfig();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.host).toBe("myserver");
  });
});
