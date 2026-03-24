import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui-store";
import { useAccountStore } from "../../store/account-store";
import { setAppLanguage } from "../../i18n";
import type { GitAccount, SshHostEntry } from "../../../shared/git-types";
import type { AppSettings, CommitTemplate, CommitSnippet } from "../../../shared/settings-types";

type Tab =
  | "general"
  | "accounts"
  | "git"
  | "fetch"
  | "commit"
  | "diff"
  | "mergetool"
  | "editor"
  | "advanced"
  | "ai";

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
  mode?: "overlay" | "window";
}

const TABS: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
  { id: "general", labelKey: "settings.general", icon: <IconSettings /> },
  { id: "accounts", labelKey: "settings.accounts", icon: <IconAccount /> },
  { id: "git", labelKey: "settings.gitConfig", icon: <IconGit /> },
  { id: "fetch", labelKey: "settings.fetchTab", icon: <IconFetch /> },
  { id: "commit", labelKey: "settings.commitTab", icon: <IconCommit /> },
  { id: "diff", labelKey: "settings.diffAndGraph", icon: <IconDiff /> },
  { id: "mergetool", labelKey: "settings.mergeTool", icon: <IconMergeTool /> },
  { id: "editor", labelKey: "settings.editorTab", icon: <IconEditor /> },
  { id: "advanced", labelKey: "settings.advanced", icon: <IconAdvanced /> },
  { id: "ai", labelKey: "settings.aiMcp", icon: <IconAi /> },
];

