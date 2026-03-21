import React from "react";
import { useUIStore } from "../../store/ui-store";

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: 16,
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxWidth: 400,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            background: t.type === "error" ? "var(--red-dim)" : "var(--accent-dim)",
            color: t.type === "error" ? "var(--red)" : "var(--accent)",
            border: `1px solid ${t.type === "error" ? "var(--red)" : "var(--accent)"}40`,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
          onClick={() => dismissToast(t.id)}
        >
          <span style={{ flex: 1 }}>{t.text}</span>
          <span style={{ opacity: 0.6 }}>&times;</span>
        </div>
      ))}
    </div>
  );
};
