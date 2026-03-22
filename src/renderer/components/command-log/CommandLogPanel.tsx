import React from "react";
import { useCommandLogStore } from "../../store/command-log-store";

const IconTerminal = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.4 }}
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const CommandLogPanel: React.FC = () => {
  const { entries, clear } = useCommandLogStore();

  return (
    <div className="h-full flex flex-col">
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconTerminal />
          </div>
          <span>Git commands will appear here</span>
        </div>
      ) : (
        <>
          <div
            className="flex items-center justify-between px-3 shrink-0"
            style={{
              height: 28,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
              }}
            >
              Commands ({entries.length})
            </span>
            <button
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              onClick={clear}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto mono" style={{ fontSize: 11 }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: "3px 12px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: entry.error ? "var(--red-dim)" : "transparent",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>{" "}
                <span style={{ color: "var(--accent)" }}>$</span>{" "}
                <span style={{ color: "var(--text-primary)" }}>{entry.command}</span>{" "}
                <span style={{ color: "var(--text-secondary)" }}>{entry.args.join(" ")}</span>
                {entry.duration !== undefined && (
                  <span
                    style={{
                      color: "var(--text-muted)",
                      marginLeft: 8,
                      fontSize: 10,
                    }}
                  >
                    {entry.duration}ms
                  </span>
                )}
                {entry.error && (
                  <div style={{ color: "var(--red)", marginLeft: 16, marginTop: 2 }}>
                    {entry.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
