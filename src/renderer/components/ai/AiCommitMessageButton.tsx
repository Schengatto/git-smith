import React, { useState } from "react";
import { useMcpStore } from "../../store/mcp-store";

interface Props {
  onGenerated: (message: string) => void;
}

export const AiCommitMessageButton: React.FC<Props> = ({ onGenerated }) => {
  const { generating, generateCommitMessage } = useMcpStore();
  const [aiError, setAiError] = useState<string | null>(null);

  const handleClick = async () => {
    setAiError(null);
    try {
      const msg = await generateCommitMessage();
      onGenerated(msg);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={generating}
        title={aiError || "Generate commit message with AI"}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: generating ? "var(--surface-2)" : "var(--surface-0)",
          color: aiError ? "var(--red)" : "var(--text-secondary)",
          fontSize: 11,
          cursor: generating ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
          height: "fit-content",
          alignSelf: "flex-start",
          marginTop: 2,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        {generating ? "..." : "AI"}
      </button>
    </div>
  );
};
