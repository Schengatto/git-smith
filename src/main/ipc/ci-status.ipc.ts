import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { execFile } from "child_process";
import { promisify } from "util";
import type { CIStatus } from "../../shared/git-types";

const execFileAsync = promisify(execFile);

async function detectProvider(): Promise<"github" | "gitlab" | "unknown"> {
  try {
    const remotes = await gitService.getRemotes();
    const origin = remotes.find((r) => r.name === "origin");
    if (!origin) return "unknown";
    const url = origin.fetchUrl || origin.pushUrl || "";
    if (url.includes("github.com")) return "github";
    if (url.includes("gitlab")) return "gitlab";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function getGitHubStatus(sha: string): Promise<CIStatus[]> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "run",
        "list",
        "--commit",
        sha,
        "--json",
        "name,status,conclusion,url,startedAt",
        "--limit",
        "10",
      ],
      { cwd: gitService.getRepoPath() || undefined, timeout: 15000 }
    );
    const runs = JSON.parse(stdout || "[]");
    return runs.map(
      (r: {
        name: string;
        status: string;
        conclusion: string;
        url: string;
        startedAt: string;
      }) => {
        let status: CIStatus["status"] = "unknown";
        if (r.status === "completed")
          status = r.conclusion === "success" ? "success" : "failure";
        else if (r.status === "in_progress") status = "running";
        else if (r.status === "queued" || r.status === "waiting") status = "pending";
        return {
          sha,
          status,
          name: r.name,
          url: r.url,
          conclusion: r.conclusion || "",
          startedAt: r.startedAt || "",
        };
      }
    );
  } catch {
    return [];
  }
}

async function getGitLabStatus(sha: string): Promise<CIStatus[]> {
  try {
    const { stdout } = await execFileAsync(
      "glab",
      ["ci", "list", "--output-format", "json"],
      { cwd: gitService.getRepoPath() || undefined, timeout: 15000 }
    );
    const pipelines = JSON.parse(stdout || "[]");
    return pipelines
      .filter((p: { sha: string }) => p.sha?.startsWith(sha))
      .slice(0, 10)
      .map((p: { sha: string; status: string; web_url: string; created_at: string }) => ({
        sha,
        status:
          p.status === "success"
            ? "success"
            : p.status === "failed"
              ? "failure"
              : p.status === "running"
                ? "running"
                : "pending",
        name: "Pipeline",
        url: p.web_url || "",
        conclusion: p.status || "",
        startedAt: p.created_at || "",
      }));
  } catch {
    return [];
  }
}

export function registerCIStatusHandlers() {
  ipcMain.handle(IPC.CI.STATUS, async (_event, sha: string): Promise<CIStatus[]> => {
    const provider = await detectProvider();
    if (provider === "github") return getGitHubStatus(sha);
    if (provider === "gitlab") return getGitLabStatus(sha);
    return [];
  });
}
