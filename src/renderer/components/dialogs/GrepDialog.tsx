import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogCheckbox, DialogError } from "./ModalDialog";
import type { GrepResult, GrepMatch } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FileGroup = {
  file: string;
  matches: GrepMatch[];
};

function groupByFile(matches: GrepMatch[]): FileGroup[] {
  const map = new Map<string, GrepMatch[]>();
  for (const m of matches) {
    const arr = map.get(m.file) ?? [];
    arr.push(m);
    map.set(m.file, arr);
  }
  return Array.from(map.entries()).map(([file, ms]) => ({ file, matches: ms }));
}

function highlightMatch(
  text: string,
  pattern: string,
  isRegex: boolean,
  ignoreCase: boolean
): React.ReactNode {
  if (!pattern) return text;
  try {
    const flags = ignoreCase ? "gi" : "g";
    const re = isRegex
      ? new RegExp(pattern, flags)
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(text.slice(last, match.index));
      }
      parts.push(
        <mark
          key={key++}
          style={{
            background: "var(--accent)",
            color: "var(--text-on-color)",
            borderRadius: 2,
            padding: "0 1px",
          }}
        >
          {match[0]}
        </mark>
      );
      last = match.index + match[0].length;
      if (match[0].length === 0) {
        re.lastIndex++;
      }
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length > 0 ? <>{parts}</> : text;
  } catch {
    return text;
  }
}

export const GrepDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrepResult | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPattern("");
      setIgnoreCase(false);
      setRegex(false);
      setWholeWord(false);
      setLoading(false);
      setError(null);
      setResult(null);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    const trimmed = pattern.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setResult(null);
    try {
      const res = await window.electronAPI.grep.search(trimmed, {
        ignoreCase,
        regex,
        wholeWord,
        maxCount: 500,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pattern, ignoreCase, regex, wholeWord]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleOpenFile = (file: string) => {
    window.electronAPI.shell.openFile(file);
  };

  const groups: FileGroup[] = result ? groupByFile(result.matches) : [];
  const canSearch = pattern.trim().length > 0 && !loading;

  return (
    <ModalDialog open={open} title={t("grep.title")} onClose={onClose} width={700}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          ref={inputRef}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("grep.searchPlaceholder")}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "monospace",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          onClick={handleSearch}
          disabled={!canSearch}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "none",
            background: canSearch ? "var(--accent)" : "var(--surface-2)",
            color: canSearch ? "var(--text-on-color)" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: canSearch ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          {loading ? t("grep.searching") : t("grep.search")}
        </button>
      </div>

      {/* Options row */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        <DialogCheckbox
          label={t("grep.caseInsensitive")}
          checked={ignoreCase}
          onChange={setIgnoreCase}
        />
        <DialogCheckbox label={t("grep.regex")} checked={regex} onChange={setRegex} />
        <DialogCheckbox label={t("grep.wholeWord")} checked={wholeWord} onChange={setWholeWord} />
      </div>

      <DialogError error={error} />

      {/* Status bar */}
      {searched && !loading && result && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 8,
            display: "flex",
            gap: 12,
          }}
        >
          <span>
            {result.matches.length}{" "}
            {result.matches.length !== 1 ? t("grep.matches") : t("grep.match")} in {groups.length}{" "}
            file{groups.length !== 1 ? "s" : ""}
          </span>
          {result.totalCount > result.matches.length && (
            <span style={{ color: "var(--yellow)" }}>{t("grep.limitedResults")}</span>
          )}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 0",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              animation: "grep-spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          {t("grep.searching")}
        </div>
      )}

      {/* Results */}
      {!loading && groups.length > 0 && (
        <div
          style={{
            maxHeight: 380,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface-0)",
          }}
        >
          {groups.map((group) => (
            <div key={group.file}>
              {/* File header */}
              <div
                onClick={() => handleOpenFile(group.file)}
                title={t("grep.openFile")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.file}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                  {group.matches.length}{" "}
                  {group.matches.length !== 1 ? t("grep.matches") : t("grep.match")}
                </span>
              </div>

              {/* Match rows */}
              {group.matches.map((match, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenFile(match.file)}
                  title={t("grep.openFile")}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "3px 10px 3px 20px",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    minHeight: 24,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "var(--text-muted)",
                      minWidth: 36,
                      textAlign: "right",
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {match.line}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      userSelect: "none",
                      flexShrink: 0,
                    }}
                  >
                    |
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "var(--text-primary)",
                      whiteSpace: "pre",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {highlightMatch(match.text, pattern.trim(), regex, ignoreCase)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && result && result.matches.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          {t("grep.noMatchesFoundFor")}{" "}
          <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{pattern}</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: "6px 16px",
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

      <style>{`@keyframes grep-spin { to { transform: rotate(360deg); } }`}</style>
    </ModalDialog>
  );
};
