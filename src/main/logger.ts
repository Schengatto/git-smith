import { app } from "electron";
import fs from "fs";
import path from "path";

const MAX_LOG_SIZE = 1024 * 1024; // 1 MB

let logFilePath: string | null = null;

function getLogFilePath(): string {
  if (!logFilePath) {
    logFilePath = path.join(app.getPath("userData"), "errors.txt");
  }
  return logFilePath;
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function writeToLog(...args: unknown[]): void {
  try {
    const filePath = getLogFilePath();

    // Rotate if file exceeds max size
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_LOG_SIZE) {
        fs.truncateSync(filePath, 0);
      }
    } catch {
      // File doesn't exist yet, that's fine
    }

    const message = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
      .join(" ");
    const line = `[${formatTimestamp()}] ${message}\n`;
    fs.appendFileSync(filePath, line, "utf-8");
  } catch {
    // Silently fail — we can't log errors about logging
  }
}

export function initLogger(): void {
  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    writeToLog(...args);
  };

  process.on("uncaughtException", (err) => {
    writeToLog("[UNCAUGHT EXCEPTION]", err.stack || err.message);
  });

  process.on("unhandledRejection", (reason) => {
    writeToLog(
      "[UNHANDLED REJECTION]",
      reason instanceof Error ? reason.stack || reason.message : String(reason)
    );
  });
}

export function getErrorLogPath(): string {
  return getLogFilePath();
}
