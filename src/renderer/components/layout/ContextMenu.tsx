import React, { useEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  color?: string;
  disabled?: boolean;
  divider?: false;
  /** Sub-menu items — when present, hovering shows a nested menu */
  children?: ContextMenuEntry[];
}

export interface ContextMenuDivider {
  divider: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 30 - 20);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: 200,
        minWidth: 180,
        padding: "4px 0",
        borderRadius: 8,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        animation: "dropdown-in 0.1s ease-out",
      }}
    >
      {items.map((entry, i) => {
        if (entry.divider) {
          return (
            <div
              key={`d-${i}`}
              style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }}
            />
          );
        }
        if (entry.children && entry.children.length > 0) {
          return <SubMenuItem key={entry.label} entry={entry} onClose={onClose} />;
        }
        return (
          <button
            key={entry.label}
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onClick?.();
            }}
            style={itemStyle(entry)}
            onMouseEnter={(e) => {
              if (!entry.disabled) e.currentTarget.style.background = "var(--surface-3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {entry.icon && (
              <span style={{ flexShrink: 0, color: "var(--text-muted)" }}>{entry.icon}</span>
            )}
            {entry.label}
          </button>
        );
      })}
      <style>{`
        @keyframes dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const SubMenuItem: React.FC<{
  entry: ContextMenuItem;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const [open, setOpen] = useState(false);
  const itemRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={itemRef}
        disabled={entry.disabled}
        style={{
          ...itemStyle(entry),
          justifyContent: "space-between",
        }}
        onMouseEnter={(e) => {
          if (!entry.disabled) e.currentTarget.style.background = "var(--surface-3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {entry.icon && (
            <span style={{ flexShrink: 0, color: "var(--text-muted)" }}>{entry.icon}</span>
          )}
          {entry.label}
        </span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.5 }}
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      {open && entry.children && (
        <div
          style={{
            position: "absolute",
            left: "100%",
            top: 0,
            zIndex: 201,
            minWidth: 160,
            padding: "4px 0",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {entry.children.map((child, i) => {
            if (child.divider) {
              return (
                <div
                  key={`d-${i}`}
                  style={{ height: 1, margin: "4px 8px", background: "var(--border-subtle)" }}
                />
              );
            }
            return (
              <button
                key={child.label}
                disabled={child.disabled}
                onClick={() => {
                  onClose();
                  child.onClick?.();
                }}
                style={itemStyle(child)}
                onMouseEnter={(e) => {
                  if (!child.disabled) e.currentTarget.style.background = "var(--surface-3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {child.icon && (
                  <span style={{ flexShrink: 0, color: "var(--text-muted)" }}>{child.icon}</span>
                )}
                {child.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function itemStyle(entry: ContextMenuItem): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 12px",
    border: "none",
    background: "transparent",
    color: entry.disabled ? "var(--text-muted)" : entry.color || "var(--text-primary)",
    fontSize: 12,
    textAlign: "left",
    cursor: entry.disabled ? "not-allowed" : "pointer",
    transition: "background 0.1s",
    opacity: entry.disabled ? 0.5 : 1,
  };
}
