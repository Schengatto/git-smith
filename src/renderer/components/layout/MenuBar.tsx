import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRepoStore } from "../../store/repo-store";


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MenuItemDef {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: false;
}

interface MenuDivider {
  divider: true;
}

type MenuItem = MenuItemDef | MenuDivider;

interface MenuDef {
  label: string;
  items: MenuItem[];
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const menuBarStyle: React.CSSProperties = {
  height: 28,
  display: "flex",
  alignItems: "center",
  background: "var(--surface-1)",
  borderBottom: "1px solid var(--border-subtle)",
  paddingLeft: 4,
  userSelect: "none",
  fontSize: 12,
  position: "relative",
  zIndex: 50,
};

const menuTriggerStyle: React.CSSProperties = {
  padding: "2px 10px",
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: "22px",
  fontFamily: "inherit",
};

const menuTriggerActiveStyle: React.CSSProperties = {
  ...menuTriggerStyle,
  background: "var(--surface-3)",
  color: "var(--text-primary)",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: 27,
  left: 0,
  minWidth: 220,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  padding: "4px 0",
  zIndex: 999,
};

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "5px 12px",
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  fontFamily: "inherit",
  gap: 24,
};

const menuItemHoverStyle: React.CSSProperties = {
  background: "var(--accent-dim)",
  color: "var(--text-primary)",
};

const menuItemDisabledStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: "default",
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: "var(--border-subtle)",
  margin: "4px 8px",
};

const shortcutStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginLeft: "auto",
};

/* ------------------------------------------------------------------ */
/*  MenuItemRow                                                        */
/* ------------------------------------------------------------------ */

const MenuItemRow: React.FC<{
  item: MenuItemDef;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        ...menuItemStyle,
        ...(hovered && !item.disabled ? menuItemHoverStyle : {}),
        ...(item.disabled ? menuItemDisabledStyle : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (item.disabled) return;
        item.onClick?.();
        onClose();
      }}
      disabled={item.disabled}
    >
      <span>{item.label}</span>
      {item.shortcut && <span style={shortcutStyle}>{item.shortcut}</span>}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  MenuDropdown                                                       */
/* ------------------------------------------------------------------ */

const MenuDropdown: React.FC<{
  items: MenuItem[];
  onClose: () => void;
}> = ({ items, onClose }) => (
  <div style={dropdownStyle}>
    {items.map((item, i) =>
      "divider" in item && item.divider ? (
        <div key={i} style={dividerStyle} />
      ) : (
        <MenuItemRow key={i} item={item as MenuItemDef} onClose={onClose} />
      )
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/*  MenuBar                                                            */
/* ------------------------------------------------------------------ */

export const MenuBar: React.FC<{
  onOpenClone: () => void;
  onOpenSettings: () => void;
  onOpenScan: () => void;
  onOpenAbout: () => void;
  onOpenStaleBranches: () => void;
}> = ({ onOpenClone, onOpenSettings, onOpenScan, onOpenAbout, onOpenStaleBranches }) => {
  const { repo, openRepoDialog, initRepo } = useRepoStore();
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setOpenMenuIdx(null), []);

  // Close on click outside
  useEffect(() => {
    if (openMenuIdx === null) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuIdx, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (openMenuIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openMenuIdx, handleClose]);

  const hasRepo = !!repo;

  const menus: MenuDef[] = [
    {
      label: "Start",
      items: [
        {
          label: "Create new repository...",
          onClick: () => initRepo(),
        },
        {
          label: "Open repository...",
          shortcut: "Ctrl+O",
          onClick: () => openRepoDialog(),
        },
        { divider: true },
        {
          label: "Clone repository...",
          onClick: () => onOpenClone(),
        },
        {
          label: "Scan for repositories...",
          onClick: () => onOpenScan(),
        },
        { divider: true },
        {
          label: "Exit",
          shortcut: "Ctrl+Q",
          onClick: () => window.close(),
        },
      ],
    },
    {
      label: "Dashboard",
      items: [
        {
          label: "Refresh",
          shortcut: "F5",
          disabled: !hasRepo,
          onClick: () => {
            if (hasRepo) {
              useRepoStore.getState().refreshStatus();
              useRepoStore.getState().refreshInfo();
            }
          },
        },
      ],
    },
    {
      label: "Tools",
      items: [
        {
          label: "Git bash",
          shortcut: "Ctrl+G",
          disabled: !hasRepo,
          onClick: () => {
            if (hasRepo) {
              window.electronAPI.repo.openExternal(
                `git-bash --cd="${repo!.path}"`
              );
            }
          },
        },
        { divider: true },
        {
          label: "Stale remote branches...",
          disabled: !hasRepo,
          onClick: () => onOpenStaleBranches(),
        },
        { divider: true },
        {
          label: "Settings...",
          shortcut: "Ctrl+,",
          onClick: () => onOpenSettings(),
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "User manual",
          onClick: () =>
            window.electronAPI.repo.openExternal(
              "https://github.com/Schengatto/git-expansion/wiki"
            ),
        },
        {
          label: "Changelog",
          onClick: () =>
            window.electronAPI.repo.openExternal(
              "https://github.com/nicenemo/git-expansion/releases"
            ),
        },
        { divider: true },
        {
          label: "Donate",
          onClick: () =>
            window.electronAPI.repo.openExternal(
              "https://www.paypal.com/donate"
            ),
        },
        { divider: true },
        {
          label: "Report an issue",
          onClick: () =>
            window.electronAPI.repo.openExternal(
              "https://github.com/Schengatto/git-expansion/issues"
            ),
        },
        {
          label: "Check for updates...",
          onClick: () => window.electronAPI.app.checkForUpdates(),
        },
        { divider: true },
        {
          label: "About Git Expansion",
          onClick: () => onOpenAbout(),
        },
      ],
    },
  ];

  return (
    <div ref={barRef} style={menuBarStyle}>
      {menus.map((menu, idx) => (
        <div key={menu.label} style={{ position: "relative" }}>
          <button
            style={openMenuIdx === idx ? menuTriggerActiveStyle : menuTriggerStyle}
            onMouseDown={() => {
              setOpenMenuIdx(openMenuIdx === idx ? null : idx);
            }}
            onMouseEnter={() => {
              if (openMenuIdx !== null && openMenuIdx !== idx) {
                setOpenMenuIdx(idx);
              }
            }}
          >
            {menu.label}
          </button>
          {openMenuIdx === idx && (
            <MenuDropdown items={menu.items} onClose={handleClose} />
          )}
        </div>
      ))}
    </div>
  );
};
