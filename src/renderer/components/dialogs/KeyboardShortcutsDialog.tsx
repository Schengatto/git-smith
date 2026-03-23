import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";

interface ShortcutEntry {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  // Navigation
  { keys: "Ctrl+Shift+P", description: "Command Palette", category: "Navigation" },
  { keys: "Ctrl+F", description: "Search commits in graph", category: "Navigation" },
  { keys: "Escape", description: "Close dialog / Clear search", category: "Navigation" },
  { keys: "?", description: "Keyboard Shortcuts", category: "Navigation" },

  // Git Operations
  { keys: "Ctrl+K", description: "Open Commit Dialog", category: "Git Operations" },
  { keys: "Ctrl+Enter", description: "Commit (in commit dialog)", category: "Git Operations" },
  { keys: "Ctrl+Shift+K", description: "Push", category: "Git Operations" },
  { keys: "F5", description: "Refresh", category: "Git Operations" },

  // View
  { keys: "Ctrl+Shift+D", description: "Toggle diff format (unified/split)", category: "View" },

  // Tools
  { keys: "Ctrl+Shift+P → Bisect", description: "Git Bisect", category: "Tools" },
  { keys: "Ctrl+Shift+P → Worktrees", description: "Manage Worktrees", category: "Tools" },
  { keys: "Ctrl+Shift+P → Submodules", description: "Manage Submodules", category: "Tools" },
  { keys: "Ctrl+Shift+P → LFS", description: "Git LFS", category: "Tools" },
  { keys: "Ctrl+Shift+P → PRs", description: "Pull Requests / Merge Requests", category: "Tools" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? SHORTCUTS.filter(
        (s) =>
          s.description.toLowerCase().includes(filter.toLowerCase()) ||
          s.keys.toLowerCase().includes(filter.toLowerCase()) ||
          s.category.toLowerCase().includes(filter.toLowerCase())
      )
    : SHORTCUTS;

  const categories = [...new Set(filtered.map((s) => s.category))];

  return (
    <ModalDialog open={open} title={t("shortcuts.title")} onClose={onClose} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("shortcuts.filterPlaceholder")}
          autoFocus
          style={{
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
          }}
        />

        {categories.map((cat) => (
          <div key={cat}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              {cat}
            </div>
            {filtered
              .filter((s) => s.category === cat)
              .map((s) => (
                <div
                  key={s.keys + s.description}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "5px 8px",
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                    {s.description}
                  </span>
                  <kbd
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--surface-0)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.keys}
                  </kbd>
                </div>
              ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div
            style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}
          >
            {t("shortcuts.noShortcutsMatch")}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
        <button
          className="toolbar-btn"
          onClick={onClose}
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          {t("dialogs.close")}
        </button>
      </div>
    </ModalDialog>
  );
};
