import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { execFile } from "child_process";
import { promisify } from "util";
import type { IssueInfo } from "../../shared/git-types";

const execFileAsync = promisify(execFile);

export function registerIssuesHandlers() {
  ipcMain.handle(
    IPC.ISSUES.RESOLVE,
    async (_event, issueRef: string): Promise<IssueInfo | null> => {
      const match = issueRef.match(/(\d+)/);
      if (!match) return null;
      const number = parseInt(match[1]!, 10);

      try {
        const remotes = await gitService.getRemotes();
        const origin = remotes.find((r) => r.name === "origin");
        const url = origin?.fetchUrl || origin?.pushUrl || "";

        if (url.includes("github.com")) {
          const { stdout } = await execFileAsync(
            "gh",
            ["issue", "view", String(number), "--json", "number,title,state,url"],
            { cwd: gitService.getRepoPath() || undefined, timeout: 10000 }
          );
          const data = JSON.parse(stdout);
          return {
            number: data.number,
            title: data.title,
            state: data.state?.toLowerCase() === "open" ? "open" : "closed",
            url: data.url,
          };
        }

        if (url.includes("gitlab")) {
          const { stdout } = await execFileAsync(
            "glab",
            ["issue", "view", String(number), "--output", "json"],
            { cwd: gitService.getRepoPath() || undefined, timeout: 10000 }
          );
          const data = JSON.parse(stdout);
          return {
            number: data.iid || number,
            title: data.title || "",
            state: data.state === "opened" ? "open" : "closed",
            url: data.web_url || "",
          };
        }

        return null;
      } catch {
        return null;
      }
    }
  );
}