export const SettingsDialog: React.FC<Props> = ({ open, onClose, mode = "overlay" }) => {
  const { t } = useTranslation();
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
    // Sync theme with the currently active UI theme
    s.theme = useUIStore.getState().theme;
    setSettings(s);
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
      await window.electronAPI.settings.update(settings);
      // Apply theme
      useUIStore.getState().setTheme(settings.theme as "dark" | "light");
      // Apply language
      setAppLanguage(settings.language);
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
      style={
        mode === "window"
          ? {
              width: "100%",
              height: "100vh",
              display: "flex",
              alignItems: "stretch",
              justifyContent: "stretch",
            }
          : {
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              animation: "fade-in 0.15s ease-out",
            }
      }
      onClick={
        mode === "overlay"
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        style={
          mode === "window"
            ? {
                width: "100%",
                height: "100%",
                background: "var(--surface-1)",
                border: "none",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }
            : {
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
              }
        }
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
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {t("settings.title")}
          </span>
          {mode !== "window" && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
              }}
            >
              <svg
                width="14"
                height="14"
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
          )}
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
            {TABS.map((tabDef) => (
              <div
                key={tabDef.id}
                onClick={() => setTab(tabDef.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: tab === tabDef.id ? "var(--accent)" : "var(--text-secondary)",
                  background: tab === tabDef.id ? "var(--accent-dim)" : "transparent",
                  borderLeft:
                    tab === tabDef.id ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "all 0.1s",
                  fontWeight: tab === tabDef.id ? 600 : 400,
                }}
              >
                {tabDef.icon}
                {t(tabDef.labelKey)}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {settings && tab === "general" && (
              <GeneralTab settings={settings} onChange={updateSetting} />
            )}
            {tab === "accounts" && <AccountsTab mode={mode} />}
            {tab === "git" && gitConfig && globalConfig && (
              <GitConfigTab local={gitConfig} global={globalConfig} onSave={handleSaveGitConfig} />
            )}
            {settings && tab === "fetch" && (
              <FetchTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "commit" && (
              <CommitTab settings={settings} onChange={updateSetting} />
            )}
            {settings && tab === "diff" && <DiffTab settings={settings} onChange={updateSetting} />}
            {settings && tab === "mergetool" && (
              <MergeToolTab
                settings={settings}
                onChange={updateSetting}
                onBatchChange={updateSettings}
              />
            )}
            {settings && tab === "editor" && (
              <EditorTab
                settings={settings}
                onChange={updateSetting}
                onBatchChange={updateSettings}
              />
            )}
            {settings && tab === "advanced" && (
              <AdvancedTab
                settings={settings}
                onChange={updateSetting}
                onResetSettings={async () => {
                  if (!confirm(t("settings.resetConfirm"))) return;
                  const defaults = await window.electronAPI.settings.reset();
                  setSettings(defaults);
                  useUIStore.getState().setTheme(defaults.theme as "dark" | "light");
                  setDirty(false);
                }}
                onClearAllData={async () => {
                  if (!confirm(t("settings.clearAllConfirm"))) return;
                  await window.electronAPI.settings.clearAll();
                  window.location.reload();
                }}
              />
            )}
            {settings && tab === "ai" && <AiTab settings={settings} onChange={updateSetting} />}
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
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t("settings.close")}
          </button>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "7px 18px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent)",
                color: "var(--text-on-color)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving ? t("settings.saving") : t("settings.saveSettings")}
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

const GeneralTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();
  const handleBrowseGit = async () => {
    const selected = await window.electronAPI.repo.browseFile("Select Git executable");
    if (selected) onChange("gitBinaryPath", selected);
  };

  return (
    <div>
      <SectionTitle>{t("settings.appearance")}</SectionTitle>
      <SettingRow label={t("settings.theme")} description={t("settings.themeDescription")}>
        <Select
          value={settings.theme}
          options={[
            { value: "dark", label: t("settings.darkTheme") },
            { value: "light", label: t("settings.lightTheme") },
          ]}
          onChange={(v) => onChange("theme", v as "dark" | "light")}
        />
      </SettingRow>
      <SettingRow label={t("settings.language")} description={t("settings.languageDescription")}>
        <Select
          value={settings.language}
          options={[
            { value: "en", label: t("settings.languageEnglish") },
            { value: "it", label: t("settings.languageItalian") },
            { value: "es", label: t("settings.languageSpanish") },
            { value: "fr", label: t("settings.languageFrench") },
            { value: "de", label: t("settings.languageGerman") },
          ]}
          onChange={(v) => onChange("language", v)}
        />
      </SettingRow>
      <SectionTitle>{t("settings.git")}</SectionTitle>
      <SettingRow
        label={t("settings.gitBinaryPath")}
        description={t("settings.gitBinaryPathDescription")}
      >
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            value={settings.gitBinaryPath}
            onChange={(e) => onChange("gitBinaryPath", e.target.value)}
            placeholder={t("settings.gitPlaceholder")}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              outline: "none",
              width: 220,
              fontFamily: "var(--font-mono, monospace)",
            }}
          />
          <button
            onClick={handleBrowseGit}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {t("dialogs.browse")}
          </button>
        </div>
      </SettingRow>
      <SectionTitle>{t("settings.notifications")}</SectionTitle>
      <SettingRow
        label={t("settings.enableDesktopNotifications")}
        description={t("settings.showNativeNotifications")}
      >
        <Toggle
          checked={settings.notifications?.enabled ?? true}
          onChange={(v) => onChange("notifications", { ...settings.notifications, enabled: v })}
        />
      </SettingRow>
      {settings.notifications?.enabled && (
        <>
          <SettingRow
            label={t("settings.onFetch")}
            description={t("settings.notifyOnFetchDescription")}
          >
            <Toggle
              checked={settings.notifications?.onFetch ?? true}
              onChange={(v) => onChange("notifications", { ...settings.notifications, onFetch: v })}
            />
          </SettingRow>
          <SettingRow
            label={t("settings.onPush")}
            description={t("settings.notifyOnPushDescription")}
          >
            <Toggle
              checked={settings.notifications?.onPush ?? true}
              onChange={(v) => onChange("notifications", { ...settings.notifications, onPush: v })}
            />
          </SettingRow>
          <SettingRow
            label={t("settings.onError")}
            description={t("settings.notifyOnErrorDescription")}
          >
            <Toggle
              checked={settings.notifications?.onError ?? true}
              onChange={(v) => onChange("notifications", { ...settings.notifications, onError: v })}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
};

const FetchTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <SectionTitle>{t("settings.autoFetch")}</SectionTitle>
      <SettingRow
        label={t("settings.enableAutoFetch")}
        description={t("settings.autoFetchDescription")}
      >
        <Toggle
          checked={settings.autoFetchEnabled}
          onChange={(v) => onChange("autoFetchEnabled", v)}
        />
      </SettingRow>
      {settings.autoFetchEnabled && (
        <>
          <SettingRow
            label={t("settings.fetchInterval")}
            description={t("settings.timeBetweenFetches")}
          >
            <Select
              value={String(settings.autoFetchInterval)}
              options={[
                { value: "60", label: t("settings.oneMinute") },
                { value: "120", label: t("settings.twoMinutes") },
                { value: "300", label: t("settings.fiveMinutes") },
                { value: "600", label: t("settings.tenMinutes") },
                { value: "1800", label: t("settings.thirtyMinutes") },
              ]}
              onChange={(v) => onChange("autoFetchInterval", Number(v))}
            />
          </SettingRow>
          <SettingRow
            label={t("settings.pruneOnAutoFetch")}
            description={t("settings.removeRemoteTrackingBranches")}
          >
            <Toggle
              checked={settings.fetchPruneOnAuto}
              onChange={(v) => onChange("fetchPruneOnAuto", v)}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
};

const CommitTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();
  const templates = settings.commitTemplates || [];
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<CommitTemplate>({
    name: "",
    prefix: "",
    body: "",
    description: "",
  });

  const startAdd = () => {
    setDraft({ name: "", prefix: "", body: "", description: "" });
    setEditing(-1);
  };

  const startEdit = (idx: number) => {
    setDraft({ ...templates[idx]! });
    setEditing(idx);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const updated = [...templates];
    if (editing === -1) {
      updated.push({ ...draft });
    } else if (editing !== null) {
      updated[editing] = { ...draft };
    }
    onChange("commitTemplates", updated);
    setEditing(null);
  };

  const remove = (idx: number) => {
    const updated = templates.filter((_, i) => i !== idx);
    onChange("commitTemplates", updated);
    if (editing === idx) setEditing(null);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...templates];
    [updated[idx - 1], updated[idx]] = [updated[idx]!, updated[idx - 1]!];
    onChange("commitTemplates", updated);
  };

  const moveDown = (idx: number) => {
    if (idx >= templates.length - 1) return;
    const updated = [...templates];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1]!, updated[idx]!];
    onChange("commitTemplates", updated);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-0)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div>
      <SectionTitle>{t("settings.commitSection")}</SectionTitle>
      <SettingRow
        label={t("settings.signCommits")}
        description={t("settings.signCommitsDescription")}
      >
        <Toggle checked={settings.signCommits} onChange={(v) => onChange("signCommits", v)} />
      </SettingRow>
      <SettingRow
        label={t("settings.defaultCommitTemplate")}
        description={t("settings.defaultCommitTemplateDescription")}
      >
        <textarea
          value={settings.defaultCommitTemplate}
          onChange={(e) => onChange("defaultCommitTemplate", e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 12,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
          placeholder={t("settings.templatePrefixPlaceholder")}
        />
      </SettingRow>

      <SectionTitle>{t("settings.commitTemplates")}</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {t("settings.templateCustomizable")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {templates.map((tpl, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              borderRadius: 6,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 12, minWidth: 70 }}>{tpl.name}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tpl.prefix}
              {tpl.description ? ` — ${tpl.description}` : ""}
            </span>
            <button onClick={() => moveUp(idx)} style={iconBtnStyle} title="Move up">
              &#9650;
            </button>
            <button onClick={() => moveDown(idx)} style={iconBtnStyle} title="Move down">
              &#9660;
            </button>
            <button onClick={() => startEdit(idx)} style={iconBtnStyle} title="Edit">
              &#9998;
            </button>
            <button
              onClick={() => remove(idx)}
              style={{ ...iconBtnStyle, color: "var(--danger)" }}
              title="Delete"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-1)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("settings.templateNamePlaceholder")}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={draft.prefix}
              onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
              placeholder={t("settings.templatePrefixInputPlaceholder")}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder={t("settings.templateDescriptionPlaceholder")}
            style={inputStyle}
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder={t("settings.templateBodyPlaceholder")}
            rows={2}
            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => setEditing(null)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {t("dialogs.cancel")}
            </button>
            <button
              onClick={saveDraft}
              disabled={!draft.name.trim()}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
                opacity: draft.name.trim() ? 1 : 0.5,
              }}
            >
              {editing === -1 ? t("dialogs.add") : t("dialogs.save")}
            </button>
          </div>
        </div>
      )}

      {editing === null && (
        <button
          onClick={startAdd}
          style={{
            marginTop: 8,
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {t("settings.addTemplate")}
        </button>
      )}

      <SectionTitle>{t("settings.commitSnippets")}</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {t("settings.snippetInsertable")}
      </div>
      <SnippetManager
        snippets={settings.commitSnippets || []}
        onChange={(s) => onChange("commitSnippets", s)}
      />
    </div>
  );
};

