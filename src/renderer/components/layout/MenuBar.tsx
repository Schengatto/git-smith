import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  children?: MenuItem[];
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

const submenuArrowStyle: React.CSSProperties = {
  fontSize: 10,
  marginLeft: "auto",
  color: "var(--text-muted)",
};

const submenuContainerStyle: React.CSSProperties = {
  position: "absolute",
  left: "100%",
  top: -4,
  minWidth: 220,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  padding: "4px 0",
  zIndex: 1000,
};

const MenuItemRow: React.FC<{
  item: MenuItemDef;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const [hovered, setHovered] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        style={{
          ...menuItemStyle,
          ...(hovered && !item.disabled ? menuItemHoverStyle : {}),
          ...(item.disabled ? menuItemDisabledStyle : {}),
        }}
        onClick={() => {
          if (item.disabled || hasChildren) return;
          item.onClick?.();
          onClose();
        }}
        disabled={item.disabled}
      >
        <span>{item.label}</span>
        {item.shortcut && <span style={shortcutStyle}>{item.shortcut}</span>}
        {hasChildren && <span style={submenuArrowStyle}>&#9654;</span>}
      </button>
      {hasChildren && hovered && (
        <div style={submenuContainerStyle}>
          {item.children!.map((child, i) =>
            "divider" in child && child.divider ? (
              <div key={`divider-${i}`} style={dividerStyle} />
            ) : (
              <MenuItemRow
                key={(child as MenuItemDef).label}
                item={child as MenuItemDef}
                onClose={onClose}
              />
            )
          )}
        </div>
      )}
    </div>
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
        <div key={`divider-${i}`} style={dividerStyle} />
      ) : (
        <MenuItemRow
          key={(item as MenuItemDef).label}
          item={item as MenuItemDef}
          onClose={onClose}
        />
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
  onOpenGitignore: () => void;
  onOpenGrep: () => void;
  onOpenBranchDiff: () => void;
  onOpenBranchCompare: () => void;
  onOpenHooks: () => void;
  onOpenUndo: () => void;
  onOpenCIStatus: () => void;
  onOpenGist: () => void;
  onOpenAdvancedStats: () => void;
  onOpenSsh: () => void;
  onResetLayout: () => void;
}> = ({
  onOpenClone,
  onOpenSettings,
  onOpenScan,
  onOpenAbout,
  onOpenStaleBranches,
  onOpenGitignore,
  onOpenGrep,
  onOpenBranchDiff,
  onOpenBranchCompare,
  onOpenHooks,
  onOpenUndo,
  onOpenCIStatus,
  onOpenGist,
  onOpenAdvancedStats,
  onOpenSsh,
  onResetLayout,
}) => {
  const { t } = useTranslation();
  const { repo, openRepoDialog, initRepo, recentRepos, repoCategories, openRepo } = useRepoStore();
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

  // Build "Favorite repositories" submenu grouped by category
  const categoryNames = [...new Set(Object.values(repoCategories))].sort();
  const favoriteItems: MenuItem[] = categoryNames.flatMap((cat, i) => {
    const reposInCat = recentRepos.filter((r) => repoCategories[r] === cat);
    if (reposInCat.length === 0) return [];
    const catItem: MenuItemDef = {
      label: cat,
      children: reposInCat.map((r) => ({
        label: r.split(/[\\/]/).pop() || r,
        onClick: () => openRepo(r),
      })),
    };
    return i > 0 ? [{ divider: true } as MenuDivider, catItem] : [catItem];
  });

  // Build "Recent repositories" submenu (last 10 repos, regardless of category)
  const recentItems: MenuItem[] = recentRepos.slice(0, 10).map((r) => ({
    label: r.split(/[\\/]/).pop() || r,
    onClick: () => openRepo(r),
  }));

  const menus: MenuDef[] = [
    {
      label: t("menu.start"),
      items: [
        {
          label: t("menu.createRepo"),
          onClick: () => initRepo(),
        },
        {
          label: t("menu.openRepo"),
          shortcut: "Ctrl+O",
          onClick: () => openRepoDialog(),
        },
        { divider: true },
        {
          label: t("menu.favoriteRepos"),
          disabled: favoriteItems.length === 0,
          children: favoriteItems,
        },
        {
          label: t("menu.recentRepos"),
          disabled: recentItems.length === 0,
          children: recentItems,
        },
        { divider: true },
        {
          label: t("menu.cloneRepo"),
          onClick: () => onOpenClone(),
        },
        {
          label: t("menu.scanRepos"),
          onClick: () => onOpenScan(),
        },
        { divider: true },
        {
          label: t("menu.exit"),
          shortcut: "Ctrl+Q",
          onClick: () => window.close(),
        },
      ],
    },
    {
      label: t("menu.dashboard"),
      items: [
        {
          label: t("menu.refresh"),
          shortcut: "F5",
          disabled: !hasRepo,
          onClick: () => {
            if (hasRepo) {
              useRepoStore.getState().refreshStatus();
              useRepoStore.getState().refreshInfo();
            }
          },
        },
        { divider: true },
        {
          label: t("menu.resetLayout"),
          disabled: !hasRepo,
          onClick: () => onResetLayout(),
        },
      ],
    },
    {
      label: t("menu.tools"),
      items: [
        {
          label: t("menu.gitBash"),
          shortcut: "Ctrl+G",
          disabled: !hasRepo,
          onClick: () => {
            if (hasRepo) {
              window.electronAPI.repo.openExternal(`git-bash --cd="${repo!.path}"`);
            }
          },
        },
        { divider: true },
        {
          label: t("menu.staleBranches"),
          disabled: !hasRepo,
          onClick: () => onOpenStaleBranches(),
        },
        {
          label: t("menu.gitignoreEditor"),
          disabled: !hasRepo,
          onClick: () => onOpenGitignore(),
        },
        {
          label: t("menu.codeSearch"),
          shortcut: "Ctrl+Shift+F",
          disabled: !hasRepo,
          onClick: () => onOpenGrep(),
        },
        {
          label: t("menu.branchDiff"),
          disabled: !hasRepo,
          onClick: () => onOpenBranchDiff(),
        },
        {
          label: t("menu.branchCompare"),
          disabled: !hasRepo,
          onClick: () => onOpenBranchCompare(),
        },
        {
          label: t("menu.gitHooks"),
          disabled: !hasRepo,
          onClick: () => onOpenHooks(),
        },
        {
          label: t("menu.undoOps"),
          shortcut: "Ctrl+Z",
          disabled: !hasRepo,
          onClick: () => onOpenUndo(),
        },
        {
          label: t("menu.cicdStatus"),
          disabled: !hasRepo,
          onClick: () => onOpenCIStatus(),
        },
        {
          label: t("menu.createGist"),
          disabled: !hasRepo,
          onClick: () => onOpenGist(),
        },
        {
          label: t("menu.advancedStats"),
          disabled: !hasRepo,
          onClick: () => onOpenAdvancedStats(),
        },
        {
          label: t("menu.sshKeyManager"),
          onClick: () => onOpenSsh(),
        },
        {
          label: t("menu.gitReflog"),
          disabled: !hasRepo,
          onClick: () => window.dispatchEvent(new CustomEvent("command-palette:open-reflog")),
        },
        { divider: true },
        {
          label: t("menu.settingsMenu"),
          shortcut: "Ctrl+,",
          onClick: () => onOpenSettings(),
        },
        { divider: true },
        {
          label: t("menu.commandPalette"),
          shortcut: "Ctrl+Shift+P",
          onClick: () =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "P",
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
              })
            ),
        },
      ],
    },
    {
      label: t("menu.help"),
      items: [
        {
          label: t("menu.userManual"),
          onClick: () => window.electronAPI.app.openUserManual(),
        },
        { divider: true },
        {
          label: t("menu.reportIssue"),
          onClick: () =>
            window.electronAPI.repo.openExternal(
              "https://github.com/Schengatto/git-expansion/issues"
            ),
        },
        {
          label: t("menu.checkUpdates"),
          onClick: () => window.electronAPI.app.checkForUpdates(),
        },
        { divider: true },
        {
          label: t("menu.aboutGitSmith"),
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
          {openMenuIdx === idx && <MenuDropdown items={menu.items} onClose={handleClose} />}
        </div>
      ))}
    </div>
  );
};
