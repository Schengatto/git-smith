import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "./ModalDialog";

const APP_VERSION = __APP_VERSION__;

/* ------------------------------------------------------------------ */
/*  Logo (PNG from assets)                                              */
/* ------------------------------------------------------------------ */

import logoUrl from "../../../../assets/icon.png";

const Logo: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <img src={logoUrl} alt="GitSmith" width={size} height={size} style={{ objectFit: "contain" }} />
);

/* ------------------------------------------------------------------ */
/*  Link component                                                     */
/* ------------------------------------------------------------------ */

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => {
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

export const AboutDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <ModalDialog open={open} title={t("about.title")} onClose={onClose} width={400}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        {/* Logo */}
        <Logo size={80} />

        {/* Name */}
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          {t("app.name")}
        </h2>

        {/* Description */}
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", maxWidth: 300 }}>
          {t("about.description")}
        </p>

        {/* Info rows */}
        <div style={{ width: "100%", marginTop: 4 }}>
          <InfoRow label={t("about.version")} value={APP_VERSION} />
          <InfoRow label={t("about.license")} value="MIT" />
          <InfoRow label={t("about.author")}>
            <ExternalLink href="https://enricoschintu.com">Enrico Schintu</ExternalLink>
          </InfoRow>
          <InfoRow label={t("about.macOsTester")}>
            <ExternalLink href="https://github.com/amritpal1011">amritpal1011</ExternalLink>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.067 8.478c.492.315.844.825.983 1.39L22 13.5c0 2.485-2.015 4.5-4.5 4.5H16v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7.5C16.538 5 18.585 6.533 20.067 8.478zM7 7v11h7v-2h2.5A2.5 2.5 0 0 0 19 13.5l-.95-3.611C17.578 9.01 16.613 8.5 15.5 8.5H13V7H7z" />
            </svg>
            {t("about.donateViaPaypal")}
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
          {t("dialogs.close")}
        </button>
      </div>
    </ModalDialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Info row helper                                                    */
/* ------------------------------------------------------------------ */

const InfoRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({
  label,
  value,
  children,
}) => (
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