const SnippetManager: React.FC<{
  snippets: CommitSnippet[];
  onChange: (s: CommitSnippet[]) => void;
}> = ({ snippets, onChange }) => {
  const { t } = useTranslation();
  const [addLabel, setAddLabel] = useState("");
  const [addText, setAddText] = useState("");
  const inputStyle: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-0)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {snippets.map((snip, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 12, minWidth: 90 }}>{snip.label}</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              flex: 1,
              fontFamily: "var(--font-mono, monospace)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {snip.text}
          </span>
          <button
            onClick={() => onChange(snippets.filter((_, i) => i !== idx))}
            style={{ ...iconBtnStyle, color: "var(--danger)" }}
            title="Delete"
          >
            &#10005;
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <input
          value={addLabel}
          onChange={(e) => setAddLabel(e.target.value)}
          placeholder={t("settings.snippetLabelPlaceholder")}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          placeholder={t("settings.snippetTextPlaceholder")}
          style={{ ...inputStyle, flex: 2 }}
        />
        <button
          onClick={() => {
            if (addLabel.trim() && addText.trim()) {
              onChange([...snippets, { label: addLabel.trim(), text: addText }]);
              setAddLabel("");
              setAddText("");
            }
          }}
          disabled={!addLabel.trim() || !addText.trim()}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 11,
            cursor: "pointer",
            opacity: addLabel.trim() && addText.trim() ? 1 : 0.5,
          }}
        >
          {t("dialogs.add")}
        </button>
      </div>
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 11,
  padding: "2px 4px",
  borderRadius: 4,
  lineHeight: 1,
};

const DiffTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <SectionTitle>{t("settings.diffSection")}</SectionTitle>
      <SettingRow label={t("settings.defaultView")} description={t("settings.defaultDiffFormat")}>
        <Select
          value={settings.preferSideBySideDiff ? "split" : "unified"}
          options={[
            { value: "unified", label: t("settings.unifiedLineByLine") },
            { value: "split", label: t("settings.splitSideBySide") },
          ]}
          onChange={(v) => onChange("preferSideBySideDiff", v === "split")}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.contextLines")}
        description={t("settings.contextLinesDescription")}
      >
        <NumberInput
          value={settings.diffContextLines}
          min={0}
          max={20}
          onChange={(v) => onChange("diffContextLines", v)}
        />
      </SettingRow>
      <SectionTitle>{t("settings.graphSection")}</SectionTitle>
      <SettingRow
        label={t("settings.initialLoadCount")}
        description={t("settings.commitsOnFirstOpen")}
      >
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
      <SettingRow
        label={t("settings.showRemoteBranches")}
        description={t("settings.showRemoteBranchesDescription")}
      >
        <Toggle
          checked={settings.showRemoteBranchesInGraph}
          onChange={(v) => onChange("showRemoteBranchesInGraph", v)}
        />
      </SettingRow>
    </div>
  );
};

const MERGE_TOOL_PRESETS: {
  name: string;
  labelKey?: string;
  label?: string;
  path: string;
  args: string;
}[] = [
  { name: "", labelKey: "settings.noneUseInternalEditor", path: "", args: "" },
  {
    name: "kdiff3",
    label: "KDiff3",
    path: "kdiff3",
    args: '"$BASE" "$LOCAL" "$REMOTE" -o "$MERGED"',
  },
  {
    name: "meld",
    label: "Meld",
    path: "meld",
    args: '"$LOCAL" "$BASE" "$REMOTE" -o "$MERGED"',
  },
  {
    name: "beyondcompare",
    label: "Beyond Compare",
    path: "bcomp",
    args: '"$LOCAL" "$REMOTE" "$BASE" "$MERGED"',
  },
  {
    name: "p4merge",
    label: "P4Merge",
    path: "p4merge",
    args: '"$BASE" "$LOCAL" "$REMOTE" "$MERGED"',
  },
  {
    name: "vscode",
    label: "VS Code",
    path: "code",
    args: '--wait --merge "$LOCAL" "$REMOTE" "$BASE" "$MERGED"',
  },
  {
    name: "tortoisegitmerge",
    label: "TortoiseGitMerge",
    path: "TortoiseGitMerge",
    args: '-base:"$BASE" -theirs:"$REMOTE" -mine:"$LOCAL" -merged:"$MERGED"',
  },
  {
    name: "winmerge",
    label: "WinMerge",
    path: "WinMergeU",
    args: '"$LOCAL" "$REMOTE" "$MERGED"',
  },
  { name: "custom", labelKey: "settings.custom", path: "", args: "" },
];

