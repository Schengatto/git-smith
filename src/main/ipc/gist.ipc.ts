import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import type { GistCreateOptions, GistResult } from "../../shared/git-types";

const execFileAsync = promisify(execFile);

export function registerGistHandlers() {
  ipcMain.handle(
    IPC.GIST.CREATE,
    async (_event, options: GistCreateOptions): Promise<GistResult> => {
      const remotes = await gitService.getRemotes();
      const origin = remotes.find((r) => r.name === "origin");
      const url = origin?.fetchUrl || origin?.pushUrl || "";

      // Write content to temp file
      const tmpFile = path.join(os.tmpdir(), options.filename || "gist.txt");
      fs.writeFileSync(tmpFile, options.content, "utf-8");

      try {
        if (url.includes("gitlab")) {
          const args = [
            "snippet",
            "create",
            "--title",
            options.description || options.filename,
            "--filename",
            options.filename,
          ];
          if (options.public) args.push("--visibility", "public");
          else args.push("--visibility", "private");
          args.push(tmpFile);
          const { stdout } = await execFileAsync("glab", args, {
            cwd: gitService.getRepoPath() || undefined,
            timeout: 15000,
          });
          const urlMatch = stdout.match(/(https?:\/\/\S+)/);
          return { url: urlMatch?.[1] || "", id: "" };
        }

        // Default: GitHub
        const args = ["gist", "create", tmpFile, "--desc", options.description || ""];
        if (options.public) args.push("--public");
        const { stdout } = await execFileAsync("gh", args, {
          cwd: gitService.getRepoPath() || undefined,
          timeout: 15000,
        });
        const gistUrl = stdout.trim();
        const idMatch = gistUrl.match(/\/([a-f0-9]+)$/);
        return { url: gistUrl, id: idMatch?.[1] || "" };
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
      }
    }
  );
}
