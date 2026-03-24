# Editor Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable external editor (VS Code, Insiders, Cursor, custom) with preset system, so users can open repos and files from the app.

**Architecture:** Extends existing AppSettings with 3 new fields. New IPC handler file `editor.ipc.ts` spawns the editor process detached. UI surfaces the action in Tools menu, toolbar button, and shared FileContextMenu. Uses existing `SectionTitle`, `SettingRow`, `Select` components for UI consistency.

**Tech Stack:** Electron IPC, child_process.spawn, React, i18n (5 locales)

**Spec:** `docs/superpowers/specs/2026-03-23-editor-integration-design.md`

**Key codebase patterns:**
- Settings type: `OnChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void` (line 355 of SettingsDialog)
- Settings update functions: `updateSetting` / `updateSettings` (lines 84-94 of SettingsDialog)
- Layout components: `SectionTitle`, `SettingRow`, `Select` (used by all tabs)
- i18n nesting: keys live under `"settings"`, `"menu"`, `"toolbar"`, `"fileContextMenu"` top-level objects
- Browse file: `window.electronAPI.repo.browseFile()` for executables (see GeneralTab line 363)

---

### Task 1: Settings Types & Store Defaults

**Files:**
- Modify: `src/shared/settings-types.ts:50` (after mergeToolArgs)
- Modify: `src/main/store.ts:120` (after mergeToolArgs default)

- [ ] **Step 1: Add editor fields to AppSettings interface**

In `src/shared/settings-types.ts`, after line 50 (`mergeToolArgs`), add:

```typescript
  // Editor Integration
  editorName: string; // preset name or "custom"
  editorPath: string; // executable name (preset) or absolute path (custom)
  editorArgs: string; // argument pattern, $FILE placeholder
```

- [ ] **Step 2: Add defaults to store.ts**

In `src/main/store.ts`, after line 120 (`mergeToolArgs: ""`), add:

```typescript
  editorName: "",
  editorPath: "",
  editorArgs: "$FILE",
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to editor fields.

- [ ] **Step 4: Commit**

```bash
git add src/shared/settings-types.ts src/main/store.ts
git commit --no-verify -m "feat(settings): add editor integration fields to AppSettings"
```

---

### Task 2: IPC Channels

**Files:**
- Modify: `src/shared/ipc-channels.ts:179-183` (SHELL section — remove dead channel, add EDITOR section)

- [ ] **Step 1: Remove unused SHELL.OPEN_FILE_IN_EDITOR**

In `src/shared/ipc-channels.ts`, change the SHELL section (line 179-183) from:

```typescript
  SHELL: {
    OPEN_FILE: "shell:open-file",
    SHOW_IN_FOLDER: "shell:show-in-folder",
    OPEN_FILE_IN_EDITOR: "shell:open-file-in-editor",
  },
```

to:

```typescript
  SHELL: {
    OPEN_FILE: "shell:open-file",
    SHOW_IN_FOLDER: "shell:show-in-folder",
  },
```

- [ ] **Step 2: Add EDITOR channels**

Add a new EDITOR section right after the SHELL section. Use `"editor:"` prefix (consistent with `"shell:"` and `"terminal:"` — non-git operations don't use `"git:"` prefix):

```typescript
  EDITOR: {
    LAUNCH: "editor:launch",
    LAUNCH_FILE: "editor:launch-file",
  },
```

- [ ] **Step 3: Verify no code references the removed channel**

Run: `grep -r "OPEN_FILE_IN_EDITOR" src/` — should return no results.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc-channels.ts
git commit --no-verify -m "feat(ipc): add EDITOR channels, remove unused SHELL.OPEN_FILE_IN_EDITOR"
```

---

### Task 3: Editor IPC Handler

**Files:**
- Create: `src/main/ipc/editor.ipc.ts`
- Modify: `src/main/ipc/index.ts` (import + register)

- [ ] **Step 1: Create editor.ipc.ts**

Create `src/main/ipc/editor.ipc.ts`:

