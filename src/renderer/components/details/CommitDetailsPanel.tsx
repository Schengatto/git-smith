import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGraphStore } from "../../store/graph-store";
import { useRepoStore } from "../../store/repo-store";
import { FileTree } from "./FileTree";
import { DiffViewer } from "../diff/DiffViewer";
import { FileHistoryPanel } from "./FileHistoryPanel";
import { BlameView } from "./BlameView";
import { FileContextMenu } from "../shared/FileContextMenu";
import type { CommitFileInfo } from "../../../shared/git-types";

type TabId = "diff" | "files";

const IconFiles = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.4 }}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const CommitDetailsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCommit } = useGraphStore();
  const repo = useRepoStore((s) => s.repo);
  const [activeTab, setActiveTab] = useState<TabId>("diff");
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [treeFiles, setTreeFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedTreeFile, setSelectedTreeFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>("");
  const [treeFileContent, setTreeFileContent] = useState<string>("");

  // Use selected commit or HEAD
  const effectiveHash = selectedCommit?.hash || repo?.headCommit || null;

  // Load changed files (diff tab)
  useEffect(() => {
    if (!effectiveHash) {
      setFiles([]);
      setSelectedFile(null);
      setFileDiff("");
      return;
    }
    setSelectedFile(null);
    setFileDiff("");

    window.electronAPI.diff
      .commitFiles(effectiveHash)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [effectiveHash]);

  // Load tree files (files tab)
  useEffect(() => {
    if (!effectiveHash) {
      setTreeFiles([]);
      setSelectedTreeFile(null);
      setTreeFileContent("");
      return;
    }
    setSelectedTreeFile(null);
    setTreeFileContent("");

    window.electronAPI.diff
      .treeFiles(effectiveHash)
      .then(setTreeFiles)
      .catch(() => setTreeFiles([]));
  }, [effectiveHash]);

  // Load diff for selected file (diff tab)
  useEffect(() => {
    if (!effectiveHash || !selectedFile) {
      setFileDiff("");
      return;
    }
    window.electronAPI.diff
      .commitFile(effectiveHash, selectedFile)
      .then(setFileDiff)
      .catch(() => setFileDiff(t("details.couldNotLoadDiff")));
  }, [effectiveHash, selectedFile]);

  // Load file content for selected tree file (files tab)
  useEffect(() => {
    if (!effectiveHash || !selectedTreeFile) {
      setTreeFileContent("");
      return;
    }
    window.electronAPI.log
      .showFile(effectiveHash, selectedTreeFile)
      .then(setTreeFileContent)
      .catch(() => setTreeFileContent(t("details.couldNotLoadFile")));
  }, [effectiveHash, selectedTreeFile]);

  if (!effectiveHash) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconFiles />
        </div>
        <span>{t("details.selectCommitToViewFiles")}</span>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tab header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          background: "var(--surface-0)",
          padding: "0 8px",
          fontSize: 12,
          fontWeight: 500,
          gap: 0,
        }}
      >
        <TabButton active={activeTab === "diff"} onClick={() => setActiveTab("diff")}>
          {t("details.diff")}
          {files.length > 0 && <span style={tabBadgeStyle}>{files.length}</span>}
        </TabButton>
        <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
          {t("details.files")}
          {treeFiles.length > 0 && <span style={tabBadgeStyle}>{treeFiles.length}</span>}
        </TabButton>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "diff" ? (
          <DiffTab
            files={files}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            diff={fileDiff}
          />
        ) : (
          <FilesTab
            files={treeFiles}
            selectedFile={selectedTreeFile}
            onSelect={setSelectedTreeFile}
            content={treeFileContent}
          />
        )}
      </div>
    </div>
  );
};

/* ── Tab Button ── */

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "8px 14px",
      background: "transparent",
      border: "none",
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      color: active ? "var(--text-primary)" : "var(--text-muted)",
      fontWeight: active ? 600 : 500,
      fontSize: 12,
      cursor: "pointer",
      transition: "all 0.15s",
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.color = "var(--text-secondary)";
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.color = "var(--text-muted)";
    }}
  >
    {children}
  </button>
);

/* ── Diff Tab ── */

