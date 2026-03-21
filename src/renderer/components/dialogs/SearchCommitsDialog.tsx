import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog, DialogInput, DialogError } from "./ModalDialog";
import { useGraphStore } from "../../store/graph-store";
import type { CommitInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SearchCommitsDialog: React.FC<Props> = ({ open, onClose }) => {
  const [grep, setGrep] = useState("");
  const [author, setAuthor] = useState("");
  const [code, setCode] = useState("");
  const [results, setResults] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const { selectCommit } = useGraphStore();

  useEffect(() => {
    if (open) {
      setGrep("");
      setAuthor("");
      setCode("");
      setResults([]);
      setError(null);
      setSearched(false);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!grep.trim() && !author.trim() && !code.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await window.electronAPI.log.search({
        grep: grep.trim() || undefined,
        author: author.trim() || undefined,
        code: code.trim() || undefined,
        maxCount: 200,
      });
      setResults(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [grep, author, code]);

  const handleSelect = (hash: string) => {
    selectCommit(hash);
    onClose();
  };

  const hasInput = grep.trim() || author.trim() || code.trim();

  return (
    <ModalDialog open={open} title="Search Commits" onClose={onClose} width={600}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <DialogInput
          label="Message contains"
          value={grep}
          onChange={(e) => setGrep(e.target.value)}
          placeholder="fix, feat, refactor..."
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <DialogInput
          label="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="name or email"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <DialogInput
          label="Code change contains (pickaxe)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="functionName, variable..."
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>

      <div style={{ margin: "12px 0 8px", display: "flex", gap: 8 }}>
        <button
          onClick={handleSearch}
          disabled={!hasInput || loading}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "none",
            background: hasInput ? "var(--accent)" : "var(--surface1)",
            color: hasInput ? "var(--text-on-color)" : "var(--text-muted)",
            cursor: hasInput ? "pointer" : "default",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
        {searched && !loading && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      <DialogError error={error} />

      {results.length > 0 && (
        <div
          style={{
            maxHeight: 300,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 6,
            marginTop: 4,
          }}
        >
          {results.map((c) => (
            <div
              key={c.hash}
              onClick={() => handleSelect(c.hash)}
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                gap: 8,
                alignItems: "baseline",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="mono" style={{ color: "var(--accent)", flexShrink: 0, fontSize: 11 }}>
                {c.abbreviatedHash}
              </span>
              <span style={{ color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.subject}
              </span>
              <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 10 }}>
                {c.authorName}
              </span>
              <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 10 }}>
                {new Date(c.authorDate).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}>
          No commits found matching your criteria.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Close
        </button>
      </div>
    </ModalDialog>
  );
};
