import React, { useState, useEffect } from "react";
import type { IssueInfo } from "../../../shared/git-types";

interface Props {
  text: string;
  pattern?: string;
}

const defaultPattern = "#(\\d+)";

export const IssueLinkText: React.FC<Props> = ({ text, pattern }) => {
  const regex = new RegExp(pattern || defaultPattern, "g");
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const ref = match[0];
    parts.push(<IssueRef key={match.index} reference={ref} />);
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return <>{parts}</>;
};

const IssueRef: React.FC<{ reference: string }> = ({ reference }) => {
  const [info, setInfo] = useState<IssueInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.electronAPI.issues
      .resolve(reference)
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const handleClick = () => {
    if (info?.url) window.electronAPI.shell.openFile(info.url);
  };

  return (
    <span
      onClick={info?.url ? handleClick : undefined}
      title={info ? `${info.title} (${info.state})` : loading ? "Loading..." : reference}
      style={{
        color: "var(--accent)",
        cursor: info?.url ? "pointer" : "default",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        fontWeight: 500,
      }}
    >
      {reference}
      {info && (
        <span
          style={{
            fontSize: 9,
            marginLeft: 3,
            padding: "0 4px",
            borderRadius: 6,
            background:
              info.state === "open"
                ? "color-mix(in srgb, var(--green) 20%, transparent)"
                : "color-mix(in srgb, var(--red) 20%, transparent)",
            color: info.state === "open" ? "var(--green)" : "var(--red)",
          }}
        >
          {info.state}
        </span>
      )}
    </span>
  );
};
