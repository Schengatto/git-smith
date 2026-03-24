import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface FileContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  onClose: () => void;
  onHistory: (path: string) => void;
  onBlame?: (path: string) => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  filePath,
  onClose,
  onHistory,
  onBlame,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      if (rect.right > window.innerWidth) newX = window.innerWidth - rect.width - 8;
      if (rect.bottom > window.innerHeight) newY = window.innerHeight - rect.height - 8;
      if (newX < 0) newX = 8;
      if (newY < 0) newY = 8;
      if (newX !== x || newY !== y) setPos({ x: newX, y: newY });
    }
  }, [x, y]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const [editorLabel, setEditorLabel] = useState<string>("");

  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      if (s.editorName && s.editorPath) {
        const presets: Record<string, string> = {
          vscode: "VS Code",
          "vscode-insiders": "VS Code Insiders",
          cursor: "Cursor",
          custom: "Editor",
        };
        setEditorLabel(presets[s.editorName] || s.editorName);
      }
    });
  }, []);

  const fileName = filePath.includes("/")
    ? filePath.slice(filePath.lastIndexOf("/") + 1)
    : filePath;

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 14px",
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    transition: "background 0.08s",
  };

  const separator = (
    <div style={{ height: 1, background: "var(--border-subtle)", margin: "3px 0" }} />
  );

  const handleItemHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "var(--surface-hover)";
  };
  const handleItemLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 200,
        minWidth: 200,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {/* File history */}
      <button
        style={menuItemStyle}
        onClick={() => {
          onHistory(filePath);
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconHistory size={13} /> {t("fileContextMenu.fileHistory")}
      </button>

      {/* Blame */}
      {onBlame && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onBlame(filePath);
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconBlame size={13} /> {t("fileContextMenu.blame")}
        </button>
      )}

      {separator}

      {/* Open file */}
      <button
        style={menuItemStyle}
        onClick={() => {
          window.electronAPI.shell.openFile(filePath).catch(() => {});
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconOpenFile size={13} /> {t("fileContextMenu.openFile")}
      </button>
      <button
        style={menuItemStyle}
        onClick={() => {
          window.electronAPI.shell.showInFolder(filePath).catch(() => {});
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconFolder size={13} /> {t("fileContextMenu.showInFolder")}
      </button>
      {editorLabel && (
        <button
          style={menuItemStyle}
          onClick={() => {
            window.electronAPI.editor.launchFile(filePath).catch(() => {});
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconCode size={13} /> {t("fileContextMenu.openInEditor", { editorName: editorLabel })}
        </button>
      )}

      {separator}

      {/* Copy actions */}
      <button
        style={menuItemStyle}
        onClick={() => {
          navigator.clipboard.writeText(filePath).catch(() => {});
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconCopy size={13} /> {t("fileContextMenu.copyPath")}
      </button>
      <button
        style={menuItemStyle}
        onClick={() => {
          navigator.clipboard.writeText(fileName).catch(() => {});
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconCopy size={13} /> {t("fileContextMenu.copyFileName")}
      </button>
    </div>
  );
};

/* ── Icons ── */

const IconHistory: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconBlame: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconOpenFile: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const IconFolder: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconCode: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconCopy: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
