import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useRepoStore } from "../../store/repo-store";

export const ConsolePanel: React.FC = () => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const repo = useRepoStore((s) => s.repo);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let term: Terminal | null = null;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const init = async () => {
      const container = containerRef.current;
      if (!container || cancelled) return;

      term = new Terminal({
        fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
        fontSize: 13,
        theme: {
          background:
            getComputedStyle(document.documentElement).getPropertyValue("--surface-0").trim() ||
            "#1e1e2e",
          foreground:
            getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() ||
            "#cdd6f4",
          cursor:
            getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
            "#89b4fa",
          selectionBackground:
            getComputedStyle(document.documentElement).getPropertyValue("--selection-bg").trim() ||
            "rgba(137, 180, 250, 0.3)",
        },
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      term.focus();

      // Wait one frame for layout to settle before fitting
      await new Promise((r) => requestAnimationFrame(r));
      if (cancelled) {
        term.dispose();
        return;
      }

      fitAddon.fit();

      // Spawn PTY
      try {
        await window.electronAPI.terminal.spawn(term.cols, term.rows);
      } catch (err) {
        term.write(`\r\n\x1b[31m${t("console.failedToStartShell", { error: err })}\x1b[0m\r\n`);
        return;
      }

      if (cancelled) {
        term.dispose();
        return;
      }

      // PTY output → xterm
      unsubData = window.electronAPI.on.terminalData((data) => {
        term?.write(data);
      });

      unsubExit = window.electronAPI.on.terminalExit(() => {
        term?.write(`\r\n${t("console.processExited")}\r\n`);
      });

      // xterm input → PTY
      onDataDisposable = term.onData((data) => {
        window.electronAPI.terminal.input(data);
      });

      term.focus();

      // Auto-resize on container resize
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (term && !cancelled) {
            fitAddon.fit();
            window.electronAPI.terminal.resize(term.cols, term.rows);
          }
        });
      });
      resizeObserver.observe(container);

      // Focus on click
      container.addEventListener("mousedown", () => term?.focus());
    };

    init();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      unsubData?.();
      unsubExit?.();
      onDataDisposable?.dispose();
      window.electronAPI.terminal.kill();
      term?.dispose();
    };
    // Re-create terminal only when repo path changes; refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.path]);

  return (
    <div className="h-full flex flex-col">
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: 4,
          overflow: "hidden",
        }}
      />
    </div>
  );
};
