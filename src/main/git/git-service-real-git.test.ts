import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

// Deliberately does NOT mock simple-git: simple-git >= 4 validates the environment and the
// unsafe-option flags at runtime, which a mock can never exercise.
vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("../store", () => ({
  getSettings: () => ({ gitBinaryPath: "", maxConcurrentGitProcesses: 6 }),
  getPlatformTokenForRepo: vi.fn(),
}));

import { GitService } from "./git-service";

const RISKY_ENV = {
  EDITOR: "vim",
  VISUAL: "vim",
  PAGER: "less",
  GIT_EDITOR: "vim",
  GIT_PAGER: "less",
  GIT_ASKPASS: "/bin/true",
  SSH_ASKPASS: "/bin/true",
  GIT_AUTHOR_NAME: "Ambient Author",
};

describe("GitService with the real simple-git", () => {
  let repo: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "gitpress-real-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "Tester");
    for (const name of ["a", "b", "c"]) {
      fs.writeFileSync(path.join(repo, name), name);
      git("add", ".");
      git("commit", "-q", "-m", name);
    }
    for (const [key, value] of Object.entries(RISKY_ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("opens a repo and runs git even when the user env defines editor/pager/askpass vars", async () => {
    const service = new GitService();
    const info = await service.openRepo(repo);
    expect(info.currentBranch).toBe("main");
  });

  it("builds an env without ambient guarded vars but with the ones it sets itself", () => {
    const env = (
      GitService as unknown as { buildEnv: (key?: string) => Record<string, string> }
    ).buildEnv("/home/u/.ssh/id_ed25519");
    for (const key of Object.keys(RISKY_ENV)) expect(env).not.toHaveProperty(key);
    expect(env.PATH ?? env.Path).toBeDefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    expect(env.GIT_SSH_COMMAND).toContain('-i "/home/u/.ssh/id_ed25519"');
  });

  // Skipped on Windows: the editor script path is handed to git unquoted with backslashes, so
  // the shell strips them ("command not found"). Pre-existing, independent of simple-git.
  it.skipIf(process.platform === "win32")(
    "runs an interactive rebase via GIT_SEQUENCE_EDITOR",
    async () => {
      const run = (...args: string[]) =>
        execFileSync("git", args, { cwd: repo, stdio: "pipe", encoding: "utf8" }).trim();
      const [c, b, a] = run("log", "--format=%H").split("\n") as [string, string, string];
      const service = new GitService();
      await service.openRepo(repo);

      // swap the two commits above `a`: b should now come after c
      await service.interactiveRebase(a, [
        { action: "pick", hash: c },
        { action: "pick", hash: b },
      ]);

      expect(run("log", "--format=%s")).toBe("b\nc\na");
    }
  );

  it("lists remote branches of a local repo through the real client", async () => {
    const service = new GitService();
    const branches = await service.listRemoteBranches(repo);
    expect(branches).toContain("main");
  });
});
