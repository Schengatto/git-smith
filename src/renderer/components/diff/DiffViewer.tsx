import React, { useMemo, useState } from "react";
import { html, Diff2HtmlConfig } from "diff2html";
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
  const [format, setFormat] = useState<OutputFormat>(initialFormat);

  const diffHtml = useMemo(() => {
    if (!rawDiff || rawDiff.startsWith("(")) return "";

    const config: Diff2HtmlConfig = {
      outputFormat: format,
      drawFileList: false,
      matching: "lines",
    };

    try {
      return html(rawDiff, config);
    } catch {
      return "";
    }
  }, [rawDiff, format]);

  if (!rawDiff) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span>No diff available</span>
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

  if (!diffHtml) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span>Could not parse diff</span>
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
              label="Unified"
            />
            <FormatBtn
              active={format === "side-by-side"}
              onClick={() => setFormat("side-by-side")}
              label="Split"
            />
          </div>
        )}
      </div>

      <div
        className="diff2html-wrapper"
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
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
      color: active ? "var(--surface-0)" : "var(--text-muted)",
      transition: "all 0.15s",
    }}
  >
    {label}
  </button>
);