const MergeToolTab: React.FC<{
  settings: AppSettings;
  onChange: OnChange;
  onBatchChange: (partial: Partial<AppSettings>) => void;
}> = ({ settings, onChange, onBatchChange }) => {
  const { t } = useTranslation();
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
      <SectionTitle>{t("settings.externalMergeTool")}</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("settings.mergeToolConfigDescription")}
      </div>
      <SettingRow
        label={t("settings.mergeToolLabel")}
        description={t("settings.mergeToolSelectPreset")}
      >
        <Select
          value={settings.mergeToolName}
          options={MERGE_TOOL_PRESETS.map((p) => ({
            value: p.name,
            label: p.labelKey ? t(p.labelKey) : p.label!,
          }))}
          onChange={handlePresetChange}
        />
      </SettingRow>
      {hasToolConfigured && (
        <>
          <SettingRow
            label={t("settings.executablePath")}
            description={t("settings.executablePathDescription")}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                value={settings.mergeToolPath}
                onChange={(e) => onChange("mergeToolPath", e.target.value)}
                placeholder={t("settings.executablePathPlaceholder")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                  width: 220,
                }}
              />
              {isCustom && (
                <button
                  onClick={handleBrowse}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {t("dialogs.browse")}
                </button>
              )}
            </div>
          </SettingRow>
          <SettingRow
            label={t("settings.arguments")}
            description={t("settings.argumentsDescription")}
          >
            <input
              value={settings.mergeToolArgs}
              onChange={(e) => onChange("mergeToolArgs", e.target.value)}
              placeholder={t("settings.argumentsPlaceholder")}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
                width: 340,
                fontFamily: "var(--font-mono, monospace)",
              }}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
};

const EDITOR_PRESETS: {
  name: string;
  labelKey?: string;
  label?: string;
  path: string;
  args: string;
}[] = [
  { name: "", labelKey: "settings.editorNone", path: "", args: "$FILE" },
  { name: "vscode", label: "VS Code", path: "code", args: "$FILE" },
  { name: "vscode-insiders", label: "VS Code Insiders", path: "code-insiders", args: "$FILE" },
  { name: "cursor", label: "Cursor", path: "cursor", args: "$FILE" },
  { name: "custom", labelKey: "settings.editorPresetCustom", path: "", args: "$FILE" },
];

const EditorTab: React.FC<{
  settings: AppSettings;
  onChange: OnChange;
  onBatchChange: (partial: Partial<AppSettings>) => void;
}> = ({ settings, onChange, onBatchChange }) => {
  const { t } = useTranslation();

  const handlePresetChange = (presetName: string) => {
    const preset = EDITOR_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    if (preset.name === "custom") {
      onBatchChange({ editorName: "custom" });
    } else {
      onBatchChange({
        editorName: preset.name,
        editorPath: preset.path,
        editorArgs: preset.args,
      });
    }
  };

  const handleBrowse = async () => {
    const selected = await window.electronAPI.repo.browseFile(
      t("settings.editorPath")
    );
    if (selected) onChange("editorPath", selected);
  };

  const isCustom = settings.editorName === "custom";
  const hasEditorConfigured = settings.editorName !== "";

  return (
    <div>
      <SectionTitle>{t("settings.editorTab")}</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("settings.editorDescription")}
      </div>
      <SettingRow
        label={t("settings.editorPreset")}
        description={t("settings.editorSelectPreset")}
      >
        <Select
          value={settings.editorName}
          options={EDITOR_PRESETS.map((p) => ({
            value: p.name,
            label: p.labelKey ? t(p.labelKey) : p.label!,
          }))}
          onChange={handlePresetChange}
        />
      </SettingRow>
      {hasEditorConfigured && (
        <>
          <SettingRow
            label={t("settings.editorPath")}
            description={t("settings.editorPathDescription")}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                value={settings.editorPath}
                onChange={(e) => onChange("editorPath", e.target.value)}
                placeholder={t("settings.editorPathPlaceholder")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                  width: 220,
                }}
                readOnly={!isCustom}
              />
              {isCustom && (
                <button
                  onClick={handleBrowse}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {t("dialogs.browse")}
                </button>
              )}
            </div>
          </SettingRow>
          <SettingRow
            label={t("settings.editorArgs")}
            description={t("settings.editorArgsDescription")}
          >
            <input
              value={settings.editorArgs}
              onChange={(e) => onChange("editorArgs", e.target.value)}
              placeholder="$FILE"
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
                width: 340,
                fontFamily: "var(--font-mono, monospace)",
              }}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
};

