import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store";

type Tab = "general" | "git" | "fetch" | "commit" | "diff" | "mergetool" | "advanced" | "ai";

interface AppSettings {
  theme: string;
  autoFetchEnabled: boolean;
  autoFetchInterval: number;
  fetchPruneOnAuto: boolean;
  defaultCommitTemplate: string;
  signCommits: boolean;
  diffContextLines: number;
  preferSideBySideDiff: boolean;
  graphMaxInitialLoad: number;
  showRemoteBranchesInGraph: boolean;
  mergeToolName: string;
  mergeToolPath: string;
  mergeToolArgs: string;
  maxConcurrentGitProcesses: number;
  gitBinaryPath: string;
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  mcpServerEnabled: boolean;
}

interface GitConfig {
  "user.name": string;
  "user.email": string;
  "core.autocrlf": string;
  "core.editor": string;
  "pull.rebase": string;
  "merge.ff": string;
  "push.default": string;
  [key: string]: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <IconSettings /> },
  { id: "git", label: "Git Config", icon: <IconGit /> },
  { id: "fetch", label: "Fetch", icon: <IconFetch /> },
  { id: "commit", label: "Commit", icon: <IconCommit /> },
  { id: "diff", label: "Diff & Graph", icon: <IconDiff /> },
  { id: "mergetool", label: "Merge Tool", icon: <IconMergeTool /> },
  { id: "advanced", label: "Advanced", icon: <IconAdvanced /> },
  { id: "ai", label: "AI / MCP", icon: <IconAi /> },
];

