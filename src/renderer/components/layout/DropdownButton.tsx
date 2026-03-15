import React, { useState, useRef, useEffect } from "react";

export interface DropdownItem {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  divider?: false;
}

export interface DropdownDivider {
  divider: true;
}

export type DropdownEntry = DropdownItem | DropdownDivider;

interface Props {
  icon: React.ReactNode;
  label: string;
  items: DropdownEntry[];
  className?: string;
}

export const DropdownButton: React.FC<Props> = ({
  icon,
  label,
  items,
  className = "toolbar-btn",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={className}
        onClick={() => setOpen((v) => !v)}
        style={
          open
            ? { background: "var(--surface-3)", color: "var(--text-primary)" }
            : undefined
        }
      >
        {icon}
        {label}
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          style={{
            marginLeft: 2,
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 220,
            padding: "4px 0",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
            animation: "dropdown-in 0.12s ease-out",
          }}
        >
          {items.map((entry, i) => {
            if (entry.divider) {
              return (
                <div
                  key={`div-${i}`}
                  style={{
                    height: 1,
                    margin: "4px 8px",
                    background: "var(--border-subtle)",
                  }}
                />
              );
            }
            return (
              <button
                key={entry.label}
                onClick={() => {
                  setOpen(false);
                  entry.onClick();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 12px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.1s ease",
                  borderRadius: 0,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-3)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {entry.icon && (
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                    {entry.icon}
                  </span>
                )}
                <span className="flex flex-col min-w-0">
                  <span>{entry.label}</span>
                  {entry.sublabel && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        lineHeight: 1.3,
                      }}
                    >
                      {entry.sublabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