const AdvancedTab: React.FC<{
  settings: AppSettings;
  onChange: OnChange;
  onResetSettings?: () => void;
  onClearAllData?: () => void;
}> = ({ settings, onChange, onResetSettings, onClearAllData }) => {
  const { t } = useTranslation();
  return (
    <div>
      <SectionTitle>{t("settings.performance")}</SectionTitle>
      <SettingRow
        label={t("settings.maxConcurrentGitProcesses")}
        description={t("settings.maxConcurrentDescription")}
      >
        <NumberInput
          value={settings.maxConcurrentGitProcesses}
          min={1}
          max={20}
          onChange={(v) => onChange("maxConcurrentGitProcesses", v)}
        />
      </SettingRow>

      <SectionTitle>{t("settings.data")}</SectionTitle>
      <SettingRow
        label={t("settings.resetSettingsLabel")}
        description={t("settings.resetSettingsDescription")}
      >
        <button
          onClick={onResetSettings}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {t("settings.resetSettingsButton")}
        </button>
      </SettingRow>
      <SettingRow
        label={t("settings.clearAllData")}
        description={t("settings.clearAllDataDescription")}
      >
        <button
          onClick={onClearAllData}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--red, #e06c75)",
            background: "transparent",
            color: "var(--red, #e06c75)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {t("settings.clearAllDataButton")}
        </button>
      </SettingRow>
    </div>
  );
};

const GitConfigTab: React.FC<{
  local: GitConfig;
  global: GitConfig;
  onSave: (key: string, value: string, global: boolean) => Promise<void>;
}> = ({ local, global, onSave }) => {
  const { t } = useTranslation();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editGlobal, setEditGlobal] = useState(false);

  const importantKeys = [
    { key: "user.name", label: t("settings.userName") },
    { key: "user.email", label: t("settings.userEmail") },
    { key: "core.autocrlf", label: t("settings.autoCrlf") },
    { key: "core.editor", label: t("settings.defaultEditor") },
    { key: "pull.rebase", label: t("settings.pullRebase") },
    { key: "push.default", label: t("settings.pushDefault") },
    { key: "merge.ff", label: t("settings.mergeFf") },
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
      <SectionTitle>{t("settings.userIdentityGlobal")}</SectionTitle>
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
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--accent)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  width: 200,
                  outline: "none",
                }}
              />
              <button
                onClick={saveEdit}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text-on-color)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("dialogs.save")}
              </button>
              <button
                onClick={() => setEditKey(null)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {t("dialogs.cancel")}
              </button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(key, true)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                cursor: "pointer",
                minWidth: 200,
                minHeight: 24,
              }}
              title="Click to edit"
            >
              {global[key] || (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  {t("settings.notSet")}
                </span>
              )}
            </div>
          )}
        </SettingRow>
      ))}

      <SectionTitle>{t("settings.repositoryConfig")}</SectionTitle>
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
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--accent)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  width: 200,
                  outline: "none",
                }}
              />
              <button
                onClick={saveEdit}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text-on-color)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("dialogs.save")}
              </button>
              <button
                onClick={() => setEditKey(null)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {t("dialogs.cancel")}
              </button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(key, false)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                cursor: "pointer",
                minWidth: 200,
                minHeight: 24,
              }}
              title="Click to edit"
            >
              {local[key] || global[key] || (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  {t("settings.notSet")}
                </span>
              )}
            </div>
          )}
        </SettingRow>
      ))}
    </div>
  );
};

/* ---------- Shared UI primitives ---------- */

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--text-muted)",
      marginBottom: 10,
      marginTop: 16,
      paddingBottom: 6,
      borderBottom: "1px solid var(--border-subtle)",
    }}
  >
    {children}
  </div>
);

const SettingRow: React.FC<{
  label: string;
  description: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "8px 0",
    }}
  >
    <div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{description}</div>
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: 36,
      height: 20,
      borderRadius: 10,
      cursor: "pointer",
      background: checked ? "var(--accent)" : "var(--surface-3)",
      transition: "background 0.2s",
      position: "relative",
    }}
  >
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "var(--text-on-color)",
        position: "absolute",
        top: 2,
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
      padding: "4px 8px",
      borderRadius: 6,
      border: "1px solid var(--border)",
      background: "var(--surface-0)",
      color: "var(--text-primary)",
      fontSize: 12,
      outline: "none",
      cursor: "pointer",
      minWidth: 160,
    }}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const NumberInput: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ value, min, max, onChange }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{
      padding: "4px 8px",
      borderRadius: 6,
      border: "1px solid var(--border)",
      background: "var(--surface-0)",
      color: "var(--text-primary)",
      fontSize: 12,
      outline: "none",
      width: 80,
      textAlign: "center",
    }}
  />
);

/* ---------- Tab icons ---------- */

function IconSettings() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconGit() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function IconFetch() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCommit() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="1.05" y1="12" x2="7" y2="12" />
      <line x1="17.01" y1="12" x2="22.96" y2="12" />
    </svg>
  );
}

function IconDiff() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function IconMergeTool() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

