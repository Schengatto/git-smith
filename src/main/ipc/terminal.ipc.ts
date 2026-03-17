import { ipcMain, BrowserWindow } from "electron";
import os from "os";
import fs from "fs";
import { IPC } from "../../shared/ipc-channels";
import { gitService } from "../git/git-service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pty = require("node-pty");

type IPty = {
  pid: number;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

let activePty: IPty | null = null;

function getShell(): { command: string; args: string[] } {
  if (os.platform() === "win32") {
    // Prefer Git Bash on Windows for a better git experience
    const gitBashPaths = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    for (const p of gitBashPaths) {
      if (fs.existsSync(p)) {
        return { command: p, args: ["--login"] };
      }
    }
    return { command: "cmd.exe", args: [] };
  }
  const shell = process.env.SHELL || "/bin/bash";
  return { command: shell, args: [] };
}

export function registerTerminalHandlers() {
  ipcMain.handle(IPC.TERMINAL.SPAWN, (event, cols: number, rows: number) => {
    // Kill existing PTY if any
    killTerminal();

    const cwd = gitService.getRepoPath() || os.homedir();
    const { command, args } = getShell();
    const win = BrowserWindow.fromWebContents(event.sender);

    const ptyProcess: IPty = pty.spawn(command, args, {
      name: "xterm-256color",
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: { ...process.env, TERM: "xterm-256color" },
    });

    activePty = ptyProcess;

    ptyProcess.onData((data: string) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.EVENTS.TERMINAL_DATA, data);
      }
    });

    ptyProcess.onExit((e: { exitCode: number }) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.EVENTS.TERMINAL_EXIT, e.exitCode);
      }
      if (activePty === ptyProcess) {
        activePty = null;
      }
    });

    return ptyProcess.pid;
  });

  ipcMain.handle(IPC.TERMINAL.INPUT, (_event, data: string) => {
    if (activePty) {
      activePty.write(data);
    }
  });

  ipcMain.handle(IPC.TERMINAL.RESIZE, (_event, cols: number, rows: number) => {
    if (activePty) {
      activePty.resize(cols, rows);
    }
  });

  ipcMain.handle(IPC.TERMINAL.KILL, () => {
    killTerminal();
  });
}

export function killTerminal() {
  if (activePty) {
    try { activePty.kill(); } catch { /* ignore */ }
    activePty = null;
  }
}
