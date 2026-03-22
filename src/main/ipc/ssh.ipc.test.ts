import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────
// vi.mock factories are hoisted to top of file; use vi.hoisted() for refs.

const { mockExecFileAsync, fsMock } = vi.hoisted(() => {
  return {
    mockExecFileAsync: vi.fn(),
    fsMock: {
      existsSync: vi.fn(),
      readdirSync: vi.fn(),
      statSync: vi.fn(),
      readFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock("child_process", () => ({ execFile: vi.fn() }));
vi.mock("util", () => ({ promisify: () => mockExecFileAsync }));

vi.mock("fs", () => ({ default: fsMock }));

vi.mock("os", () => ({
  default: { homedir: () => "/home/testuser" },
}));

vi.mock("path", async () => {
  const actual = await vi.importActual<typeof import("path")>("path");
  return { default: actual };
});

// ── Imports ────────────────────────────────────────────────────────────────

import { ipcMain } from "electron";
import { registerSshHandlers } from "./ssh.ipc";
import { IPC } from "../../shared/ipc-channels";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string) {
  const m = vi.mocked(ipcMain.handle);
  const call = m.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`Handler for "${channel}" not registered`);
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SSH IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSshHandlers();
  });

  // ── Channel registration ─────────────────────────────────────────────────

  describe("channel registration", () => {
    it("registers all 4 SSH channels", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain(IPC.SSH.LIST);
      expect(channels).toContain(IPC.SSH.GENERATE);
      expect(channels).toContain(IPC.SSH.GET_PUBLIC);
      expect(channels).toContain(IPC.SSH.TEST);
    });
  });

  // ── SSH.LIST ────────────────────────────────────────────────────────────

  describe("SSH.LIST", () => {
    it("returns empty array when ~/.ssh directory does not exist", async () => {
      fsMock.existsSync.mockReturnValue(false);
      const handler = getHandler(IPC.SSH.LIST);
      const result = await handler({});
      expect(result).toEqual([]);
    });

    it("skips non-file entries (directories)", async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readdirSync.mockReturnValue(["mykey"]);
      fsMock.statSync.mockReturnValue({ isFile: () => false });

      const handler = getHandler(IPC.SSH.LIST);
      const result = await handler({});
      expect(result).toEqual([]);
    });

    it("skips .pub files, config, known_hosts, authorized_keys, known_hosts.old", async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readdirSync.mockReturnValue([
        "id_ed25519.pub",
        "config",
        "known_hosts",
        "authorized_keys",
        "known_hosts.old",
      ]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });

      const handler = getHandler(IPC.SSH.LIST);
      const result = await handler({});
      expect(result).toEqual([]);
    });

    it("returns key info with type and fingerprint when pub key exists", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p.endsWith(".pub")) return true;
        return false;
      });
      fsMock.readdirSync.mockReturnValue(["id_ed25519"]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA user@host");
      mockExecFileAsync.mockResolvedValue({
        stdout: "256 SHA256:abcdefg user@host (ED25519)",
      });

      const handler = getHandler(IPC.SSH.LIST);
      const result = (await handler({})) as Array<{
        name: string;
        type: string;
        fingerprint: string;
        path: string;
        hasPublicKey: boolean;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("id_ed25519");
      expect(result[0]!.type).toBe("ed25519");
      expect(result[0]!.fingerprint).toBe("SHA256:abcdefg");
      expect(result[0]!.hasPublicKey).toBe(true);
    });

    it("handles key without pub file", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p.endsWith(".pub")) return false;
        return true;
      });
      fsMock.readdirSync.mockReturnValue(["mykey"]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });

      const handler = getHandler(IPC.SSH.LIST);
      const result = (await handler({})) as Array<{
        name: string;
        hasPublicKey: boolean;
        type: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("mykey");
      expect(result[0]!.hasPublicKey).toBe(false);
      expect(result[0]!.type).toBe("unknown");
    });

    it("handles ssh-keygen fingerprint failure gracefully", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p.endsWith(".pub")) return true;
        return false;
      });
      fsMock.readdirSync.mockReturnValue(["id_rsa"]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });
      fsMock.readFileSync.mockReturnValue("ssh-rsa AAAA user@host");
      mockExecFileAsync.mockRejectedValue(new Error("ssh-keygen failed"));

      const handler = getHandler(IPC.SSH.LIST);
      const result = (await handler({})) as Array<{ fingerprint: string }>;

      expect(result).toHaveLength(1);
      expect(result[0]!.fingerprint).toBe("");
    });

    it("extracts type by removing 'ssh-' prefix from pub key", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p.endsWith(".pub")) return true;
        return false;
      });
      fsMock.readdirSync.mockReturnValue(["id_rsa"]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });
      fsMock.readFileSync.mockReturnValue("ssh-rsa AAAA user@host");
      mockExecFileAsync.mockResolvedValue({ stdout: "2048 SHA256:xyz user@host (RSA)" });

      const handler = getHandler(IPC.SSH.LIST);
      const result = (await handler({})) as Array<{ type: string }>;
      expect(result[0]!.type).toBe("rsa");
    });

    it("returns multiple keys", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p.endsWith(".pub")) return false;
        return true;
      });
      fsMock.readdirSync.mockReturnValue(["id_ed25519", "id_rsa", "deploy_key"]);
      fsMock.statSync.mockReturnValue({ isFile: () => true });

      const handler = getHandler(IPC.SSH.LIST);
      const result = (await handler({})) as unknown[];
      expect(result).toHaveLength(3);
    });
  });

  // ── SSH.GENERATE ─────────────────────────────────────────────────────────

  describe("SSH.GENERATE", () => {
    it("generates an ed25519 key and returns public key content", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/my_key") return false;
        if (p === "/home/testuser/.ssh/my_key.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA user@host\n");
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      const result = await handler({}, "ed25519", "user@example.com", "", "my_key");

      expect(result).toBe("ssh-ed25519 AAAA user@host\n");
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "ssh-keygen",
        expect.arrayContaining(["-t", "ed25519", "-C", "user@example.com"]),
        expect.any(Object)
      );
    });

    it("adds -b 4096 flag for RSA keys", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/id_rsa") return false;
        if (p === "/home/testuser/.ssh/id_rsa.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-rsa AAAA user\n");
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      await handler({}, "rsa", "user@host", "passphrase", "id_rsa");

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      expect(args).toContain("-b");
      expect(args).toContain("4096");
    });

    it("does NOT add -b 4096 for ed25519 keys", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/mykey") return false;
        if (p === "/home/testuser/.ssh/mykey.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA\n");
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      await handler({}, "ed25519", "", "", "mykey");

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      expect(args).not.toContain("-b");
    });

    it("throws when key file already exists", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/existing_key") return true;
        return false;
      });

      const handler = getHandler(IPC.SSH.GENERATE);
      await expect(
        handler({}, "ed25519", "user@host", "", "existing_key")
      ).rejects.toThrow("Key file already exists: existing_key");
    });

    it("creates ~/.ssh directory if it doesn't exist", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return false;
        if (p === "/home/testuser/.ssh/new_key") return false;
        if (p === "/home/testuser/.ssh/new_key.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA\n");
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      await handler({}, "ed25519", "", "", "new_key");

      expect(fsMock.mkdirSync).toHaveBeenCalledWith("/home/testuser/.ssh", {
        mode: 0o700,
        recursive: true,
      });
    });

    it("throws when stderr includes 'Error'", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/bad_key") return false;
        return false;
      });
      mockExecFileAsync.mockResolvedValue({
        stdout: "",
        stderr: "Error: something went wrong",
      });

      const handler = getHandler(IPC.SSH.GENERATE);
      await expect(handler({}, "ed25519", "", "", "bad_key")).rejects.toThrow(
        "Error: something went wrong"
      );
    });

    it("returns empty string when pub file doesn't exist after generation", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/no_pub_key") return false;
        if (p === "/home/testuser/.ssh/no_pub_key.pub") return false;
        return false;
      });
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      const result = await handler({}, "ed25519", "", "", "no_pub_key");
      expect(result).toBe("");
    });

    it("includes key path and passphrase in args", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh") return true;
        if (p === "/home/testuser/.ssh/mykey2") return false;
        if (p === "/home/testuser/.ssh/mykey2.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA\n");
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.GENERATE);
      await handler({}, "ed25519", "comment", "mypassphrase", "mykey2");

      const args = mockExecFileAsync.mock.calls[0]![1] as string[];
      expect(args).toContain("-f");
      expect(args).toContain("/home/testuser/.ssh/mykey2");
      expect(args).toContain("-N");
      expect(args).toContain("mypassphrase");
    });
  });

  // ── SSH.GET_PUBLIC ────────────────────────────────────────────────────────

  describe("SSH.GET_PUBLIC", () => {
    it("returns public key content when .pub file exists", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh/id_ed25519.pub") return true;
        return false;
      });
      fsMock.readFileSync.mockReturnValue("ssh-ed25519 AAAA user@host\n");

      const handler = getHandler(IPC.SSH.GET_PUBLIC);
      const result = await handler({}, "id_ed25519");
      expect(result).toBe("ssh-ed25519 AAAA user@host\n");
    });

    it("returns empty string when .pub file does not exist but private key exists", async () => {
      fsMock.existsSync.mockImplementation((p: string) => {
        if (p === "/home/testuser/.ssh/id_rsa.pub") return false;
        if (p === "/home/testuser/.ssh/id_rsa") return true;
        return false;
      });

      const handler = getHandler(IPC.SSH.GET_PUBLIC);
      const result = await handler({}, "id_rsa");
      expect(result).toBe("");
    });

    it("returns empty string when neither pub nor private key exists", async () => {
      fsMock.existsSync.mockReturnValue(false);

      const handler = getHandler(IPC.SSH.GET_PUBLIC);
      const result = await handler({}, "missing_key");
      expect(result).toBe("");
    });
  });

  // ── SSH.TEST ──────────────────────────────────────────────────────────────

  describe("SSH.TEST", () => {
    it("returns stdout when connection succeeds", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "Connection successful",
        stderr: "",
      });

      const handler = getHandler(IPC.SSH.TEST);
      const result = await handler({}, "git@github.com");
      expect(result).toBe("Connection successful");
    });

    it("returns stderr when stdout is empty but stderr has content", async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: "",
        stderr: "Hi username! You've authenticated.",
      });

      const handler = getHandler(IPC.SSH.TEST);
      const result = await handler({}, "git@github.com");
      expect(result).toBe("Hi username! You've authenticated.");
    });

    it("returns fallback message when both stdout and stderr are empty", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const handler = getHandler(IPC.SSH.TEST);
      const result = await handler({}, "git@gitlab.com");
      expect(result).toBe("Connection successful");
    });

    it("returns stderr message when it contains 'successfully authenticated'", async () => {
      const authMsg = "Welcome to GitLab, @user! You have successfully authenticated.";
      mockExecFileAsync.mockRejectedValue({ stderr: authMsg });

      const handler = getHandler(IPC.SSH.TEST);
      const result = await handler({}, "git@gitlab.com");
      expect(result).toBe(authMsg);
    });

    it("returns stderr message when it contains 'Hi '", async () => {
      const msg = "Hi octocat! You've successfully authenticated.";
      mockExecFileAsync.mockRejectedValue({ stderr: msg });

      const handler = getHandler(IPC.SSH.TEST);
      const result = await handler({}, "git@github.com");
      expect(result).toBe(msg);
    });

    it("throws error when connection fails with unknown error", async () => {
      mockExecFileAsync.mockRejectedValue({ stderr: "Permission denied (publickey)." });

      const handler = getHandler(IPC.SSH.TEST);
      await expect(handler({}, "git@github.com")).rejects.toThrow(
        "Permission denied (publickey)."
      );
    });

    it("throws error when err has no stderr property (plain Error)", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("Connection timed out"));

      const handler = getHandler(IPC.SSH.TEST);
      await expect(handler({}, "git@example.com")).rejects.toThrow();
    });

    it("calls ssh with StrictHostKeyChecking=accept-new", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "ok", stderr: "" });

      const handler = getHandler(IPC.SSH.TEST);
      await handler({}, "git@github.com");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "ssh",
        ["-T", "-o", "StrictHostKeyChecking=accept-new", "git@github.com"],
        expect.objectContaining({ timeout: 15000 })
      );
    });
  });
});