function IconEditor() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconAdvanced() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconAi() {
  return (
    <svg
      width="13"
      height="13"
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
  );
}

function IconAccount() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ---------- AI / MCP Tab ---------- */

const AiTab: React.FC<{ settings: AppSettings; onChange: OnChange }> = ({ settings, onChange }) => {
  const { t } = useTranslation();
  const providerOptions = [
    { value: "none", label: t("settings.disabled") },
    { value: "anthropic", label: t("settings.anthropicClaude") },
    { value: "openai", label: t("settings.openai") },
    { value: "gemini", label: t("settings.googleGemini") },
    { value: "custom-mcp", label: t("settings.customMcpServer") },
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
    gemini: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  };

  return (
    <div>
      <SectionTitle>{t("settings.aiProviderSection")}</SectionTitle>
      <SettingRow label={t("settings.provider")} description={t("settings.providerDescription")}>
        <Select
          value={settings.aiProvider}
          options={providerOptions}
          onChange={(v) =>
            onChange("aiProvider", v as "none" | "anthropic" | "openai" | "gemini" | "custom-mcp")
          }
        />
      </SettingRow>

      {settings.aiProvider !== "none" && (
        <>
          <SettingRow label={t("settings.apiKey")} description={t("settings.apiKeyDescription")}>
            <input
              type="password"
              value={settings.aiApiKey}
              onChange={(e) => onChange("aiApiKey", e.target.value)}
              placeholder="sk-..."
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
                width: 220,
                fontFamily: "var(--font-mono, monospace)",
              }}
            />
          </SettingRow>

          {modelOptions[settings.aiProvider] && (
            <SettingRow label={t("settings.model")} description={t("settings.modelDescription")}>
              <Select
                value={settings.aiModel || modelOptions[settings.aiProvider]?.[0]?.value || ""}
                options={modelOptions[settings.aiProvider] ?? []}
                onChange={(v) => onChange("aiModel", v)}
              />
            </SettingRow>
          )}

          {settings.aiProvider === "openai" && (
            <SettingRow
              label={t("settings.baseUrl")}
              description={t("settings.baseUrlDescription")}
            >
              <input
                value={settings.aiBaseUrl}
                onChange={(e) => onChange("aiBaseUrl", e.target.value)}
                placeholder="https://api.openai.com"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                  width: 220,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            </SettingRow>
          )}
        </>
      )}

      <SectionTitle>{t("settings.aiFeatures")}</SectionTitle>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {t("settings.aiFeaturesDescription")}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        <div style={{ padding: "2px 0" }}>&#8226; {t("settings.aiFeaturesItem1")}</div>
        <div style={{ padding: "2px 0" }}>&#8226; {t("settings.aiFeaturesItem2")}</div>
        <div style={{ padding: "2px 0" }}>&#8226; {t("settings.aiFeaturesItem3")}</div>
        <div style={{ padding: "2px 0" }}>&#8226; {t("settings.aiFeaturesItem4")}</div>
      </div>

      <SectionTitle>{t("settings.mcpServer")}</SectionTitle>
      <SettingRow
        label={t("settings.enableMcpServer")}
        description={t("settings.enableMcpServerDescription")}
      >
        <Toggle
          checked={settings.mcpServerEnabled}
          onChange={(v) => onChange("mcpServerEnabled", v)}
        />
      </SettingRow>
      {settings.mcpServerEnabled && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {t("settings.mcpStartWith")}{" "}
          <code style={{ fontSize: 11, color: "var(--accent)" }}>
            gitsmith --mcp-server --repo /path/to/repo
          </code>
        </div>
      )}
    </div>
  );
};

/* ---------- Accounts Tab ---------- */

const emptyAccount = {
  label: "",
  name: "",
  email: "",
  signingKey: "",
  sshKeyPath: "",
  platformToken: "",
};

