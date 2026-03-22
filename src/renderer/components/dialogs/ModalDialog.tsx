import React from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export const ModalDialog: React.FC<Props> = ({ open, title, onClose, children, width = 420 }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        animation: "fade-in 0.12s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width,
          maxWidth: "90vw",
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          animation: "modal-in 0.15s ease-out",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              display: "flex",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <svg
              width="14"
              height="14"
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
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 16 }}>{children}</div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* Shared styled components for dialogs */

export const DialogInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
> = ({ label, ...props }) => (
  <div style={{ marginBottom: 12 }}>
    <label
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-muted)",
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </label>
    <input
      {...props}
      style={{
        width: "100%",
        padding: "7px 10px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--surface-0)",
        color: "var(--text-primary)",
        fontSize: 13,
        outline: "none",
        transition: "border-color 0.15s",
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        props.onBlur?.(e);
      }}
    />
  </div>
);

export const DialogActions: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor?: string;
  disabled?: boolean;
  loading?: boolean;
}> = ({ onCancel, onConfirm, confirmLabel, confirmColor = "var(--accent)", disabled, loading }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
    <button
      onClick={onCancel}
      style={{
        padding: "7px 16px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      Cancel
    </button>
    <button
      onClick={onConfirm}
      disabled={disabled || loading}
      style={{
        padding: "7px 18px",
        borderRadius: 6,
        border: "none",
        background: disabled || loading ? "var(--surface-3)" : confirmColor,
        color: disabled || loading ? "var(--text-muted)" : "var(--text-on-color)",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "..." : confirmLabel}
    </button>
  </div>
);

export const DialogError: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <div style={{ fontSize: 11, color: "var(--red)", marginTop: 8 }}>{error}</div> : null;

export const DialogCheckbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      fontSize: 12,
      color: "var(--text-secondary)",
      userSelect: "none",
      marginBottom: 8,
    }}
  >
    <div
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: checked ? "none" : "1.5px solid var(--border)",
        background: checked ? "var(--accent)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--surface-0)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
    {label}
  </label>
);
