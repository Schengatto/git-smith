import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { html } from "diff2html";
import { Diff2HtmlUI } from "diff2html/lib/ui/js/diff2html-ui-slim";
import { ColorSchemeType } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";

type OutputFormat = "line-by-line" | "side-by-side";

interface Props {
  rawDiff: string;
  fileName?: string;
  outputFormat?: OutputFormat;
  showFormatToggle?: boolean;
}

export const DiffViewer: React.FC<Props> = ({
  rawDiff,
  fileName,
  outputFormat: initialFormat = "line-by-line",
  showFormatToggle = true,
}) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<OutputFormat>(initialFormat);
  const [syntaxHighlight, setSyntaxHighlight] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use Diff2HtmlUI for syntax highlighting, fall back to plain html() without
  useEffect(() => {
    if (!containerRef.current) return;
    if (!rawDiff || rawDiff.startsWith("(")) {
      containerRef.current.innerHTML = "";
      return;
    }

    if (syntaxHighlight) {
      try {
        const diff2htmlUi = new Diff2HtmlUI(containerRef.current, rawDiff, {
          outputFormat: format,
          drawFileList: false,
          matching: "lines",
          highlight: true,
          colorScheme: ColorSchemeType.DARK,
        });
        diff2htmlUi.draw();
        diff2htmlUi.highlightCode();
      } catch {
        // Fallback to non-highlighted
        try {
          containerRef.current.innerHTML = html(rawDiff, {
            outputFormat: format,
            drawFileList: false,
            matching: "lines",
          });
        } catch {
          containerRef.current.innerHTML = "";
        }
      }
    } else {
      try {
        containerRef.current.innerHTML = html(rawDiff, {
          outputFormat: format,
          drawFileList: false,
          matching: "lines",
        });
      } catch {
        containerRef.current.innerHTML = "";
      }
    }
  }, [rawDiff, format, syntaxHighlight]);

  if (!rawDiff) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span>{t("diff.noDiffAvailable")}</span>
      </div>
    );
  }

  if (rawDiff.startsWith("(")) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{rawDiff}</span>
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        {fileName ? (
          <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {fileName}
          </span>
        ) : (
          <span />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Syntax highlight toggle */}
          <button
            onClick={() => setSyntaxHighlight((v) => !v)}
            title={
              syntaxHighlight
                ? t("diff.disableSyntaxHighlighting")
                : t("diff.enableSyntaxHighlighting")
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 500,
              border: `1px solid ${syntaxHighlight ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 4,
              cursor: "pointer",
              background: syntaxHighlight ? "var(--accent-dim)" : "transparent",
              color: syntaxHighlight ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            <svg
              width="10"
              height="10"
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
            {t("diff.syntax")}
          </button>

          {showFormatToggle && (
            <div
              style={{
                display: "flex",
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              <FormatBtn
                active={format === "line-by-line"}
                onClick={() => setFormat("line-by-line")}
                label={t("diff.unified")}
              />
              <FormatBtn
                active={format === "side-by-side"}
                onClick={() => setFormat("side-by-side")}
                label={t("diff.split")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="diff2html-wrapper" ref={containerRef} />
    </div>
  );
};

const FormatBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: "2px 10px",
      fontSize: 10,
      fontWeight: 500,
      border: "none",
      cursor: "pointer",
      background: active ? "var(--accent)" : "transparent",
      color: active ? "var(--text-on-color)" : "var(--text-muted)",
      transition: "all 0.15s",
    }}
  >
    {label}
  </button>
);