export const SettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [gitConfig, setGitConfig] = useState<GitConfig | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GitConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    loadSettings();
    loadGitConfig();
  }, [open]);

  const loadSettings = async () => {
    const s = await window.electronAPI.settings.get();
    setSettings(s as unknown as AppSettings);
  };

  const loadGitConfig = async () => {
    try {
      const local = await window.electronAPI.gitConfig.list(false);
      setGitConfig(local as GitConfig);
      const global = await window.electronAPI.gitConfig.list(true);
      setGlobalConfig(global as GitConfig);
    } catch {
      setGitConfig({} as GitConfig);
      setGlobalConfig({} as GitConfig);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...partial });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await window.electronAPI.settings.update(settings as unknown as Record<string, unknown>);
      // Apply theme
      useUIStore.getState().setTheme(settings.theme as "dark" | "light");
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGitConfig = async (key: string, value: string, global: boolean) => {
    await window.electronAPI.gitConfig.set(key, value, global);
    await loadGitConfig();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 0.15s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "80vw",
          maxWidth: 750,
          height: "70vh",
          maxHeight: 550,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modal-in 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Settings</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Sidebar tabs */}
          <div
            style={{
              width: 160,
              borderRight: "1px solid var(--border-subtle)",
              padding: "8px 0",
              overflowY: "auto",
            }}
          >
            {TABS.map((t) => (
              <div
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
                  background: tab === t.id ? "var(--accent-dim)" : "transparent",
                  borderLeft: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "all 0.1s",
                  fontWeight: tab === t.id ? 600 : 400,
                }}
              >
                {t.icon}
                {t.label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {settings && tab === "general" && (
              <GeneralTab settings={settings} onChange={updateSetting} />
            )}
            {tab === "git" && gitConfig && globalConfig && (
              <GitConfigTab local={gitConfig} global={globalConfig} onSave={handleSaveGitConfig} />
            )}
            {settings && tab === "fetch" && (
              <FetchTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "commit" && (
              <CommitTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "diff" && (
              <DiffTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "mergetool" && (
              <MergeToolTab settings={settings} onChange={updateSetting} onBatchChange={updateSettings} />
            )}
            {settings && tab === "advanced" && (
              <AdvancedTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "ai" && (
              <AiTab settings={settings} onChange={updateSetting} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}
          >
            Close
          </button>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "7px 18px", borderRadius: 6, border: "none",
                background: "var(--accent)", color: "var(--surface-0)", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ---------- Tab contents ---------- */

type OnChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

const GeneralTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => {
  const handleBrowseGit = async () => {
    const selected = await window.electronAPI.repo.browseFile("Select Git executable");
    if (selected) onChange("gitBinaryPath", selected);
  };

  return (
    <div>
      <SectionTitle>Appearance</SectionTitle>
      <SettingRow label="Theme" description="Application color theme">
        <Select
          value={settings.theme}
          options={[
            { value: "dark", label: "Dark (Catppuccin Mocha)" },
            { value: "light", label: "Light (Catppuccin Latte)" },
          ]}
          onChange={(v) => onChange("theme", v)}
        />
      </SettingRow>
      <SectionTitle>Git</SectionTitle>
      <SettingRow label="Git binary path" description="Leave empty to use git from system PATH">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            value={settings.gitBinaryPath}
            onChange={(e) => onChange("gitBinaryPath", e.target.value)}
            placeholder="git"
            style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
              outline: "none", width: 220, fontFamily: "var(--font-mono, monospace)",
            }}
          />
          <button onClick={handleBrowseGit} style={{
            padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
          }}>
            Browse
          </button>
        </div>
      </SettingRow>
    </div>
  );
};

const FetchTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => (
  <div>
    <SectionTitle>Auto Fetch</SectionTitle>
    <SettingRow label="Enable auto fetch" description="Periodically fetch from all remotes in the background">
      <Toggle checked={settings.autoFetchEnabled} onChange={(v) => onChange("autoFetchEnabled", v)} />
    </SettingRow>
    {settings.autoFetchEnabled && (
      <>
        <SettingRow label="Fetch interval" description="Time between automatic fetches">
          <Select
            value={String(settings.autoFetchInterval)}
            options={[
              { value: "60", label: "1 minute" },
              { value: "120", label: "2 minutes" },
              { value: "300", label: "5 minutes" },
              { value: "600", label: "10 minutes" },
              { value: "1800", label: "30 minutes" },
            ]}
            onChange={(v) => onChange("autoFetchInterval", Number(v))}
          />
        </SettingRow>
        <SettingRow label="Prune on auto fetch" description="Remove remote-tracking branches that no longer exist on the remote">
          <Toggle checked={settings.fetchPruneOnAuto} onChange={(v) => onChange("fetchPruneOnAuto", v)} />
        </SettingRow>
      </>
    )}
  </div>
);

const CommitTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => (
  <div>
    <SectionTitle>Commit</SectionTitle>
    <SettingRow label="Sign commits (GPG)" description="Automatically sign commits with your GPG key">
      <Toggle checked={settings.signCommits} onChange={(v) => onChange("signCommits", v)} />
    </SettingRow>
    <SettingRow label="Default commit template" description="Pre-fill the commit message with this template">
      <textarea
        value={settings.defaultCommitTemplate}
        onChange={(e) => onChange("defaultCommitTemplate", e.target.value)}
        rows={3}
        style={{
          width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
          background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
          fontFamily: "inherit", resize: "vertical", outline: "none",
        }}
        placeholder="e.g. [JIRA-XXX] "
      />
    </SettingRow>
  </div>
);

const DiffTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => (
  <div>
    <SectionTitle>Diff</SectionTitle>
    <SettingRow label="Default view" description="Default diff display format">
      <Select
        value={settings.preferSideBySideDiff ? "split" : "unified"}
        options={[
          { value: "unified", label: "Unified (line-by-line)" },
          { value: "split", label: "Split (side-by-side)" },
        ]}
        onChange={(v) => onChange("preferSideBySideDiff", v === "split")}
      />
    </SettingRow>
    <SettingRow label="Context lines" description="Number of unchanged lines shown around changes">
      <NumberInput
        value={settings.diffContextLines}
        min={0}
        max={20}
        onChange={(v) => onChange("diffContextLines", v)}
      />
    </SettingRow>
    <SectionTitle>Graph</SectionTitle>
    <SettingRow label="Initial load count" description="Number of commits loaded on first open">
      <Select
        value={String(settings.graphMaxInitialLoad)}
        options={[
          { value: "200", label: "200" },
          { value: "500", label: "500" },
          { value: "1000", label: "1000" },
          { value: "2000", label: "2000" },
        ]}
        onChange={(v) => onChange("graphMaxInitialLoad", Number(v))}
      />
    </SettingRow>
    <SettingRow label="Show remote branches" description="Display remote branches in the commit graph">
      <Toggle checked={settings.showRemoteBranchesInGraph} onChange={(v) => onChange("showRemoteBranchesInGraph", v)} />
    </SettingRow>
  </div>
);

const MERGE_TOOL_PRESETS: { name: string; label: string; path: string; args: string }[] = [
  { name: "", label: "None (use internal editor)", path: "", args: "" },
  { name: "kdiff3", label: "KDiff3", path: "kdiff3", args: "\"$BASE\" \"$LOCAL\" \"$REMOTE\" -o \"$MERGED\"" },
  { name: "meld", label: "Meld", path: "meld", args: "\"$LOCAL\" \"$BASE\" \"$REMOTE\" -o \"$MERGED\"" },
  { name: "beyondcompare", label: "Beyond Compare", path: "bcomp", args: "\"$LOCAL\" \"$REMOTE\" \"$BASE\" \"$MERGED\"" },
  { name: "p4merge", label: "P4Merge", path: "p4merge", args: "\"$BASE\" \"$LOCAL\" \"$REMOTE\" \"$MERGED\"" },
  { name: "vscode", label: "VS Code", path: "code", args: "--wait --merge \"$LOCAL\" \"$REMOTE\" \"$BASE\" \"$MERGED\"" },
  { name: "tortoisegitmerge", label: "TortoiseGitMerge", path: "TortoiseGitMerge", args: "-base:\"$BASE\" -theirs:\"$REMOTE\" -mine:\"$LOCAL\" -merged:\"$MERGED\"" },
  { name: "winmerge", label: "WinMerge", path: "WinMergeU", args: "\"$LOCAL\" \"$REMOTE\" \"$MERGED\"" },
  { name: "custom", label: "Custom...", path: "", args: "" },
];

const MergeToolTab: React.FC<{ settings: AppSettings; onChange: OnChange; onBatchChange: (partial: Partial<AppSettings>) => void }> = ({ settings, onChange, onBatchChange }) => {
  const handlePresetChange = (presetName: string) => {
    const preset = MERGE_TOOL_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    if (preset.name === "custom") {
      onBatchChange({ mergeToolName: preset.name });
    } else {
      onBatchChange({
        mergeToolName: preset.name,
        mergeToolPath: preset.path,
        mergeToolArgs: preset.args,
      });
    }
  };

  const handleBrowse = async () => {
    const selected = await window.electronAPI.repo.browseDirectory("Select merge tool executable");
    if (selected) onChange("mergeToolPath", selected);
  };

  const isCustom = settings.mergeToolName === "custom";
  const hasToolConfigured = settings.mergeToolName !== "";

  return (
    <div>
      <SectionTitle>External Merge Tool</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        Configure an external tool for resolving merge conflicts. If none is set, the built-in editor will be used.
      </div>
      <SettingRow label="Merge tool" description="Select a preset or choose Custom">
        <Select
          value={settings.mergeToolName}
          options={MERGE_TOOL_PRESETS.map((p) => ({ value: p.name, label: p.label }))}
          onChange={handlePresetChange}
        />
      </SettingRow>
      {hasToolConfigured && (
        <>
          <SettingRow label="Executable path" description="Path to the merge tool binary">
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                value={settings.mergeToolPath}
                onChange={(e) => onChange("mergeToolPath", e.target.value)}
                placeholder="e.g. kdiff3 or /usr/bin/meld"
                style={{
                  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                  outline: "none", width: 220,
                }}
              />
              {isCustom && (
                <button onClick={handleBrowse} style={{
                  padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                }}>
                  Browse
                </button>
              )}
            </div>
          </SettingRow>
          <SettingRow label="Arguments" description="Use $BASE $LOCAL $REMOTE $MERGED as placeholders">
            <input
              value={settings.mergeToolArgs}
              onChange={(e) => onChange("mergeToolArgs", e.target.value)}
              placeholder={'$BASE $LOCAL $REMOTE -o $MERGED'}
              style={{
                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                outline: "none", width: 340, fontFamily: "var(--font-mono, monospace)",
              }}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
};

const AdvancedTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => (
  <div>
    <SectionTitle>Performance</SectionTitle>
    <SettingRow label="Max concurrent git processes" description="Number of git commands that can run in parallel">
      <NumberInput
        value={settings.maxConcurrentGitProcesses}
        min={1}
        max={20}
        onChange={(v) => onChange("maxConcurrentGitProcesses", v)}
      />
    </SettingRow>
  </div>
);

const GitConfigTab: React.FC<{
  local: GitConfig;
  global: GitConfig;
  onSave: (key: string, value: string, global: boolean) => Promise<void>;
}> = ({ local, global, onSave }) => {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editGlobal, setEditGlobal] = useState(false);

  const importantKeys = [
    { key: "user.name", label: "User Name" },
    { key: "user.email", label: "User Email" },
    { key: "core.autocrlf", label: "Auto CRLF" },
    { key: "core.editor", label: "Default Editor" },
    { key: "pull.rebase", label: "Pull Rebase" },
    { key: "push.default", label: "Push Default" },
    { key: "merge.ff", label: "Merge Fast-Forward" },
  ];

  const startEdit = (key: string, isGlobal: boolean) => {
    setEditKey(key);
    setEditGlobal(isGlobal);
    setEditValue((isGlobal ? global[key] : local[key]) || "");
  };

  const saveEdit = async () => {
    if (editKey) {
      await onSave(editKey, editValue, editGlobal);
      setEditKey(null);
    }
  };

  return (
    <div>
      <SectionTitle>User Identity (Global)</SectionTitle>
      {importantKeys.slice(0, 2).map(({ key, label }) => (
        <SettingRow key={key} label={label} description={key}>
          {editKey === key ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                style={{
                  padding: "4px 8px", borderRadius: 4, border: "1px solid var(--accent)",
                  background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12, width: 200, outline: "none",
                }}
              />
              <button onClick={saveEdit} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "var(--accent)", color: "var(--surface-0)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Save
              </button>
              <button onClick={() => setEditKey(null)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(key, true)}
              style={{
                padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border-subtle)",
                background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                cursor: "pointer", minWidth: 200, minHeight: 24,
              }}
              title="Click to edit"
            >
              {global[key] || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>not set</span>}
            </div>
          )}
        </SettingRow>
      ))}

      <SectionTitle>Repository Config</SectionTitle>
      {importantKeys.slice(2).map(({ key, label }) => (
        <SettingRow key={key} label={label} description={key}>
          {editKey === key ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                style={{
                  padding: "4px 8px", borderRadius: 4, border: "1px solid var(--accent)",
                  background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12, width: 200, outline: "none",
                }}
              />
              <button onClick={saveEdit} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "var(--accent)", color: "var(--surface-0)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Save
              </button>
              <button onClick={() => setEditKey(null)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(key, false)}
              style={{
                padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border-subtle)",
                background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                cursor: "pointer", minWidth: 200, minHeight: 24,
              }}
              title="Click to edit"
            >
              {local[key] || global[key] || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>not set</span>}
            </div>
          )}
        </SettingRow>
      ))}
    </div>
  );
};

/* ---------- Shared UI primitives ---------- */

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    color: "var(--text-muted)", marginBottom: 10, marginTop: 16,
    paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)",
  }}>
    {children}
  </div>
);

