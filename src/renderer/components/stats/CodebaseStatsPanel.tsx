import React, { useEffect } from "react";
import { useCodebaseStatsStore } from "../../store/codebase-stats-store";
import { useRepoStore } from "../../store/repo-store";

const TYPE_LABELS: Record<string, string> = {
  source: "Source", test: "Test", config: "Config",
  styles: "Styles", docs: "Docs", cicd: "CI/CD", other: "Other",
};

export const CodebaseStatsPanel: React.FC = () => {
  const repo = useRepoStore((s) => s.repo);
  const { stats, loading, error, loadStats, reset } = useCodebaseStatsStore();

  useEffect(() => {
    if (!repo) { reset(); return; }
    loadStats();
  }, [repo?.path]);

  if (!repo) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        Open a repository to see codebase statistics
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        Loading codebase statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px" }}>
        <span style={{ color: "var(--text-secondary)" }}>{error}</span>
        <button onClick={loadStats} style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "4px 12px", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats || stats.totalFiles === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        No tracked files found
      </div>
    );
  }

  const maxLangLines = stats.byLanguage[0]?.lines ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", background: "var(--surface-0)", color: "var(--text-primary)", padding: "16px", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>Codebase Statistics</span>
        <button onClick={loadStats} style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>
          ⟳ Refresh
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: "12px" }}>
        {[
          { label: "Total LOC", value: stats.totalLines.toLocaleString() },
          { label: "Files", value: stats.totalFiles.toLocaleString() },
          { label: "Languages", value: String(stats.languageCount) },
        ].map((item) => (
          <div key={item.label} style={{ flex: 1, background: "var(--surface-1)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{item.value}</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* By Language */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Lines of Code by Language
        </div>
        {stats.byLanguage.map((lang) => (
          <div key={lang.language} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}>
            <span style={{ width: "80px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{lang.language}</span>
            <div style={{ flex: 1, background: "var(--surface-1)", borderRadius: "3px", height: "18px" }}>
              <div style={{ background: lang.color, height: "100%", width: `${(lang.lines / maxLangLines) * 100}%`, borderRadius: "3px", minWidth: "2px" }} />
            </div>
            <span style={{ width: "60px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{lang.lines.toLocaleString()}</span>
            <span style={{ width: "40px", textAlign: "right", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>{lang.percentage}%</span>
          </div>
        ))}
      </div>

      {/* By Type */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Lines of Code by Type
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          {stats.byType.map((t) => (
            <div key={t.type} style={{ background: "var(--surface-1)", borderRadius: "6px", padding: "10px", textAlign: "center", borderLeft: `3px solid ${t.color}` }}>
              <div style={{ color: t.color, fontSize: "18px", fontWeight: "bold" }}>{t.lines.toLocaleString()}</div>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{TYPE_LABELS[t.type] ?? t.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Ratio */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Test Code Ratio
        </div>
        {stats.testRatio.sourceLines + stats.testRatio.testLines > 0 ? (
          <>
            <div style={{ display: "flex", borderRadius: "6px", height: "24px", overflow: "hidden" }}>
              <div style={{ background: "var(--accent)", width: `${100 - stats.testRatio.percentage}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "var(--text-on-color)", fontSize: "10px", fontWeight: "bold" }}>Source {(100 - stats.testRatio.percentage).toFixed(0)}%</span>
              </div>
              <div style={{ background: "var(--green)", width: `${stats.testRatio.percentage}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {stats.testRatio.percentage >= 10 && (
                  <span style={{ color: "var(--text-on-color)", fontSize: "10px", fontWeight: "bold" }}>Test {stats.testRatio.percentage.toFixed(0)}%</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              <span style={{ color: "var(--green)" }}>{stats.testRatio.testLines.toLocaleString()}</span> lines of test code for{" "}
              <span style={{ color: "var(--accent)" }}>{stats.testRatio.sourceLines.toLocaleString()}</span> lines of source code
              <span style={{ color: "var(--text-muted)" }}> — ratio 1:{stats.testRatio.ratio > 0 ? (1 / stats.testRatio.ratio).toFixed(1) : "∞"}</span>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>No source or test files found</div>
        )}
      </div>
    </div>
  );
};
