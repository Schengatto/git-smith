import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import type { GitAccount } from "../shared/git-types";
import type { AppSettings } from "../shared/settings-types";

export type { AppSettings } from "../shared/settings-types";

function encryptApiKey(key: string): string {
  if (!key) return key;
  try {
    if (!safeStorage.isEncryptionAvailable()) return key;
    return safeStorage.encryptString(key).toString("base64");
  } catch {
    return key;
  }
}

function decryptApiKey(stored: string): string {
  if (!stored) return stored;
  try {
    if (!safeStorage.isEncryptionAvailable()) return stored;
    return safeStorage.decryptString(Buffer.from(stored, "base64"));
  } catch {
    return stored;
  }
}

export interface RepoCategory {
  [repoPath: string]: string; // repoPath → category name
}

export interface RepoViewSettings {
  branchFilter: string;
  branchVisibility: { mode: "include" | "exclude"; branches: string[] } | null;
  dockviewLayout: unknown | null;
}

export const defaultRepoViewSettings: RepoViewSettings = {
  branchFilter: "",
  branchVisibility: null,
  dockviewLayout: null,
};

export interface AppStoreSchema {
  recentRepos: string[];
  repoCategories: RepoCategory;
  recentCommitMessages: string[];
  lastOpenedRepo: string | null;
  windowBounds: { width: number; height: number; x?: number; y?: number };
  settings: AppSettings;
  repoViewSettings: { [repoPath: string]: RepoViewSettings };
  gitAccounts: GitAccount[];
  repoAccountMap: Record<string, string>; // repoPath → accountId
  defaultAccountId: string | null;
}

export const defaultCommitTemplates = [
  { name: "Feature", prefix: "feat: ", body: "", description: "A new feature" },
  { name: "Fix", prefix: "fix: ", body: "", description: "A bug fix" },
  { name: "Docs", prefix: "docs: ", body: "", description: "Documentation only changes" },
  {
    name: "Style",
    prefix: "style: ",
    body: "",
    description: "Code style changes (formatting, etc.)",
  },
  {
    name: "Refactor",
    prefix: "refactor: ",
    body: "",
    description: "Code change that neither fixes a bug nor adds a feature",
  },
  {
    name: "Perf",
    prefix: "perf: ",
    body: "",
    description: "A code change that improves performance",
  },
  { name: "Test", prefix: "test: ", body: "", description: "Adding or correcting tests" },
  {
    name: "Build",
    prefix: "build: ",
    body: "",
    description: "Changes to the build system or dependencies",
  },
  { name: "CI", prefix: "ci: ", body: "", description: "Changes to CI configuration" },
  {
    name: "Chore",
    prefix: "chore: ",
    body: "",
    description: "Other changes that don't modify src or test",
  },
];

export const defaultSettings: AppSettings = {
  theme: "dark",
  language: "en",
  autoFetchEnabled: true,
  autoFetchInterval: 300, // 5 minutes in seconds
  fetchPruneOnAuto: false,
  defaultCommitTemplate: "",
  signCommits: false,
  commitTemplates: [...defaultCommitTemplates],
  commitSnippets: [
    { label: "Co-authored-by", text: "Co-authored-by: " },
    { label: "BREAKING CHANGE", text: "BREAKING CHANGE: " },
    { label: "Closes #", text: "Closes #" },
    { label: "Refs #", text: "Refs #" },
    { label: "Signed-off-by", text: "Signed-off-by: " },
  ],
  notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
  issueTracker: { provider: "github", pattern: "#(\\d+)", urlTemplate: "" },
  diffContextLines: 3,
  preferSideBySideDiff: false,
  graphMaxInitialLoad: 500,
  showRemoteBranchesInGraph: true,
  mergeToolName: "",
  mergeToolPath: "",
  mergeToolArgs: "",
  maxConcurrentGitProcesses: 6,
  gitBinaryPath: "",
  aiProvider: "none",
  aiApiKey: "",
  aiModel: "",
  aiBaseUrl: "",
  mcpServerEnabled: false,
};

const defaults: AppStoreSchema = {
  recentRepos: [],
  repoCategories: {},
  recentCommitMessages: [],
  lastOpenedRepo: null,
  windowBounds: { width: 1280, height: 800 },
  settings: { ...defaultSettings },
  repoViewSettings: {},
  gitAccounts: [],
  repoAccountMap: {},
  defaultAccountId: null,
};

function getStorePath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

