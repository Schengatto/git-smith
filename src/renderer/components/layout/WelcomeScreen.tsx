import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRepoStore } from "../../store/repo-store";
import { useUIStore } from "../../store/ui-store";
import logoUrl from "../../../../assets/gitsmith.png";

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const FolderIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 14,
  color = "var(--text-muted)",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const PlusIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const FolderOpenIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1" />
    <path d="M20.5 16H8l-3 3V10h15.5l-2 6z" />
  </svg>
);

const DownloadIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const XIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const TagIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const EditIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ScanIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const CodeIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const HeartIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const BugIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ExternalLinkIcon: React.FC<{ size?: number }> = ({ size = 10 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const SearchIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ChevronIcon: React.FC<{ size?: number; open?: boolean }> = ({ size = 12, open = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Context Menu                                                       */
/* ------------------------------------------------------------------ */
interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  separator?: boolean;
  danger?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const ContextMenu: React.FC<{
  state: ContextMenuState | null;
  onClose: () => void;
}> = ({ state, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!state) {
      setPos(null);
      return;
    }
    // Start off-screen to measure, then adjust
    setPos({ x: state.x, y: state.y });
  }, [state]);

  useEffect(() => {
    if (!pos || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = pos;
    if (x + rect.width > vw) x = Math.max(0, vw - rect.width - 4);
    if (y + rect.height > vh) y = Math.max(0, vh - rect.height - 4);
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [pos]);

  useEffect(() => {
    if (!state) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [state, onClose]);

  if (!state || !pos) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 0",
        minWidth: 200,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      {state.items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && (
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
          )}
          <div
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontSize: 12,
              color: item.danger ? "var(--red)" : "var(--text-primary)",
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {item.icon && <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>}
            {item.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Inline rename input                                                */
/* ------------------------------------------------------------------ */
const InlineInput: React.FC<{
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
}> = ({ initialValue, onConfirm, onCancel, placeholder }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (value.trim()) onConfirm(value.trim());
        else onCancel();
      }}
      placeholder={placeholder}
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--accent)",
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: 12,
        color: "var(--text-primary)",
        outline: "none",
        width: 140,
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Sidebar Action Button                                              */
/* ------------------------------------------------------------------ */
const SidebarAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "8px 16px",
      background: "transparent",
      border: "none",
      color: "var(--text-primary)",
      fontSize: 13,
      cursor: "pointer",
      transition: "background 0.1s",
      textAlign: "left",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <span style={{ display: "flex", color: "var(--accent)" }}>{icon}</span>
    {label}
  </button>
);

/* ------------------------------------------------------------------ */
/*  Repo item in list                                                  */
/* ------------------------------------------------------------------ */
const RepoItem: React.FC<{
  path: string;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ path, onOpen, onContextMenu }) => {
  const name = path.replace(/\\/g, "/").split("/").pop() || path;
  return (
    <div
      onClick={onOpen}
      onContextMenu={onContextMenu}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        cursor: "pointer",
        transition: "background 0.1s",
        borderRadius: 4,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <FolderIcon size={15} color="var(--accent)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{name}</div>
        <div className="mono truncate" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {path}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Section header with collapse + actions                             */
/* ------------------------------------------------------------------ */
const SectionHeader: React.FC<{
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}> = ({ title, count, open, onToggle, actions }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 4px 4px",
      userSelect: "none",
    }}
  >
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        flex: 1,
      }}
    >
      <ChevronIcon open={open} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          borderRadius: 8,
          padding: "1px 6px",
        }}
      >
        {count}
      </span>
    </div>
    {actions}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main WelcomeScreen                                                 */