const DiffTab: React.FC<{
  files: CommitFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  diff: string;
}> = ({ files, selectedFile, onSelect, diff }) => {
  const { t } = useTranslation();
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const lower = search.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(lower));
  }, [files, search]);

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div
        style={{
          width: 260,
          minWidth: 180,
          borderRight: "1px solid var(--border-subtle)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SearchBar value={search} onChange={setSearch} placeholder={t("details.searchFiles")} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <FileTree
            files={filteredFiles}
            selectedFile={selectedFile}
            onSelect={onSelect}
            onFileHistory={setHistoryFile}
            onFileBlame={setBlameFile}
          />
        </div>
        {selectedFile && (
          <div
            style={{
              padding: "6px 8px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <SmallButton onClick={() => setHistoryFile(selectedFile)}>
              {t("details.history")}
            </SmallButton>
            <SmallButton onClick={() => setBlameFile(selectedFile)}>
              {t("details.blame")}
            </SmallButton>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
        {selectedFile ? (
          <DiffViewer rawDiff={diff} />
        ) : (
          <div className="empty-state">
            <span>{t("details.selectFileToViewDiff")}</span>
          </div>
        )}
      </div>

      <FileHistoryPanel
        open={!!historyFile}
        onClose={() => setHistoryFile(null)}
        filePath={historyFile || ""}
      />
      <BlameView open={!!blameFile} onClose={() => setBlameFile(null)} filePath={blameFile || ""} />
    </div>
  );
};

/* ── Files Tab ── */

interface SimpleTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: SimpleTreeNode[];
}

function buildSimpleTree(paths: string[]): SimpleTreeNode[] {
  const root: SimpleTreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      const isLast = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");

      let child = current.children.find((c) => c.name === name);
      if (!child) {
        child = { name, path: childPath, isDir: !isLast, children: [] };
        current.children.push(child);
      }
      current = child;
    }
  }

  const sortTree = (nodes: SimpleTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(root.children);

  // Collapse single-child directories
  const collapse = (nodes: SimpleTreeNode[]): SimpleTreeNode[] => {
    return nodes.map((node) => {
      if (node.isDir && node.children.length === 1 && node.children[0]!.isDir) {
        const child = node.children[0]!;
        return {
          ...child,
          name: `${node.name}/${child.name}`,
          children: collapse(child.children),
        } as SimpleTreeNode;
      }
      return { ...node, children: collapse(node.children) } as SimpleTreeNode;
    });
  };

  return collapse(root.children);
}

const FilesTab: React.FC<{
  files: string[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  content: string;
}> = ({ files, selectedFile, onSelect, content }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(
    null
  );

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const lower = search.toLowerCase();
    return files.filter((f) => f.toLowerCase().includes(lower));
  }, [files, search]);

  const tree = useMemo(() => buildSimpleTree(filteredFiles), [filteredFiles]);

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div
        style={{
          width: 260,
          minWidth: 180,
          borderRight: "1px solid var(--border-subtle)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SearchBar value={search} onChange={setSearch} placeholder={t("details.searchFiles")} />
        {filteredFiles.length === 0 ? (
          <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)" }}>
            {search ? t("details.noMatchingFiles") : t("details.noFiles")}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ paddingTop: 2, paddingBottom: 4 }}>
              {tree.map((node) => (
                <SimpleTreeNodeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  onSelect={onSelect}
                  onContextMenu={setContextMenu}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
        {selectedFile ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 12,
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {content}
          </pre>
        ) : (
          <div className="empty-state">
            <span>{t("details.selectFileToViewContent")}</span>
          </div>
        )}
      </div>
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onHistory={setHistoryFile}
          onBlame={setBlameFile}
        />
      )}
      <FileHistoryPanel
        open={!!historyFile}
        onClose={() => setHistoryFile(null)}
        filePath={historyFile || ""}
      />
      <BlameView open={!!blameFile} onClose={() => setBlameFile(null)} filePath={blameFile || ""} />
    </div>
  );
};

const SimpleTreeNodeRow: React.FC<{
  node: SimpleTreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (menu: { x: number; y: number; path: string } | null) => void;
}> = ({ node, depth, selectedFile, onSelect, onContextMenu }) => {
  const [expanded, setExpanded] = useState(true);

  if (node.isDir) {
    return (
      <>
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            paddingLeft: 8 + depth * 16,
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-secondary)",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="currentColor"
            style={{
              transition: "transform 0.12s ease",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          >
            <path d="M2 1l4 3-4 3z" />
          </svg>
          <IconFolder />
          <span className="truncate">{node.name}</span>
        </div>
        {expanded &&
          node.children.map((child) => (
            <SimpleTreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
      </>
    );
  }

  const selected = selectedFile === node.path;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu({ x: e.clientX, y: e.clientY, path: node.path });
  };

  return (
    <div
      onClick={() => onSelect(node.path)}
      onContextMenu={handleContextMenu}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        paddingLeft: 8 + depth * 16,
        cursor: "pointer",
        fontSize: 12,
        background: selected ? "var(--accent-dim)" : "transparent",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <IconFile />
      <span className="truncate" style={{ flex: 1, color: "var(--text-primary)" }}>
        {node.name}
      </span>
    </div>
  );
};

/* ── Search Bar ── */

const IconSearch = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, opacity: 0.5 }}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SearchBar: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <div
    style={{
      padding: "4px 6px",
      borderBottom: "1px solid var(--border-subtle)",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    <IconSearch />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Search..."}
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        outline: "none",
        color: "var(--text-primary)",
        fontSize: 11,
        padding: "2px 0",
        fontFamily: "inherit",
      }}
    />
    {value && (
      <button
        onClick={() => onChange("")}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: 0,
          fontSize: 14,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        ×
      </button>
    )}
  </div>
);

/* ── Shared UI ── */

const tabBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "0 5px",
  lineHeight: "16px",
  borderRadius: 8,
  background: "var(--surface-3)",
  color: "var(--text-muted)",
  marginLeft: 6,
};

const SmallButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: "4px 0",
      borderRadius: 4,
      border: "none",
      background: "var(--surface-2)",
      color: "var(--text-secondary)",
      fontSize: 10,
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.15s",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "var(--surface-3)";
      e.currentTarget.style.color = "var(--text-primary)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "var(--surface-2)";
      e.currentTarget.style.color = "var(--text-secondary)";
    }}
  >
    {children}
  </button>
);

const IconFolder = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-muted)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFile = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-muted)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);