let cachedStore: AppStoreSchema | null = null;
let writePending = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function readStore(): AppStoreSchema {
  if (cachedStore) return cachedStore;
  try {
    const raw = fs.readFileSync(getStorePath(), "utf-8");
    const parsed = JSON.parse(raw);
    const settings = { ...defaultSettings, ...parsed.settings };
    if (settings.aiApiKey) {
      settings.aiApiKey = decryptApiKey(settings.aiApiKey);
    }
    const store: AppStoreSchema = { ...defaults, ...parsed, settings };
    if (store.gitAccounts) {
      store.gitAccounts = store.gitAccounts.map((a) => ({
        ...a,
        platformToken: a.platformToken ? decryptApiKey(a.platformToken) : undefined,
      }));
    }
    cachedStore = store;
    return store;
  } catch {
    const store: AppStoreSchema = { ...defaults, settings: { ...defaultSettings } };
    cachedStore = store;
    return store;
  }
}

function flushStore(): void {
  if (!writePending || !cachedStore) return;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    const dir = path.dirname(getStorePath());
    fs.mkdirSync(dir, { recursive: true });
    const toWrite = {
      ...cachedStore,
      settings: {
        ...cachedStore.settings,
        aiApiKey: encryptApiKey(cachedStore.settings.aiApiKey),
      },
      gitAccounts: cachedStore.gitAccounts.map((a) => ({
        ...a,
        platformToken: a.platformToken ? encryptApiKey(a.platformToken) : undefined,
      })),
    };
    fs.writeFileSync(getStorePath(), JSON.stringify(toWrite, null, 2));
    writePending = false;
  } catch {}
}

function writeStore(data: AppStoreSchema): void {
  cachedStore = data;
  writePending = true;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushStore, 500);
}

try {
  app.on("before-quit", flushStore);
} catch {
  /* app not ready in test env */
}

export function getRecentRepos(): string[] {
  return readStore().recentRepos;
}

export function addRecentRepo(repoPath: string): void {
  const store = readStore();
  store.recentRepos = store.recentRepos.filter((r) => r !== repoPath);
  store.recentRepos.unshift(repoPath);
  store.recentRepos = store.recentRepos.slice(0, 100);
  writeStore(store);
}

export function getLastOpenedRepo(): string | null {
  return readStore().lastOpenedRepo;
}

export function setLastOpenedRepo(repoPath: string | null): void {
  const store = readStore();
  store.lastOpenedRepo = repoPath;
  writeStore(store);
}

export function getWindowBounds() {
  return readStore().windowBounds;
}

export function setWindowBounds(bounds: AppStoreSchema["windowBounds"]) {
  const store = readStore();
  store.windowBounds = bounds;
  writeStore(store);
}

export function getSettings(): AppSettings {
  return readStore().settings;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const store = readStore();
  store.settings = { ...store.settings, ...partial };
  writeStore(store);
  return store.settings;
}

export function removeRecentRepo(repoPath: string): void {
  const store = readStore();
  store.recentRepos = store.recentRepos.filter((r) => r !== repoPath);
  delete store.repoCategories[repoPath];
  writeStore(store);
}

export function clearRecentRepos(): void {
  const store = readStore();
  store.recentRepos = [];
  store.repoCategories = {};
  writeStore(store);
}

export function setRepoCategory(repoPath: string, category: string | null): void {
  const store = readStore();
  if (category) {
    store.repoCategories[repoPath] = category;
  } else {
    delete store.repoCategories[repoPath];
  }
  writeStore(store);
}

export function getRepoCategories(): RepoCategory {
  return readStore().repoCategories;
}

export function removeMissingRepos(): string[] {
  const store = readStore();
  const removed: string[] = [];
  store.recentRepos = store.recentRepos.filter((repoPath) => {
    if (fs.existsSync(repoPath)) return true;
    removed.push(repoPath);
    delete store.repoCategories[repoPath];
    return false;
  });
  writeStore(store);
  return removed;
}

export function renameCategory(oldName: string, newName: string): void {
  const store = readStore();
  for (const key of Object.keys(store.repoCategories)) {
    if (store.repoCategories[key] === oldName) {
      store.repoCategories[key] = newName;
    }
  }
  writeStore(store);
}

export function deleteCategory(category: string): void {
  const store = readStore();
  for (const key of Object.keys(store.repoCategories)) {
    if (store.repoCategories[key] === category) {
      delete store.repoCategories[key];
    }
  }
  writeStore(store);
}

export interface ScanProgress {
  phase: "scanning" | "done";
  currentDir: string;
  found: string[];
}

