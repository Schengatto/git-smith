import React, { useEffect, useState } from "react";
import { ModalDialog } from "./ModalDialog";
import type { CommitFullInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  onNavigateToCommit?: (hash: string) => void;
}

const LabelValue: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 12 }}>
    <span style={{ color: "var(--text-muted)", width: 100, flexShrink: 0, fontWeight: 600 }}>
      {label}:
    </span>
    <span style={{ color: "var(--text-primary)", minWidth: 0, wordBreak: "break-all" }}>
      {children}
    </span>
  </div>
);

const HashLink: React.FC<{
  hash: string;
  abbreviated?: string;
  onClick?: (hash: string) => void;
}> = ({ hash, abbreviated, onClick }) => (
  <span
    style={{
      color: "var(--accent)",
      cursor: onClick ? "pointer" : "default",
      textDecoration: onClick ? "underline" : "none",
      fontFamily: "monospace",
      fontSize: 11,
    }}
    onClick={() => onClick?.(hash)}
    title={hash}
  >
    {abbreviated || hash.slice(0, 10)}
  </span>
);

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginTop: 14,
      marginBottom: 6,
      borderTop: "1px solid var(--border-subtle)",
      paddingTop: 10,
    }}
  >
    {children}
  </div>
);

const BadgeList: React.FC<{
  items: string[];
  emptyText: string;
  color: string;
}> = ({ items, emptyText, color }) => {
  if (items.length === 0) {
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{emptyText}</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: color,
            color: "var(--text-primary)",
            fontFamily: "monospace",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

export const CommitInfoDialog: React.FC<Props> = ({
  open,
  onClose,
  commitHash,
  onNavigateToCommit,
}) => {
  const [info, setInfo] = useState<CommitFullInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !commitHash) return;
    setLoading(true);
    setError(null);
    window.electronAPI.log
      .fullInfo(commitHash)
      .then(setInfo)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, commitHash]);

  const formatFullDate = (iso: string): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      let relative = "";
      if (diffDays === 0) relative = "Today";
      else if (diffDays === 1) relative = "1 day ago";
      else if (diffDays < 30) relative = `${diffDays} days ago`;
      else if (diffDays < 365) relative = `${Math.floor(diffDays / 30)} months ago`;
      else relative = `${Math.floor(diffDays / 365)} years ago`;

      const dateStr = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return `${relative} (${dateStr} ${timeStr})`;
    } catch {
      return iso;
    }
  };

  return (
    <ModalDialog open={open} title="Commit Information" onClose={onClose} width={560}>
      {loading && (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}>
          Loading commit info...
        </div>
      )}
      {error && (
        <div style={{ color: "var(--red)", fontSize: 12, padding: 8 }}>{error}</div>
      )}
      {info && !loading && (
        <div>
          {/* Author section with avatar */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            {info.gravatarHash && (
              <img
                src={`https://www.gravatar.com/avatar/${info.gravatarHash}?s=80&d=retro`}
                alt=""
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  flexShrink: 0,
                  border: "2px solid var(--border)",
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <LabelValue label="Author">
                {info.authorName} &lt;{info.authorEmail}&gt;
              </LabelValue>
              <LabelValue label="Date">
                {formatFullDate(info.authorDate)}
              </LabelValue>
              <LabelValue label="Committer">
                {info.committerName} &lt;{info.committerEmail}&gt;
              </LabelValue>
              <LabelValue label="Commit hash">
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{info.hash}</span>
              </LabelValue>
            </div>
          </div>

          {/* Parent / Child hashes */}
          {info.parentHashes.length > 0 && (
            <LabelValue label="Parent">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {info.parentHashes.map((ph) => (
                  <HashLink key={ph} hash={ph} onClick={onNavigateToCommit} />
                ))}
              </div>
            </LabelValue>
          )}
          {info.childHashes.length > 0 && (
            <LabelValue label="Child">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {info.childHashes.map((ch) => (
                  <HashLink key={ch} hash={ch} onClick={onNavigateToCommit} />
                ))}
              </div>
            </LabelValue>
          )}

          {/* Commit message */}
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 6,
              background: "var(--surface-0)",
              border: "1px solid var(--border-subtle)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {info.subject}
            {info.body && (
              <div
                style={{
                  marginTop: 8,
                  fontWeight: 400,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {info.body}
              </div>
            )}
          </div>

          {/* Contained in branches */}
          <SectionHeader>Contained in branches</SectionHeader>
          <BadgeList
            items={info.containedInBranches}
            emptyText="No branches"
            color="var(--surface-2)"
          />

          {/* Contained in tags */}
          <SectionHeader>Contained in tags</SectionHeader>
          <BadgeList
            items={info.containedInTags}
            emptyText="Contained in no tag"
            color="var(--surface-2)"
          />

          {/* Derives from tag */}
          <SectionHeader>Derives from tag</SectionHeader>
          {info.derivesFromTag ? (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                fontFamily: "monospace",
              }}
            >
              {info.derivesFromTag}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              Derives from no tag
            </span>
          )}
        </div>
      )}
    </ModalDialog>
  );
};