```typescript
import { ipcMain } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { IPC } from "../../shared/ipc-channels";
import { getSettings } from "../store";
import { gitService } from "../git/git-service";

const ALLOWED_ARGS = /^[\w\s"'\-/\\.=:$]*$/;

function validateEditorPath(editorPath: string): void {
  if (!editorPath) {
    throw new Error("No editor configured");
  }
  if (path.isAbsolute(editorPath)) {
    try {
      fs.accessSync(editorPath, fs.constants.F_OK);
    } catch {
      throw new Error(`Editor not found: ${editorPath}`);
    }
  }
  // Bare executable names (presets like "code") rely on PATH — spawn emits ENOENT if missing
}

function validateArgs(argsPattern: string): void {
  const stripped = argsPattern.replace(/\$FILE/g, "");
  if (!ALLOWED_ARGS.test(stripped)) {
    throw new Error("Editor arguments contain invalid characters");
  }
}

function spawnDetached(executable: string, args: string[]): void {
  const proc = spawn(executable, args, {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  proc.on("error", (err) => {
    console.error(`Failed to launch editor: ${err.message}`);
  });
  proc.unref();
}

export function registerEditorHandlers() {
  ipcMain.handle(IPC.EDITOR.LAUNCH, async (_event, repoPath: string) => {
    const { editorPath } = getSettings();
    validateEditorPath(editorPath);
    spawnDetached(editorPath, [repoPath]);
  });

  ipcMain.handle(IPC.EDITOR.LAUNCH_FILE, async (_event, filePath: string) => {
    const { editorPath, editorArgs } = getSettings();
    validateEditorPath(editorPath);
    validateArgs(editorArgs);

    const repoPath = gitService.getRepoPath();
    if (!repoPath) throw new Error("No repository open");

    const absolutePath = path.resolve(repoPath, filePath);

    const resolvedArgs = editorArgs.includes("$FILE")
      ? editorArgs.replace(/\$FILE/g, absolutePath)
      : `"${absolutePath}"`;

    const args =
      resolvedArgs.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, "")) || [];

    spawnDetached(editorPath, args);
  });
}
```

