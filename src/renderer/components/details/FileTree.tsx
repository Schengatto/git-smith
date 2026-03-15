import React, { useState, useMemo } from "react";
import type { CommitFileInfo } from "../../../shared/git-types";

interface Props {
  files: CommitFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: CommitFileInfo;
}

/** Builds a hierarchical tree from a flat list of file paths, collapsing single-child directories. */
function buildTree(files: CommitFileInfo[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");

      let child = current.children.find((c) => c.name === name);
      if (!child) {
        child = {
          name,
          path: childPath,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: dirs first, then alphabetical
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(root.children);

  // Collapse single-child directories
  const collapse = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.map((node) => {
      if (node.isDir && node.children.length === 1 && node.children[0].isDir) {
        const child = node.children[0];
        return {
          ...child,
          name: `${node.name}/${child.name}`,
          children: collapse(child.children),
        };
      }
      return { ...node, children: collapse(node.children) };
    });
  };

  return collapse(root.children);
}

export const FileTree: React.FC<Props> = ({ files, selectedFile, onSelect }) => {
  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)" }}>
        No changed files
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 2, paddingBottom: 4 }}>
      {tree.map((node) => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

const TreeNodeRow: React.FC<{
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}> = ({ node, depth, selectedFile, onSelect }) => {
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
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }

  const file = node.file!;
  const selected = selectedFile === file.path;
  const statusColors: Record<string, string> = {
    added: "var(--green)",
    modified: "var(--peach)",
    deleted: "var(--red)",
    renamed: "var(--mauve)",
    copied: "var(--accent)",
  };
  const statusLetters: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
    copied: "C",
  };
  const color = statusColors[file.status] || "var(--text-muted)";
  const letter = statusLetters[file.status] || "?";

  return (
    <div
      onClick={() => onSelect(file.path)}
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
      <span
        className="truncate"
        style={{ flex: 1, color: "var(--text-primary)" }}
      >
        {node.name}
      </span>

      {/* Stats */}
      <span style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0, fontSize: 10 }}>
        {file.additions > 0 && (
          <span style={{ color: "var(--green)" }}>+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span style={{ color: "var(--red)" }}>-{file.deletions}</span>
        )}
      </span>

      {/* Status badge */}
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 700,
          background: `${color}20`,
          color,
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
    </div>
  );
};

const IconFolder = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFile = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);
