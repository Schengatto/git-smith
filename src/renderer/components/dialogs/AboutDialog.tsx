import React, { useState } from "react";
import { ModalDialog } from "./ModalDialog";

const APP_VERSION = __APP_VERSION__;

/* ------------------------------------------------------------------ */
/*  Logo SVG (inline from assets/icon.svg)                             */
/* ------------------------------------------------------------------ */

const LogoSvg: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
    <defs>
      <filter id="about-glow-sm">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="512" height="512" rx="108" ry="108" fill="#1e1e2e" />
    <rect width="512" height="512" rx="108" ry="108" fill="none" stroke="#313150" strokeWidth="1.5" />
    <circle cx="256" cy="256" r="150" fill="none" stroke="#313150" strokeWidth="6" opacity="0.5" />
    <path d="M 256 106 A 150 150 0 0 1 362 150" stroke="#89b4fa" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 362 150 A 150 150 0 0 1 406 256" stroke="#a6e3a1" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 406 256 A 150 150 0 0 1 362 362" stroke="#cba6f7" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 362 362 A 150 150 0 0 1 256 406" stroke="#f9e2af" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 256 406 A 150 150 0 0 1 150 362" stroke="#89b4fa" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 150 362 A 150 150 0 0 1 106 256" stroke="#a6e3a1" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 106 256 A 150 150 0 0 1 150 150" stroke="#fab387" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 150 150 A 150 150 0 0 1 256 106" stroke="#cba6f7" strokeWidth="6" fill="none" strokeLinecap="round" />
    <circle cx="256" cy="106" r="14" fill="#89b4fa" filter="url(#about-glow-sm)" />
    <circle cx="362" cy="150" r="12" fill="#a6e3a1" filter="url(#about-glow-sm)" />
    <circle cx="406" cy="256" r="14" fill="#cba6f7" filter="url(#about-glow-sm)" />
    <circle cx="362" cy="362" r="12" fill="#f9e2af" filter="url(#about-glow-sm)" />
    <circle cx="256" cy="406" r="14" fill="#89b4fa" filter="url(#about-glow-sm)" />
    <circle cx="150" cy="362" r="12" fill="#a6e3a1" filter="url(#about-glow-sm)" />
    <circle cx="106" cy="256" r="14" fill="#fab387" filter="url(#about-glow-sm)" />
    <circle cx="150" cy="150" r="12" fill="#cba6f7" filter="url(#about-glow-sm)" />
    <text x="256" y="316" textAnchor="middle" fill="#e0e4f7" fontFamily="'Segoe UI', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" fontSize="180" fontWeight="800" letterSpacing="-5">G</text>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Link component                                                     */
/* ------------------------------------------------------------------ */

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      style={{
        color: "var(--accent)",
        cursor: "pointer",
        textDecoration: hovered ? "underline" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.electronAPI.repo.openExternal(href)}
    >
      {children}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  AboutDialog                                                        */
/* ------------------------------------------------------------------ */

export const AboutDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  return (
    <ModalDialog open={open} title="About Git Expansion" onClose={onClose} width={400}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        {/* Logo */}
        <LogoSvg size={80} />

        {/* Name */}
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          Git Expansion
        </h2>

        {/* Description */}
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", maxWidth: 300 }}>
          A cross-platform Git GUI desktop application inspired by Git Extensions.
        </p>

        {/* Info rows */}
        <div style={{ width: "100%", marginTop: 4 }}>
          <InfoRow label="Version" value={APP_VERSION} />
          <InfoRow label="License" value="MIT" />
          <InfoRow label="Author">
            <ExternalLink href="https://enricoschintu.com">Enrico Schintu</ExternalLink>
          </InfoRow>
        </div>

        {/* Donate button */}
        <ExternalLink href="https://www.paypal.com/donate/?business=schintu.enrico%40gmail.com">
          <div
            style={{
              marginTop: 4,
              padding: "7px 20px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--text-on-color)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.067 8.478c.492.315.844.825.983 1.39L22 13.5c0 2.485-2.015 4.5-4.5 4.5H16v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7.5C16.538 5 18.585 6.533 20.067 8.478zM7 7v11h7v-2h2.5A2.5 2.5 0 0 0 19 13.5l-.95-3.611C17.578 9.01 16.613 8.5 15.5 8.5H13V7H7z"/>
            </svg>
            Donate via PayPal
          </div>
        </ExternalLink>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: "7px 24px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </ModalDialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Info row helper                                                    */
/* ------------------------------------------------------------------ */

const InfoRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      borderBottom: "1px solid var(--border-subtle)",
      fontSize: 12,
    }}
  >
    <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
    <span style={{ color: "var(--text-primary)" }}>{children ?? value}</span>
  </div>
);
