import React, { useCallback } from "react";
import type { WorkspaceTab } from "../../store/workspace-store";
import { useWorkspaceStore } from "../../store/workspace-store";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, removeTab } = useWorkspaceStore();
  const { openRepo } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const handleSwitchTab = useCallback(
    async (tab: WorkspaceTab) => {
      if (tab.id === activeTabId) return;
      setActiveTab(tab.id);
      await openRepo(tab.repoPath);
      await loadGraph();
    },
    [activeTabId, setActiveTab, openRepo, loadGraph]
  );

  const handleCloseTab = useCallback(
    async (e: React.MouseEvent, tab: WorkspaceTab) => {
      e.stopPropagation();
      removeTab(tab.id);
      const remaining = useWorkspaceStore.getState().tabs;
      const nextActive = useWorkspaceStore.getState().activeTabId;
      if (nextActive) {
        const next = remaining.find((t) => t.id === nextActive);
        if (next) {
          await openRepo(next.repoPath);
          await loadGraph();
        }
      }
    },
    [removeTab, openRepo, loadGraph]
  );

  if (tabs.length <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--surface-0)",
        borderBottom: "1px solid var(--border)",
        height: 30,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => handleSwitchTab(tab)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            height: "100%",
            fontSize: 11,
            cursor: "pointer",
            color: tab.id === activeTabId ? "var(--text-primary)" : "var(--text-muted)",
            background: tab.id === activeTabId ? "var(--surface-1)" : "transparent",
            borderRight: "1px solid var(--border-subtle)",
            borderBottom:
              tab.id === activeTabId
                ? "2px solid var(--accent)"
                : "2px solid transparent",
            fontWeight: tab.id === activeTabId ? 600 : 400,
            transition: "background 0.1s",
            whiteSpace: "nowrap",
            maxWidth: 180,
          }}
        >
          {tab.isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--peach)",
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {tab.repoName}
          </span>
          <button
            onClick={(e) => handleCloseTab(e, tab)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 0,
              fontSize: 12,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
            title="Close tab"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