const AccountsTab: React.FC<{ mode?: "overlay" | "window" }> = ({ mode = "overlay" }) => {
  const { t } = useTranslation();
  const { accounts, loadAccounts, addAccount, updateAccount, deleteAccount } = useAccountStore();
  const [form, setForm] = useState(emptyAccount);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sshEntries, setSshEntries] = useState<SshHostEntry[] | null>(null);
  const [showSshImport, setShowSshImport] = useState(false);

  useEffect(() => {
    if (mode === "overlay") {
      loadAccounts();
    }
  }, [mode, loadAccounts]);

  const handleLoadSshConfig = async () => {
    const entries = await window.electronAPI.account.parseSshConfig();
    setSshEntries(entries);
    setShowSshImport(true);
  };

  const handleImportSshEntry = (entry: SshHostEntry) => {
    setForm({
      label: entry.host,
      name: "",
      email: "",
      signingKey: "",
      sshKeyPath: entry.identityFile || "",
      platformToken: "",
    });
    setEditingId(null);
    setShowForm(true);
    setShowSshImport(false);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.name.trim() || !form.email.trim()) return;
    if (editingId) {
      await updateAccount(editingId, form);
      setEditingId(null);
    } else {
      await addAccount(form);
    }
    setForm(emptyAccount);
    setShowForm(false);
  };

  const handleEdit = (account: GitAccount) => {
    setEditingId(account.id);
    setForm({
      label: account.label,
      name: account.name,
      email: account.email,
      signingKey: account.signingKey || "",
      sshKeyPath: account.sshKeyPath || "",
      platformToken: account.platformToken || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyAccount);
    setShowForm(false);
  };

  const handleBrowseSshKey = async () => {
    const selected = await window.electronAPI.repo.browseFile("Select SSH Private Key");
    if (selected) setForm({ ...form, sshKeyPath: selected });
  };

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-0)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      <SectionTitle>{t("settings.gitAccounts")}</SectionTitle>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        {t("settings.gitAccountsDescription")}
      </div>

      {accounts.length === 0 && !showForm && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          {t("settings.noAccountsConfigured")}
        </div>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            marginBottom: 4,
            borderRadius: 6,
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              {account.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {account.name} &lt;{account.email}&gt;
              {account.sshKeyPath && (
                <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                  SSH: {account.sshKeyPath.split(/[\\/]/).pop()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleEdit(account)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {t("dialogs.edit")}
          </button>
          <button
            onClick={() => handleDelete(account.id)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--error, #f38ba8)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {t("dialogs.delete")}
          </button>
        </div>
      ))}

      {showForm ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 10,
            }}
          >
            {editingId ? t("settings.editAccount") : t("settings.newAccount")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                {t("settings.labelRequired")}
              </label>
              <input
                style={inputStyle}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Work, Personal"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                {t("settings.nameRequired")}
              </label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                {t("settings.emailRequired")}
              </label>
              <input
                style={inputStyle}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                {t("settings.signingKey")}
              </label>
              <input
                style={inputStyle}
                value={form.signingKey}
                onChange={(e) => setForm({ ...form, signingKey: e.target.value })}
                placeholder="GPG key ID (optional)"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                {t("settings.sshPrivateKey")}
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.sshKeyPath}
                  onChange={(e) => setForm({ ...form, sshKeyPath: e.target.value })}
                  placeholder="~/.ssh/id_ed25519 (optional)"
                />
                <button
                  onClick={handleBrowseSshKey}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-1)",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("dialogs.browse")}
                </button>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {t("settings.platformToken")}
              </label>
              <input
                style={inputStyle}
                type="password"
                value={form.platformToken}
                onChange={(e) => setForm({ ...form, platformToken: e.target.value })}
                placeholder="ghp_... or glpat-... (optional)"
              />
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {t("settings.platformTokenDescription")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleCancel}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("dialogs.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.label.trim() || !form.name.trim() || !form.email.trim()}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent)",
                color: "var(--text-on-color)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                opacity: !form.label.trim() || !form.name.trim() || !form.email.trim() ? 0.5 : 1,
              }}
            >
              {editingId ? t("settings.update") : t("settings.addAccountButton")}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm(emptyAccount);
            }}
            style={{
              flex: 1,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--accent)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t("settings.addAccountLabel")}
          </button>
          <button
            onClick={handleLoadSshConfig}
            style={{
              flex: 1,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t("settings.importFromSshConfig")}
          </button>
        </div>
      )}

      {/* SSH Import panel */}
      {showSshImport && sshEntries !== null && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-0)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("settings.sshConfigEntries")}
            </div>
            <button
              onClick={() => setShowSshImport(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {t("dialogs.close")}
            </button>
          </div>
          {sshEntries.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                padding: "8px 0",
                textAlign: "center",
              }}
            >
              {t("settings.noSshHostEntries")}
            </div>
          ) : (
            sshEntries.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  marginBottom: 3,
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.host}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {entry.hostName && <span>{entry.hostName} </span>}
                    <span style={{ color: "var(--text-muted)" }}>
                      Key: {entry.identityFile?.split(/[\\/]/).pop()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleImportSshEntry(entry)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 4,
                    border: "none",
                    background: "var(--accent)",
                    color: "var(--text-on-color)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("settings.import")}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