/* ------------------------------------------------------------------ */
export const WelcomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    openRepo,
    openRepoDialog,
    initRepo,
    recentRepos,
    repoCategories,
    loadRecentRepos,
    removeRecentRepo,
    clearRecentRepos,
    removeMissingRepos,
    setRepoCategory,
    renameCategory,
    deleteCategory,
  } = useRepoStore();

  const { openCloneDialog, openScanDialog } = useUIStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [assigningCategory, setAssigningCategory] = useState<string | null>(null);

  useEffect(() => {
    loadRecentRepos();
  }, [loadRecentRepos]);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // Group repos by category
  const categories = new Set<string>();
  for (const cat of Object.values(repoCategories)) {
    categories.add(cat);
  }

  const filteredRepos = recentRepos.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.toLowerCase().includes(q);
  });

  const uncategorizedRepos = filteredRepos.filter((p) => !repoCategories[p]);
  const categorizedGroups: Record<string, string[]> = {};
  for (const cat of Array.from(categories).sort()) {
    const repos = filteredRepos.filter((p) => repoCategories[p] === cat);
    if (repos.length > 0) categorizedGroups[cat] = repos;
  }

  const allCategoryNames = Array.from(categories).sort();

  const showRepoContextMenu = (e: React.MouseEvent, repoPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentCategory = repoCategories[repoPath] || null;

    const categoryItems: ContextMenuItem[] =
      allCategoryNames.length > 0
        ? allCategoryNames.map((cat) => ({
            label: cat + (currentCategory === cat ? "  \u2713" : ""),
            onClick: () => setRepoCategory(repoPath, currentCategory === cat ? null : cat),
          }))
        : [];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t("welcome.openRepository"),
          icon: <FolderOpenIcon size={14} />,
          onClick: () => openRepo(repoPath),
        },
        {
          label: t("welcome.assignCategory"),
          icon: <TagIcon />,
          separator: true,
          onClick: () => setAssigningCategory(repoPath),
        },
        ...categoryItems,
        ...(currentCategory
          ? [
              {
                label: t("welcome.removeFromCategory"),
                onClick: () => setRepoCategory(repoPath, null),
                separator: categoryItems.length > 0,
              },
            ]
          : []),
        {
          label: t("welcome.removeFromList"),
          icon: <XIcon />,
          separator: true,
          danger: true,
          onClick: () => removeRecentRepo(repoPath),
        },
      ],
    });
  };

  const showCategoryContextMenu = (e: React.MouseEvent, categoryName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t("welcome.renameCategory"),
          icon: <EditIcon />,
          onClick: () => setRenamingCategory(categoryName),
        },
        {
          label: t("welcome.deleteCategory"),
          icon: <TrashIcon />,
          danger: true,
          onClick: () => deleteCategory(categoryName),
        },
      ],
    });
  };

  const showRecentActionsMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t("welcome.removeMissingProjects"),
          icon: <TrashIcon />,
          onClick: async () => {
            const removed = await removeMissingRepos();
            if (removed.length === 0) {
              // All repos are valid, nothing to do
            }
          },
        },
        {
          label: t("welcome.clearAllRecentRepos"),
          icon: <TrashIcon />,
          danger: true,
          separator: true,
          onClick: () => clearRecentRepos(),
        },
      ],
    });
  };

  return (
    <div style={{ height: "100%", display: "flex", userSelect: "none" }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 220,
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-1)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <img
              src={logoUrl}
              alt="GitSmith"
              width="20"
              height="20"
              style={{ objectFit: "contain" }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              GitSmith
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t("welcome.gitGui")}</div>
          </div>
        </div>

        <div style={{ padding: "0 8px" }}>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 0 8px" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <SidebarAction
            icon={<PlusIcon size={15} />}
            label={t("welcome.createNewRepo")}
            onClick={initRepo}
          />
          <SidebarAction
            icon={<FolderOpenIcon size={15} />}
            label={t("welcome.openRepoAction")}
            onClick={openRepoDialog}
          />
          <SidebarAction
            icon={<DownloadIcon size={15} />}
            label={t("welcome.cloneRepoAction")}
            onClick={openCloneDialog}
          />
          <SidebarAction
            icon={<ScanIcon size={15} />}
            label={t("welcome.scanForRepos")}
            onClick={openScanDialog}
          />
        </div>

        {/* Contribute */}
        <div
          style={{
            marginTop: "auto",
            padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            {t("welcome.contribute")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              {
                icon: <CodeIcon size={13} />,
                label: t("welcome.develop"),
                url: "https://github.com/Schengatto/git-smith",
              },
              {
                icon: <HeartIcon size={13} />,
                label: t("welcome.donate"),
                url: "https://www.paypal.com/donate?business=schintu.enrico@gmail.com&currency_code=EUR",
              },
              {
                icon: <BugIcon size={13} />,
                label: t("welcome.issues"),
                url: "https://github.com/Schengatto/git-smith/issues",
              },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => window.electronAPI.repo.openExternal(item.url)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <span style={{ display: "flex", color: "var(--accent)", opacity: 0.7 }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <ExternalLinkIcon />
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard hints */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              <kbd
                style={{
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "var(--surface-2)",
                  fontSize: 10,
                }}
              >
                Ctrl+O
              </kbd>
              <span style={{ marginLeft: 6 }}>{t("welcome.open")}</span>
            </div>
            <div>
              <kbd
                style={{
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "var(--surface-2)",
                  fontSize: 10,
                }}
              >
                Ctrl+N
              </kbd>
              <span style={{ marginLeft: 6 }}>{t("welcome.createNew")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar with search */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              maxWidth: 400,
              background: "var(--surface-2)",
              borderRadius: 6,
              padding: "6px 10px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <SearchIcon size={13} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("welcome.searchRepos")}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            {searchQuery && (
              <div
                onClick={() => setSearchQuery("")}
                style={{ cursor: "pointer", display: "flex", color: "var(--text-muted)" }}
              >
                <XIcon size={12} />
              </div>
            )}
          </div>
        </div>

        {/* Repository lists */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 20px" }}>
          {recentRepos.length === 0 ? (
            /* Empty state */
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                color: "var(--text-muted)",
              }}
            >
              <FolderIcon size={48} color="var(--surface-3)" />
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t("welcome.noRecentRepos")}</div>
              <div style={{ fontSize: 12 }}>{t("welcome.getStartedHint")}</div>
            </div>
          ) : (
            <>
              {/* Recent repositories section */}
              {uncategorizedRepos.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <SectionHeader
                    title={t("welcome.recentRepositories")}
                    count={uncategorizedRepos.length}
                    open={!collapsedSections.has("recent")}
                    onToggle={() => toggleSection("recent")}
                    actions={
                      <div
                        onClick={showRecentActionsMenu}
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--surface-hover)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {t("welcome.actions")}
                      </div>
                    }
                  />
                  {!collapsedSections.has("recent") && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 1,
                      }}
                    >
                      {uncategorizedRepos.map((path) => (
                        <RepoItem
                          key={path}
                          path={path}
                          onOpen={() => openRepo(path)}
                          onContextMenu={(e) => showRepoContextMenu(e, path)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category sections */}
              {Object.entries(categorizedGroups).map(([catName, repos]) => (
                <div key={catName} style={{ marginBottom: 16 }}>
                  <SectionHeader
                    title={
                      renamingCategory === catName
                        ? catName // will be overridden by the inline input below
                        : catName
                    }
                    count={repos.length}
                    open={!collapsedSections.has(catName)}
                    onToggle={() => toggleSection(catName)}
                    actions={
                      <div
                        onClick={(e) => showCategoryContextMenu(e, catName)}
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--surface-hover)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {t("welcome.actions")}
                      </div>
                    }
                  />
                  {renamingCategory === catName && (
                    <div style={{ padding: "4px 12px" }}>
                      <InlineInput
                        initialValue={catName}
                        onConfirm={(newName) => {
                          if (newName !== catName) renameCategory(catName, newName);
                          setRenamingCategory(null);
                        }}
                        onCancel={() => setRenamingCategory(null)}
                        placeholder={t("welcome.categoryName")}
                      />
                    </div>
                  )}
                  {!collapsedSections.has(catName) && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 1,
                      }}
                    >
                      {repos.map((path) => (
                        <RepoItem
                          key={path}
                          path={path}
                          onOpen={() => openRepo(path)}
                          onContextMenu={(e) => showRepoContextMenu(e, path)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* No results from search */}
              {filteredRepos.length === 0 && searchQuery && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  {t("welcome.noReposMatch")} &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Assign category dialog */}
      {assigningCategory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAssigningCategory(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              minWidth: 280,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              {t("welcome.assignCategory")}
            </div>

            {/* Existing categories */}
            {allCategoryNames.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
                {allCategoryNames.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => {
                      setRepoCategory(assigningCategory, cat);
                      setAssigningCategory(null);
                    }}
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      borderRadius: 4,
                      cursor: "pointer",
                      color: "var(--text-primary)",
                      background:
                        repoCategories[assigningCategory] === cat
                          ? "var(--accent-dim)"
                          : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        repoCategories[assigningCategory] === cat
                          ? "var(--accent-dim)"
                          : "var(--surface-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        repoCategories[assigningCategory] === cat
                          ? "var(--accent-dim)"
                          : "transparent")
                    }
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}

            {/* New category */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
              {t("welcome.orCreateNewCategory")}
            </div>
            <InlineInput
              initialValue=""
              onConfirm={(name) => {
                setRepoCategory(assigningCategory, name);
                setAssigningCategory(null);
              }}
              onCancel={() => setAssigningCategory(null)}
              placeholder={t("welcome.newCategoryName")}
            />
          </div>
        </div>
      )}

      {/* Context menu */}
      <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
};