Note: `shell: process.platform === "win32"` is needed on Windows so bare executable names like `code` are resolved via PATH (Windows doesn't search PATH for spawn without shell).

- [ ] **Step 2: Register in ipc/index.ts**

In `src/main/ipc/index.ts`, add import after line 10 (`registerShellHandlers`):

```typescript
import { registerEditorHandlers } from "./editor.ipc";
```

Add call after line 51 (`registerShellHandlers();`):

```typescript
  registerEditorHandlers();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/editor.ipc.ts src/main/ipc/index.ts
git commit --no-verify -m "feat(editor): add IPC handlers for launching external editor"
```

---

### Task 4: Preload API

**Files:**
- Modify: `src/preload/index.ts:358` (after shell section closing `}`)

- [ ] **Step 1: Add editor API after shell section**

In `src/preload/index.ts`, after line 358 (closing `},` of `shell`), add:

```typescript
  editor: {
    launch: (repoPath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EDITOR.LAUNCH, repoPath),
    launchFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EDITOR.LAUNCH_FILE, filePath),
  },
```

- [ ] **Step 2: Update the ElectronAPI type declaration**

Find the `ElectronAPI` interface (search for `interface ElectronAPI` or the type used for `window.electronAPI`) and add:

```typescript
  editor: {
    launch: (repoPath: string) => Promise<void>;
    launchFile: (filePath: string) => Promise<void>;
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts
git commit --no-verify -m "feat(preload): expose editor.launch and editor.launchFile APIs"
```

---

### Task 5: i18n Keys (all 5 locales)

**Files:**
- Modify: `src/renderer/i18n/en.json`
- Modify: `src/renderer/i18n/it.json`
- Modify: `src/renderer/i18n/de.json`
- Modify: `src/renderer/i18n/fr.json`
- Modify: `src/renderer/i18n/es.json`

**Important:** Keys are nested under top-level objects. Settings keys go inside `"settings": { ... }`, menu keys inside `"menu": { ... }`, toolbar keys inside `"toolbar": { ... }`, and context menu keys inside `"fileContextMenu": { ... }`.

- [ ] **Step 1: Add English keys to en.json**

Inside `"settings"` object (after `"mergeTool"` key around line 865):
```json
"editorTab": "Editor",
"editorDescription": "Configure an external code editor to open repositories and files",
"editorPreset": "Editor preset",
"editorSelectPreset": "Select an editor preset or choose Custom",
"editorPath": "Executable path",
"editorPathDescription": "Path to the editor binary",
"editorPathPlaceholder": "e.g. code or /usr/bin/code",
"editorArgs": "Arguments",
"editorArgsDescription": "Use $FILE as placeholder for the file path",
"editorNone": "None",
"editorPresetCustom": "Custom..."
```

Inside `"menu"` object:
```json
"openInEditor": "Open in {{editorName}}",
"editorNotConfigured": "No editor configured"
```

Inside `"toolbar"` object:
```json
"openInEditor": "Open in {{editorName}}"
```

Inside `"fileContextMenu"` object (after `"showInFolder"` around line 1068):
```json
"openInEditor": "Open in {{editorName}}"
```

- [ ] **Step 2: Add Italian keys to it.json**

Inside `"settings"`:
```json
"editorTab": "Editor",
"editorDescription": "Configura un editor di codice esterno per aprire repository e file",
"editorPreset": "Preset editor",
"editorSelectPreset": "Seleziona un preset o scegli Personalizzato",
"editorPath": "Percorso eseguibile",
"editorPathDescription": "Percorso dell'eseguibile dell'editor",
"editorPathPlaceholder": "es. code o /usr/bin/code",
"editorArgs": "Argomenti",
"editorArgsDescription": "Usa $FILE come segnaposto per il percorso del file",
"editorNone": "Nessuno",
"editorPresetCustom": "Personalizzato..."
```

Inside `"menu"`:
```json
"openInEditor": "Apri in {{editorName}}",
"editorNotConfigured": "Nessun editor configurato"
```

Inside `"toolbar"`:
```json
"openInEditor": "Apri in {{editorName}}"
```

Inside `"fileContextMenu"`:
```json
"openInEditor": "Apri in {{editorName}}"
```

- [ ] **Step 3: Add German keys to de.json**

Inside `"settings"`:
```json
"editorTab": "Editor",
"editorDescription": "Einen externen Code-Editor zum \u00d6ffnen von Repositories und Dateien konfigurieren",
"editorPreset": "Editor-Voreinstellung",
"editorSelectPreset": "Voreinstellung ausw\u00e4hlen oder Benutzerdefiniert w\u00e4hlen",
"editorPath": "Pfad zur ausf\u00fchrbaren Datei",
"editorPathDescription": "Pfad zur Editor-Bin\u00e4rdatei",
"editorPathPlaceholder": "z.B. code oder /usr/bin/code",
"editorArgs": "Argumente",
"editorArgsDescription": "Verwenden Sie $FILE als Platzhalter f\u00fcr den Dateipfad",
"editorNone": "Keiner",
"editorPresetCustom": "Benutzerdefiniert..."
```

Inside `"menu"`:
```json
"openInEditor": "In {{editorName}} \u00f6ffnen",
"editorNotConfigured": "Kein Editor konfiguriert"
```

Inside `"toolbar"`:
```json
"openInEditor": "In {{editorName}} \u00f6ffnen"
```

Inside `"fileContextMenu"`:
```json
"openInEditor": "In {{editorName}} \u00f6ffnen"
```

- [ ] **Step 4: Add French keys to fr.json**

Inside `"settings"`:
```json
"editorTab": "\u00c9diteur",
"editorDescription": "Configurer un \u00e9diteur de code externe pour ouvrir les d\u00e9p\u00f4ts et les fichiers",
"editorPreset": "Pr\u00e9r\u00e9glage de l'\u00e9diteur",
"editorSelectPreset": "S\u00e9lectionner un pr\u00e9r\u00e9glage ou choisir Personnalis\u00e9",
"editorPath": "Chemin de l'ex\u00e9cutable",
"editorPathDescription": "Chemin vers le binaire de l'\u00e9diteur",
"editorPathPlaceholder": "ex. code ou /usr/bin/code",
"editorArgs": "Arguments",
"editorArgsDescription": "Utilisez $FILE comme espace r\u00e9serv\u00e9 pour le chemin du fichier",
"editorNone": "Aucun",
"editorPresetCustom": "Personnalis\u00e9..."
```

Inside `"menu"`:
```json
"openInEditor": "Ouvrir dans {{editorName}}",
"editorNotConfigured": "Aucun \u00e9diteur configur\u00e9"
```

Inside `"toolbar"`:
```json
"openInEditor": "Ouvrir dans {{editorName}}"
```

Inside `"fileContextMenu"`:
```json
"openInEditor": "Ouvrir dans {{editorName}}"
```

- [ ] **Step 5: Add Spanish keys to es.json**

Inside `"settings"`:
```json
"editorTab": "Editor",
"editorDescription": "Configurar un editor de c\u00f3digo externo para abrir repositorios y archivos",
"editorPreset": "Preset del editor",
"editorSelectPreset": "Seleccionar un preset o elegir Personalizado",
"editorPath": "Ruta del ejecutable",
"editorPathDescription": "Ruta al binario del editor",
"editorPathPlaceholder": "ej. code o /usr/bin/code",
"editorArgs": "Argumentos",
"editorArgsDescription": "Use $FILE como marcador para la ruta del archivo",
"editorNone": "Ninguno",
"editorPresetCustom": "Personalizado..."
```

Inside `"menu"`:
```json
"openInEditor": "Abrir en {{editorName}}",
"editorNotConfigured": "Ning\u00fan editor configurado"
```

Inside `"toolbar"`:
```json
"openInEditor": "Abrir en {{editorName}}"
```

Inside `"fileContextMenu"`:
```json
"openInEditor": "Abrir en {{editorName}}"
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/i18n/*.json
git commit --no-verify -m "feat(i18n): add editor integration keys for all 5 locales"
```

---

### Task 6: Settings Dialog — Editor Tab

**Files:**
- Modify: `src/renderer/components/dialogs/SettingsDialog.tsx`

- [ ] **Step 1: Add "editor" to Tab type union**

At line 9-18, add `"editor"` after `"mergetool"`:

```typescript
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
```

- [ ] **Step 2: Add editor tab to TABS array**

In the TABS array (line 37-47), add after the mergetool entry (line 43):

```typescript
  { id: "editor", labelKey: "settings.editorTab", icon: <IconEditor /> },
```

Add `IconEditor` near the other icon components at the top of the file:

```typescript
const IconEditor: React.FC = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
```

- [ ] **Step 3: Add EDITOR_PRESETS constant**

Add near MERGE_TOOL_PRESETS (around line 947):

```typescript
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
```

- [ ] **Step 4: Add EditorTab component**

Add after `MergeToolTab` (after line 1112). Use `OnChange` type, `SectionTitle`, `SettingRow`, and `Select` — matching the MergeToolTab pattern exactly:

```typescript
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
```

- [ ] **Step 5: Add EditorTab to tab content rendering**

After the mergetool rendering block (line 278), add:

```typescript
{settings && tab === "editor" && (
  <EditorTab
    settings={settings}
    onChange={updateSetting}
    onBatchChange={updateSettings}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/dialogs/SettingsDialog.tsx
git commit --no-verify -m "feat(settings): add Editor tab with preset selector"
```

---

### Task 7: Menu Tools — "Open in Editor"

**Files:**
- Modify: `src/renderer/components/layout/MenuBar.tsx`

- [ ] **Step 1: Load settings in MenuBar**

Check if MenuBar already loads `AppSettings`. If not, add state near the top of the component:

```typescript
const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
useEffect(() => {
  window.electronAPI.settings.get().then(setAppSettings);
}, []);
```

Also define the editor label lookup (inline, no need to import EDITOR_PRESETS):

```typescript
const editorLabelMap: Record<string, string> = {
  vscode: "VS Code",
  "vscode-insiders": "VS Code Insiders",
  cursor: "Cursor",
  custom: "Editor",
};
const editorLabel = appSettings?.editorName
  ? editorLabelMap[appSettings.editorName] || appSettings.editorName
  : "";
```

- [ ] **Step 2: Add editor menu item to Tools menu**

In the Tools menu items array, after the "Git Bash" item, add:

```typescript
{
  label: editorLabel
    ? t("menu.openInEditor", { editorName: editorLabel })
    : t("menu.editorNotConfigured"),
  disabled: !hasRepo || !appSettings?.editorPath,
  onClick: () => {
    if (repo?.path && appSettings?.editorPath) {
      window.electronAPI.editor.launch(repo.path).catch((err: Error) => {
        console.error("Editor launch failed:", err.message);
      });
    }
  },
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/layout/MenuBar.tsx
git commit --no-verify -m "feat(menu): add 'Open in Editor' to Tools menu"
```

---

### Task 8: Toolbar Button

**Files:**
- Modify: `src/renderer/components/layout/Toolbar.tsx`

- [ ] **Step 1: Load editor settings in Toolbar**

Add state near other state declarations:

```typescript
const [editorConfig, setEditorConfig] = useState<{ name: string; path: string } | null>(null);
useEffect(() => {
  window.electronAPI.settings.get().then((s) => {
    if (s.editorName && s.editorPath) {
      setEditorConfig({ name: s.editorName, path: s.editorPath });
    }
  });
}, []);

const editorLabelMap: Record<string, string> = {
  vscode: "VS Code",
  "vscode-insiders": "VS Code Insiders",
  cursor: "Cursor",
  custom: "Editor",
};
```

- [ ] **Step 2: Add editor button**

Add the button in the toolbar actions area (after existing action buttons, before a divider):

```typescript
{editorConfig && repo && (
  <button
    onClick={() => {
      window.electronAPI.editor.launch(repo.path).catch((err: Error) => {
        console.error("Editor launch failed:", err.message);
      });
    }}
    className="toolbar-btn"
    title={t("toolbar.openInEditor", {
      editorName: editorLabelMap[editorConfig.name] || editorConfig.name,
    })}
    style={{ whiteSpace: "nowrap" }}
  >
    <IconEditorCode />
  </button>
)}
```

Add the icon near other toolbar icons:

```typescript
const IconEditorCode: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/layout/Toolbar.tsx
git commit --no-verify -m "feat(toolbar): add editor launch button"
```

---

### Task 9: File Context Menu — "Open in Editor"

**Files:**
- Modify: `src/renderer/components/shared/FileContextMenu.tsx`

- [ ] **Step 1: Add editor settings state**

Inside the `FileContextMenu` component, add state and effect:

```typescript
const [editorLabel, setEditorLabel] = useState<string>("");

useEffect(() => {
  window.electronAPI.settings.get().then((s) => {
    if (s.editorName && s.editorPath) {
      const presets: Record<string, string> = {
        vscode: "VS Code",
        "vscode-insiders": "VS Code Insiders",
        cursor: "Cursor",
        custom: "Editor",
      };
      setEditorLabel(presets[s.editorName] || s.editorName);
    }
  });
}, []);
```

- [ ] **Step 2: Add "Open in Editor" button**

After the "Show in folder" button (line 155), before the `{separator}`, add:

```typescript
{editorLabel && (
  <button
    style={menuItemStyle}
    onClick={() => {
      window.electronAPI.editor.launchFile(filePath).catch(() => {});
      onClose();
    }}
    onMouseEnter={handleItemHover}
    onMouseLeave={handleItemLeave}
  >
    <IconCode size={13} /> {t("fileContextMenu.openInEditor", { editorName: editorLabel })}
  </button>
)}
```

Add the `IconCode` icon near other icons at bottom of file:

```typescript
const IconCode: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/shared/FileContextMenu.tsx
git commit --no-verify -m "feat(context-menu): add 'Open in Editor' to file context menu"
```

---

### Task 10: Manual Smoke Test

- [ ] **Step 1: Start the app**

Run: `npm start`

- [ ] **Step 2: Verify Settings > Editor tab**

1. Open Settings (Ctrl+,)
2. Navigate to the "Editor" tab
3. Select "VS Code" preset — verify path fills with `code` and args with `$FILE`
4. Switch to "Custom" — verify Browse button appears and path field is editable
5. Switch to "None" — verify path/args fields hide
6. Save and reopen — verify settings persist

- [ ] **Step 3: Verify Tools menu**

1. Open a repository
2. Click Tools menu
3. Verify "Open in VS Code" appears (enabled if editor configured, disabled otherwise)
4. Click it — verify VS Code opens with the repo folder

- [ ] **Step 4: Verify toolbar button**

1. With editor configured, verify the code-bracket button appears in toolbar
2. Click it — verify VS Code opens

- [ ] **Step 5: Verify file context menu**

1. Right-click a file in commit details or diff panel
2. Verify "Open in VS Code" appears after "Show in folder"
3. Click it — verify VS Code opens the specific file

- [ ] **Step 6: Final commit if any adjustments needed**

```bash
git add -A
git commit --no-verify -m "fix(editor): polish from smoke testing"
```
