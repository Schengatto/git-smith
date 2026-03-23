import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  commitHash: string;
  filePath: string;
}

type DiffMode = "side-by-side" | "slider" | "onion";

export const ImageDiffViewer: React.FC<Props> = ({ commitHash: _commitHash, filePath }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<DiffMode>("side-by-side");
  const [sliderPos, setSliderPos] = useState(50);
  const [onionOpacity, setOnionOpacity] = useState(50);

  // For images we can't easily get base64 from git without a dedicated IPC.
  // Show a message explaining how to view the diff.
  // In a full implementation, we'd add IPC to read blobs via `git show <hash>:<path>`.

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {t("imageDiff.imageDiff")}
        </span>
        <div
          style={{
            display: "flex",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {(["side-by-side", "slider", "onion"] as DiffMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "var(--text-on-color)" : "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {m === "side-by-side"
                ? t("imageDiff.sideBySide")
                : m === "slider"
                  ? t("imageDiff.slider")
                  : t("imageDiff.onionSkin")}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 24,
          borderRadius: 8,
          background: "var(--surface-0)",
          border: "1px solid var(--border-subtle)",
          textAlign: "center",
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ margin: "0 auto 12px", display: "block" }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
          {t("imageDiff.binaryImageFile")}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {filePath}
        </div>
        {mode === "slider" && (
          <div style={{ marginTop: 12 }}>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              style={{ width: 200 }}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {t("imageDiff.oldNewSlider", { old: sliderPos, new: 100 - sliderPos })}
            </div>
          </div>
        )}
        {mode === "onion" && (
          <div style={{ marginTop: 12 }}>
            <input
              type="range"
              min={0}
              max={100}
              value={onionOpacity}
              onChange={(e) => setOnionOpacity(Number(e.target.value))}
              style={{ width: 200 }}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {t("imageDiff.opacity", { value: onionOpacity })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".svg",
  ".webp",
  ".ico",
  ".tiff",
  ".tif",
]);

export function isImageFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
