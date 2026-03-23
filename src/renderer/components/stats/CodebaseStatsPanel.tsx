import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCodebaseStatsStore } from "../../store/codebase-stats-store";
import { useRepoStore } from "../../store/repo-store";

const TYPE_LABEL_KEYS: Record<string, string> = {
  source: "codebaseStats.source",
  test: "codebaseStats.test",
  config: "codebaseStats.config",
  styles: "codebaseStats.styles",
  docs: "codebaseStats.docs",
  cicd: "codebaseStats.cicd",
  other: "codebaseStats.other",
};

export const CodebaseStatsPanel: React.FC = () => {
  const { t } = useTranslation();
  const repo = useRepoStore((s) => s.repo);
  const { stats, loading, error, loadStats, reset } = useCodebaseStatsStore();

  useEffect(() => {
    if (!repo) {
      reset();
      return;
    }
    loadStats();
  }, [repo?.path, repo, reset, loadStats]);

  if (!repo) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
        }}
      >
        {t("codebaseStats.openRepoToSee")}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
        }}
      >
        {t("codebaseStats.loadingStats")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "8px",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>{error}</span>
        <button
          onClick={loadStats}
          style={{
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          {t("dialogs.retry")}
        </button>
      </div>
    );
  }

  if (!stats || stats.totalFiles === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
        }}
      >
        {t("codebaseStats.noTrackedFiles")}
      </div>
    );
  }

  const maxLangLines = stats.byLanguage[0]?.lines ?? 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "auto",
        background: "var(--surface-0)",
        color: "var(--text-primary)",
        padding: "16px",
        gap: "20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>{t("codebaseStats.title")}</span>
        <button
          onClick={loadStats}
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          ⟳ {t("codebaseStats.refresh")}
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: "12px" }}>
        {[
          { label: t("codebaseStats.totalLoc"), value: stats.totalLines.toLocaleString() },
          { label: t("codebaseStats.files"), value: stats.totalFiles.toLocaleString() },
          { label: t("codebaseStats.languages"), value: String(stats.languageCount) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              background: "var(--surface-1)",
              borderRadius: "6px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{item.value}</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* By Language */}
      <div>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "13px",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "4px",
            marginBottom: "10px",
          }}
        >
          {t("codebaseStats.linesByLanguage")}
        </div>
        {stats.byLanguage.map((lang) => (
          <div
            key={lang.language}
            style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}
          >
            <span
              style={{
                width: "80px",
                textAlign: "right",
                fontSize: "11px",
                color: "var(--text-secondary)",
                flexShrink: 0,
              }}
            >
              {lang.language}
            </span>
            <div
              style={{
                flex: 1,
                background: "var(--surface-1)",
                borderRadius: "3px",
                height: "18px",
              }}
            >
              <div
                style={{
                  background: lang.color,
                  height: "100%",
                  width: `${(lang.lines / maxLangLines) * 100}%`,
                  borderRadius: "3px",
                  minWidth: "2px",
                }}
              />
            </div>
            <span
              style={{
                width: "60px",
                textAlign: "right",
                fontSize: "11px",
                color: "var(--text-secondary)",
                flexShrink: 0,
              }}
            >
              {lang.lines.toLocaleString()}
            </span>
            <span
              style={{
                width: "40px",
                textAlign: "right",
                fontSize: "10px",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {lang.percentage}%
            </span>
          </div>
        ))}
      </div>

      {/* By Type */}
      <div>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "13px",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "4px",
            marginBottom: "10px",
          }}
        >
          {t("codebaseStats.linesByType")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          {stats.byType.map((tp) => (
            <div
              key={tp.type}
              style={{
                background: "var(--surface-1)",
                borderRadius: "6px",
                padding: "10px",
                textAlign: "center",
                borderLeft: `3px solid ${tp.color}`,
              }}
            >
              <div style={{ color: tp.color, fontSize: "18px", fontWeight: "bold" }}>
                {tp.lines.toLocaleString()}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                {TYPE_LABEL_KEYS[tp.type] ? t(TYPE_LABEL_KEYS[tp.type]!) : tp.type}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Ratio */}
      <div>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "13px",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "4px",
            marginBottom: "10px",
          }}
        >
          {t("codebaseStats.testCodeRatio")}
        </div>
        {stats.testRatio.sourceLines + stats.testRatio.testLines > 0 ? (
          <>
            <div
              style={{ display: "flex", borderRadius: "6px", height: "24px", overflow: "hidden" }}
            >
              <div
                style={{
                  background: "var(--accent)",
                  width: `${100 - stats.testRatio.percentage}%`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{ color: "var(--text-on-color)", fontSize: "10px", fontWeight: "bold" }}
                >
                  {t("codebaseStats.source")} {(100 - stats.testRatio.percentage).toFixed(0)}%
                </span>
              </div>
              <div
                style={{
                  background: "var(--green)",
                  width: `${stats.testRatio.percentage}%`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {stats.testRatio.percentage >= 10 && (
                  <span
                    style={{ color: "var(--text-on-color)", fontSize: "10px", fontWeight: "bold" }}
                  >
                    {t("codebaseStats.test")} {stats.testRatio.percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              <span style={{ color: "var(--green)" }}>
                {stats.testRatio.testLines.toLocaleString()}
              </span>{" "}
              {t("codebaseStats.linesOfTestCode")}{" "}
              <span style={{ color: "var(--accent)" }}>
                {stats.testRatio.sourceLines.toLocaleString()}
              </span>{" "}
              {t("codebaseStats.linesOfSourceCode")}
              <span style={{ color: "var(--text-muted)" }}>
                {" "}
                — {t("codebaseStats.ratio")} 1:
                {stats.testRatio.ratio > 0 ? (1 / stats.testRatio.ratio).toFixed(1) : "∞"}
              </span>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
            {t("codebaseStats.noSourceOrTestFiles")}
          </div>
        )}
      </div>
    </div>
  );
};