export async function scanForRepos(
  rootPath: string,
  maxDepth: number,
  onProgress: (progress: ScanProgress) => void
): Promise<string[]> {
  const found: string[] = [];
  const store = readStore();
  const existingSet = new Set(store.recentRepos);

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // permission denied or inaccessible
    }

    // Check if this directory is a git repo
    const hasGit = entries.some((e) => e.name === ".git" && (e.isDirectory() || e.isFile()));

    if (hasGit) {
      const normalized = dir.replace(/\\/g, "/");
      if (!existingSet.has(normalized) && !existingSet.has(dir)) {
        found.push(dir);
      }
      onProgress({ phase: "scanning", currentDir: dir, found: [...found] });
      // Don't recurse into git repos (nested repos are submodules or separate)
      return;
    }

    onProgress({ phase: "scanning", currentDir: dir, found: [...found] });

    // Recurse into subdirectories
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip common non-project directories
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "__pycache__" ||
        entry.name === ".cache" ||
        entry.name === ".venv" ||
        entry.name === "venv" ||
        entry.name === ".tox" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === "$RECYCLE.BIN" ||
        entry.name === "System Volume Information" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  onProgress({ phase: "done", currentDir: "", found: [...found] });
  return found;
}

export function addMultipleRecentRepos(paths: string[]): void {
  const store = readStore();
  const existingSet = new Set(store.recentRepos);
  for (const p of paths) {
    if (!existingSet.has(p)) {
      store.recentRepos.push(p);
      existingSet.add(p);
    }
  }
  writeStore(store);
}

export function getRecentCommitMessages(): string[] {
  return readStore().recentCommitMessages;
}

export function addRecentCommitMessage(message: string): void {
  const store = readStore();
  store.recentCommitMessages = store.recentCommitMessages.filter((m) => m !== message);
  store.recentCommitMessages.unshift(message);
  store.recentCommitMessages = store.recentCommitMessages.slice(0, 10);
  writeStore(store);
}

export function getRepoViewSettings(repoPath: string): RepoViewSettings {
  const store = readStore();
  return { ...defaultRepoViewSettings, ...store.repoViewSettings[repoPath] };
}

export function setRepoViewSettings(repoPath: string, partial: Partial<RepoViewSettings>): void {
  const store = readStore();
  store.repoViewSettings[repoPath] = {
    ...defaultRepoViewSettings,
    ...store.repoViewSettings[repoPath],
    ...partial,
  };
  writeStore(store);
}

// --- Git Accounts ---

export function getGitAccounts(): GitAccount[] {
  return readStore().gitAccounts;
}

export function addGitAccount(account: GitAccount): void {
  const store = readStore();
  store.gitAccounts.push(account);
  writeStore(store);
}

export function updateGitAccount(id: string, partial: Partial<GitAccount>): void {
  const store = readStore();
  const idx = store.gitAccounts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    store.gitAccounts[idx] = { ...store.gitAccounts[idx]!, ...partial, id };
    writeStore(store);
  }
}

export function deleteGitAccount(id: string): void {
  const store = readStore();
  store.gitAccounts = store.gitAccounts.filter((a) => a.id !== id);
  // Clean up references
  for (const key of Object.keys(store.repoAccountMap)) {
    if (store.repoAccountMap[key] === id) {
      delete store.repoAccountMap[key];
    }
  }
  if (store.defaultAccountId === id) {
    store.defaultAccountId = null;
  }
  writeStore(store);
}

export function getRepoAccount(repoPath: string): string | null {
  return readStore().repoAccountMap[repoPath] || null;
}

export function setRepoAccount(repoPath: string, accountId: string | null): void {
  const store = readStore();
  if (accountId) {
    store.repoAccountMap[repoPath] = accountId;
  } else {
    delete store.repoAccountMap[repoPath];
  }
  writeStore(store);
}

export function getDefaultAccountId(): string | null {
  return readStore().defaultAccountId;
}

export function setDefaultAccountId(accountId: string | null): void {
  const store = readStore();
  store.defaultAccountId = accountId;
  writeStore(store);
}

export function getPlatformTokenForRepo(repoPath: string): string | null {
  const store = readStore();
  const accountId = store.repoAccountMap[repoPath] || store.defaultAccountId || null;
  if (!accountId) return null;
  const account = store.gitAccounts.find((a) => a.id === accountId);
  return account?.platformToken || null;
}

// Legacy compat
export function getAutoFetchInterval(): number {
  return getSettings().autoFetchInterval;
}

export function setAutoFetchInterval(seconds: number) {
  updateSettings({ autoFetchInterval: seconds });
}
