import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graph-store";
import { useRepoStore } from "../../store/repo-store";
import type { CommitFullInfo } from "../../../shared/git-types";

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const CommitInfoPanel: React.FC = () => {
  const { selectedCommit } = useGraphStore();
  const repo = useRepoStore((s) => s.repo);
  const [info, setInfo] = useState<CommitFullInfo | null>(null);
  const [gpgInfo, setGpgInfo] = useState<{ signed: boolean; key?: string; status?: string; signer?: string } | null>(null);
  const [noteText, setNoteText] = useState<string>("");

  // Use selected commit or HEAD
  const effectiveHash = selectedCommit?.hash || repo?.headCommit || null;

  useEffect(() => {
    if (!effectiveHash) {
      setInfo(null);
      setGpgInfo(null);
      setNoteText("");
      return;
    }
    window.electronAPI.log
      .fullInfo(effectiveHash)
      .then(setInfo)
      .catch(() => setInfo(null));
    window.electronAPI.gpg
      .verify(effectiveHash)
      .then(setGpgInfo)
      .catch(() => setGpgInfo(null));
    window.electronAPI.notes
      .get(effectiveHash)
      .then(setNoteText)
      .catch(() => setNoteText(""));
  }, [effectiveHash]);

  if (!effectiveHash) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconInfo />
        </div>
        <span>Select a commit to view info</span>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "10px 12px" }}>
      {/* Avatar + metadata */}
      <div style={{ display: "flex", gap: 10 }}>
        {info.gravatarHash && (
          <img
            src={`https://www.gravatar.com/avatar/${info.gravatarHash}?s=64&d=retro`}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: 6,
              flexShrink: 0,
              border: "1px solid var(--border)",
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <MetaRow label="Author">
            {info.authorName} &lt;{info.authorEmail}&gt;
          </MetaRow>
          <MetaRow label="Date">
            {formatDate(info.authorDate)}
          </MetaRow>
          {(info.committerName !== info.authorName || info.committerEmail !== info.authorEmail) && (
            <MetaRow label="Committer">
              {info.committerName} &lt;{info.committerEmail}&gt;
            </MetaRow>
          )}
          <MetaRow label="Commit hash">
            <span style={{ fontFamily: "monospace", fontSize: 11, userSelect: "all" }}>
              {info.hash}
            </span>
          </MetaRow>
          {info.childHashes.length > 0 && (
            <MetaRow label="Child">
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                {info.childHashes.map((h) => h.slice(0, 10)).join(", ")}
              </span>
            </MetaRow>
          )}
          {info.parentHashes.length > 0 && (
            <MetaRow label="Parent">
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                {info.parentHashes.map((h) => h.slice(0, 10)).join(", ")}
              </span>
            </MetaRow>
          )}
        </div>
      </div>

      {/* Commit message */}
      <div
        style={{
          marginTop: 8,
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
              marginTop: 4,
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

      {/* GPG Signature */}
      {gpgInfo && gpgInfo.signed && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            background: gpgInfo.status === "G" ? "hsla(120, 50%, 50%, 0.1)" : "hsla(40, 50%, 50%, 0.1)",
            border: `1px solid ${gpgInfo.status === "G" ? "hsla(120, 50%, 50%, 0.3)" : "hsla(40, 50%, 50%, 0.3)"}`,
            fontSize: 11,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={gpgInfo.status === "G" ? "var(--green)" : "var(--yellow)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ color: gpgInfo.status === "G" ? "var(--green)" : "var(--yellow)" }}>
            {gpgInfo.status === "G" ? "Verified" : "Signed"} signature
          </span>
          {gpgInfo.signer && (
            <span style={{ color: "var(--text-muted)" }}>by {gpgInfo.signer}</span>
          )}
          {gpgInfo.key && (
            <span className="mono" style={{ color: "var(--text-muted)", fontSize: 10 }}>
              ({gpgInfo.key})
            </span>
          )}
        </div>
      )}

      {/* Git Notes */}
      {noteText && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            borderRadius: 6,
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: 2, fontSize: 10 }}>
            Note
          </div>
          <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
            {noteText}
          </div>
        </div>
      )}

      {/* Branches, Tags */}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
        <MetaRow label="Contained in branches">
          {info.containedInBranches.length > 0 ? (
            <BadgeList items={info.containedInBranches} />
          ) : (
            <MutedText>No branches</MutedText>
          )}
        </MetaRow>
        <MetaRow label="Contained in tags">
          {info.containedInTags.length > 0 ? (
            <BadgeList items={info.containedInTags} />
          ) : (
            <MutedText>Contained in no tag</MutedText>
          )}
        </MetaRow>
        <MetaRow label="Derives from tag">
          {info.derivesFromTag ? (
            <Badge>{info.derivesFromTag}</Badge>
          ) : (
            <MutedText>Derives from no tag</MutedText>
          )}
        </MetaRow>
      </div>
    </div>
  );
};

/* ── Sub-components ── */

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 2, fontSize: 12 }}>
    <span style={{ color: "var(--text-muted)", width: 130, flexShrink: 0, fontWeight: 600, textAlign: "right" }}>
      {label}:
    </span>
    <span style={{ color: "var(--text-primary)", minWidth: 0, wordBreak: "break-all" }}>
      {children}
    </span>
  </div>
);

const BadgeList: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
    {items.map((item) => (
      <Badge key={item}>{item}</Badge>
    ))}
  </div>
);

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: 11,
      padding: "1px 6px",
      borderRadius: 4,
      background: "var(--surface-2)",
      color: "var(--text-primary)",
      fontFamily: "monospace",
    }}
  >
    {children}
  </span>
);

const MutedText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{children}</span>
);

/* ── Helpers ── */

function formatDate(iso: string): string {
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

    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${relative} (${dateStr} ${timeStr})`;
  } catch {
    return iso;
  }
}