const SettingRow: React.FC<{ label: string; description: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 0" }}>
    <div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{description}</div>
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: 36, height: 20, borderRadius: 10, cursor: "pointer",
      background: checked ? "var(--accent)" : "var(--surface-3)",
      transition: "background 0.2s", position: "relative",
    }}
  >
    <div
      style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 2,
        left: checked ? 18 : 2,
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    />
  </div>
);

const Select: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
      background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
      outline: "none", cursor: "pointer", minWidth: 160,
    }}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const NumberInput: React.FC<{
  value: number; min: number; max: number; onChange: (v: number) => void;
}> = ({ value, min, max, onChange }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{
      padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
      background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
      outline: "none", width: 80, textAlign: "center",
    }}
  />
);

/* ---------- Tab icons ---------- */

function IconSettings() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconGit() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function IconFetch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCommit() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" />
    </svg>
  );
}

function IconDiff() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function IconMergeTool() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

function IconAdvanced() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconAi() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
}

/* ---------- AI / MCP Tab ---------- */

const AiTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => {
  const providerOptions = [
    { value: "none", label: "Disabled" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "openai", label: "OpenAI" },
    { value: "custom-mcp", label: "Custom MCP Server" },
  ];

  const modelOptions: Record<string, { value: string; label: string }[]> = {
    anthropic: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
    openai: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "o3-mini", label: "o3-mini" },
    ],
  };

  return (
    <div>
      <SectionTitle>AI Provider</SectionTitle>
      <SettingRow label="Provider" description="Select AI provider for code assistance features">
        <Select
          value={settings.aiProvider}
          options={providerOptions}
          onChange={(v) => onChange("aiProvider", v)}
        />
      </SettingRow>

      {settings.aiProvider !== "none" && (
        <>
          <SettingRow label="API Key" description="Your API key (stored locally)">
            <input
              type="password"
              value={settings.aiApiKey}
              onChange={(e) => onChange("aiApiKey", e.target.value)}
              placeholder="sk-..."
              style={{
                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                outline: "none", width: 220, fontFamily: "var(--font-mono, monospace)",
              }}
            />
          </SettingRow>

          {modelOptions[settings.aiProvider] && (
            <SettingRow label="Model" description="AI model to use for generation">
              <Select
                value={settings.aiModel || modelOptions[settings.aiProvider]?.[0]?.value || ""}
                options={modelOptions[settings.aiProvider]}
                onChange={(v) => onChange("aiModel", v)}
              />
            </SettingRow>
          )}

          {settings.aiProvider === "openai" && (
            <SettingRow label="Base URL" description="Custom API base URL (leave empty for default)">
              <input
                value={settings.aiBaseUrl}
                onChange={(e) => onChange("aiBaseUrl", e.target.value)}
                placeholder="https://api.openai.com"
                style={{
                  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 12,
                  outline: "none", width: 220, fontFamily: "var(--font-mono, monospace)",
                }}
              />
            </SettingRow>
          )}
        </>
      )}

      <SectionTitle>AI Features</SectionTitle>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        When an AI provider is configured, the following features become available:
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <div style={{ padding: "2px 0" }}>&#8226; Generate commit messages from staged changes</div>
        <div style={{ padding: "2px 0" }}>&#8226; AI-assisted merge conflict resolution</div>
        <div style={{ padding: "2px 0" }}>&#8226; Code review of commits</div>
        <div style={{ padding: "2px 0" }}>&#8226; PR description generation</div>
      </div>

      <SectionTitle>MCP Server</SectionTitle>
      <SettingRow
        label="Enable MCP Server"
        description="Expose git operations as MCP tools for AI assistants"
      >
        <Toggle
          checked={settings.mcpServerEnabled}
          onChange={(v) => onChange("mcpServerEnabled", v)}
        />
      </SettingRow>
      {settings.mcpServerEnabled && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
          Start with: <code style={{ fontSize: 11, color: "var(--accent)" }}>
            git-expansion --mcp-server --repo /path/to/repo
          </code>
        </div>
      )}
    </div>
  );
};
