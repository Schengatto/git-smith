# Codebase Stats Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dockview panel that shows lines-of-code statistics by language, file type, and test ratio for the current repository.

**Architecture:** Backend reads git-tracked files via `git ls-files`, counts lines per file, classifies by extension/path into language and type buckets. Frontend displays three stacked sections (language bars, type cards, test ratio) in a new dockview tab alongside existing stats panels.

**Tech Stack:** Electron IPC, simple-git (`git.raw()`), Node.js `fs.readFile`, Zustand store, React inline styles, Catppuccin CSS variables, dockview panel.

**Spec:** `docs/superpowers/specs/2026-03-19-codebase-stats-panel-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/shared/codebase-stats-types.ts` | Type definitions for CodebaseStats, LanguageStat, TypeStat, TestRatio |
| Create | `src/main/git/codebase-stats.ts` | Language map, type classifier, line counter, `getCodebaseStats()` logic |
| Create | `src/main/git/codebase-stats.test.ts` | Unit tests for language detection, type classification, aggregation |
| Modify | `src/shared/ipc-channels.ts:200-203` | Add `CODEBASE: "git:stats:codebase"` to STATS section |
| Modify | `src/main/ipc/stats.ipc.ts` | Add IPC handler for `getCodebaseStats` |
| Modify | `src/preload/index.ts:356-361` | Expose `getCodebaseStats()` in `stats` section |
| Create | `src/renderer/store/codebase-stats-store.ts` | Zustand store for codebase stats state |
| Create | `src/renderer/components/stats/CodebaseStatsPanel.tsx` | React panel component with 3 sections |
| Create | `src/renderer/components/stats/CodebaseStatsPanel.test.tsx` | Component render tests |
| Modify | `src/renderer/components/layout/AppShell.tsx:32-40,215-229,281-286` | Register panel, default layout, migration |

---

### Task 1: Shared Type Definitions

**Files:**
- Create: `src/shared/codebase-stats-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/shared/codebase-stats-types.ts

export type FileType = "source" | "test" | "config" | "styles" | "docs" | "cicd" | "other";

export interface LanguageStat {
  language: string;
  lines: number;
  files: number;
  percentage: number;
  color: string;
}

export interface TypeStat {
  type: FileType;
  lines: number;
  files: number;
  color: string;
}

export interface TestRatio {
  sourceLines: number;
  testLines: number;
  ratio: number;
  percentage: number;
}

export interface CodebaseStats {
  totalLines: number;
  totalFiles: number;
  languageCount: number;
  byLanguage: LanguageStat[];
  byType: TypeStat[];
  testRatio: TestRatio;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to codebase-stats-types.

- [ ] **Step 3: Commit**

```bash
git add src/shared/codebase-stats-types.ts
git commit -m "feat(types): add CodebaseStats type definitions"
```

---

### Task 2: Backend — Language Map, Type Classifier, and Line Counter

**Files:**
- Create: `src/main/git/codebase-stats.ts`
- Create: `src/main/git/codebase-stats.test.ts`

- [ ] **Step 1: Write failing tests for `getLanguage()`**

```typescript
// src/main/git/codebase-stats.test.ts
import { describe, it, expect } from "vitest";
import { getLanguage, getFileType } from "./codebase-stats";

describe("getLanguage", () => {
  it("detects TypeScript from .ts extension", () => {
    expect(getLanguage("src/main/app.ts")).toBe("TypeScript");
  });
  it("detects TSX from .tsx extension", () => {
    expect(getLanguage("src/renderer/App.tsx")).toBe("TypeScript");
  });
  it("detects Python from .py extension", () => {
    expect(getLanguage("scripts/build.py")).toBe("Python");
  });
  it("detects Go from .go extension", () => {
    expect(getLanguage("cmd/main.go")).toBe("Go");
  });
  it("detects Rust from .rs extension", () => {
    expect(getLanguage("src/lib.rs")).toBe("Rust");
  });
  it("detects CSS from .css extension", () => {
    expect(getLanguage("styles/app.css")).toBe("CSS");
  });
  it("detects YAML from .yml extension", () => {
    expect(getLanguage("config.yml")).toBe("YAML");
  });
  it("detects Shell from .sh extension", () => {
    expect(getLanguage("scripts/deploy.sh")).toBe("Shell");
  });
  it("returns null for unknown extension", () => {
    expect(getLanguage("file.xyz")).toBeNull();
  });
  it("returns null for binary extensions", () => {
    expect(getLanguage("image.png")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getLanguage()` with full extension map**

```typescript
// src/main/git/codebase-stats.ts
import * as path from "path";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".pdf", ".lock",
]);

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Web/Frontend
  ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".vue": "Vue", ".svelte": "Svelte", ".html": "HTML", ".svg": "SVG",
  ".css": "CSS", ".scss": "SCSS", ".sass": "Sass", ".less": "Less",
  // Backend
  ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java", ".kt": "Kotlin",
  ".scala": "Scala", ".rb": "Ruby", ".php": "PHP", ".cs": "C#", ".fs": "F#",
  ".ex": "Elixir", ".exs": "Elixir", ".clj": "Clojure", ".erl": "Erlang", ".hs": "Haskell",
  // Systems
  ".c": "C", ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".h": "C", ".hpp": "C++",
  ".zig": "Zig", ".nim": "Nim", ".d": "D",
  // Shell/Script
  ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell", ".fish": "Fish",
  ".ps1": "PowerShell", ".bat": "Batch", ".cmd": "Batch",
  // Data/Config
  ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
  ".xml": "XML", ".ini": "INI", ".env": "Env",
  // Mobile
  ".swift": "Swift", ".m": "Objective-C", ".mm": "Objective-C", ".dart": "Dart",
  // Other
  ".sql": "SQL", ".graphql": "GraphQL", ".proto": "Protobuf",
  ".r": "R", ".R": "R", ".lua": "Lua", ".perl": "Perl", ".pl": "Perl",
  ".groovy": "Groovy", ".tf": "Terraform", ".hcl": "HCL",
  // Docs
  ".md": "Markdown", ".txt": "Text", ".rst": "reStructuredText", ".adoc": "AsciiDoc",
  // Styl
  ".styl": "Stylus",
};

export function isBinary(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function getLanguage(filePath: string): string | null {
  if (isBinary(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: All `getLanguage` tests PASS.

- [ ] **Step 5: Write failing tests for `getFileType()`**

Add to the test file:

```typescript
describe("getFileType", () => {
  it("classifies .test.ts as test", () => {
    expect(getFileType("src/app.test.ts")).toBe("test");
  });
  it("classifies .spec.tsx as test", () => {
    expect(getFileType("src/app.spec.tsx")).toBe("test");
  });
  it("classifies __tests__/ files as test", () => {
    expect(getFileType("src/__tests__/app.ts")).toBe("test");
  });
  it("classifies .github/ files as cicd", () => {
    expect(getFileType(".github/workflows/ci.yml")).toBe("cicd");
  });
  it("classifies .circleci/ files as cicd", () => {
    expect(getFileType(".circleci/config.yml")).toBe("cicd");
  });
  it("classifies Jenkinsfile as cicd", () => {
    expect(getFileType("Jenkinsfile")).toBe("cicd");
  });
  it("classifies .css as styles", () => {
    expect(getFileType("src/index.css")).toBe("styles");
  });
  it("classifies .scss as styles", () => {
    expect(getFileType("src/theme.scss")).toBe("styles");
  });
  it("classifies .md as docs", () => {
    expect(getFileType("README.md")).toBe("docs");
  });
  it("classifies LICENSE as docs", () => {
    expect(getFileType("LICENSE")).toBe("docs");
  });
  it("classifies *.config.ts as config", () => {
    expect(getFileType("vite.config.ts")).toBe("config");
  });
  it("classifies package.json as config", () => {
    expect(getFileType("package.json")).toBe("config");
  });
  it("classifies tsconfig.json as config", () => {
    expect(getFileType("tsconfig.json")).toBe("config");
  });
  it("classifies Dockerfile as config", () => {
    expect(getFileType("Dockerfile")).toBe("config");
  });
  it("classifies root .yml as config (not cicd)", () => {
    expect(getFileType("docker-compose.yml")).toBe("config");
  });
  it("classifies .eslintrc.json as config", () => {
    expect(getFileType(".eslintrc.json")).toBe("config");
  });
  it("classifies regular .ts as source", () => {
    expect(getFileType("src/main/app.ts")).toBe("source");
  });
  it("classifies unknown extension as other", () => {
    expect(getFileType("file.xyz")).toBe("other");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: FAIL — `getFileType` not defined.

- [ ] **Step 7: Implement `getFileType()`**

Add to `src/main/git/codebase-stats.ts`:

```typescript
import type { FileType } from "../../shared/codebase-stats-types";

const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".styl"]);
const DOC_EXTENSIONS = new Set([".md", ".txt", ".rst", ".adoc"]);
const DOC_FILENAMES = new Set(["LICENSE", "CHANGELOG"]);
const CONFIG_PATTERNS = [/\.config\.\w+$/, /tsconfig.*\.json$/, /\.eslintrc/, /\.prettierrc/];
const CONFIG_FILENAMES = new Set(["package.json", "Dockerfile", "Makefile", ".editorconfig", ".gitignore", ".gitattributes"]);
const CICD_PATH_PREFIXES = [".github/", ".circleci/"];
const CICD_FILENAMES = new Set(["Jenkinsfile"]);
const CICD_PATTERNS = [/\.gitlab-ci/];

export function getFileType(filePath: string): FileType {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, "/");

  // CI/CD — path-based
  for (const prefix of CICD_PATH_PREFIXES) {
    if (normalizedPath.startsWith(prefix)) return "cicd";
  }
  if (CICD_FILENAMES.has(basename)) return "cicd";
  for (const pattern of CICD_PATTERNS) {
    if (pattern.test(normalizedPath)) return "cicd";
  }

  // Test
  if (/\.(test|spec)\.\w+$/.test(basename)) return "test";
  if (/(^|\/)(__|)tests?(__|\/)/.test(normalizedPath) || /(^|\/)spec\//.test(normalizedPath)) return "test";

  // Styles
  if (STYLE_EXTENSIONS.has(ext)) return "styles";

  // Docs
  if (DOC_EXTENSIONS.has(ext) || DOC_FILENAMES.has(basename)) return "docs";

  // Config
  if (CONFIG_FILENAMES.has(basename)) return "config";
  for (const pattern of CONFIG_PATTERNS) {
    if (pattern.test(basename)) return "config";
  }
  if ((ext === ".yml" || ext === ".yaml")) return "config";
  if (basename.startsWith(".") && (ext === ".json" || ext === ".js" || ext === ".cjs")) return "config";

  // Source (has recognized language)
  if (getLanguage(filePath) !== null) return "source";

  return "other";
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main/git/codebase-stats.ts src/main/git/codebase-stats.test.ts
git commit -m "feat(git): add language detection and file type classification"
```

---

### Task 3: Backend — `getCodebaseStats()` with Line Counting

**Files:**
- Modify: `src/main/git/codebase-stats.ts`
- Modify: `src/main/git/codebase-stats.test.ts`

- [ ] **Step 1: Write failing tests for `getCodebaseStats()`**

Add to the test file:

```typescript
import { vi } from "vitest";
import * as fs from "fs/promises";
import { getCodebaseStats } from "./codebase-stats";

// Mock simple-git
const mockRaw = vi.fn();
const mockGit = { raw: mockRaw } as unknown;

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

describe("getCodebaseStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts lines per language and type", async () => {
    mockRaw
      .mockResolvedValueOnce("src/app.ts\nsrc/app.test.ts\nsrc/index.css\n")  // ls-files
      .mockResolvedValueOnce("/test/repo\n");                                  // rev-parse --show-toplevel
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile
      .mockResolvedValueOnce("line1\nline2\nline3\n")   // app.ts — 3 lines
      .mockResolvedValueOnce("test1\ntest2\n")           // app.test.ts — 2 lines
      .mockResolvedValueOnce("body{}\n");                // index.css — 1 line

    const stats = await getCodebaseStats(mockGit as any);

    expect(stats.totalLines).toBe(6);
    expect(stats.totalFiles).toBe(3);
    expect(stats.byLanguage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "TypeScript", lines: 5, files: 2 }),
        expect.objectContaining({ language: "CSS", lines: 1, files: 1 }),
      ])
    );
    expect(stats.byType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "source", lines: 3 }),
        expect.objectContaining({ type: "test", lines: 2 }),
        expect.objectContaining({ type: "styles", lines: 1 }),
      ])
    );
    expect(stats.testRatio.sourceLines).toBe(3);
    expect(stats.testRatio.testLines).toBe(2);
  });

  it("skips binary files", async () => {
    mockRaw
      .mockResolvedValueOnce("src/app.ts\nimage.png\n")  // ls-files
      .mockResolvedValueOnce("/test/repo\n");              // rev-parse
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValueOnce("line1\nline2\n");

    const stats = await getCodebaseStats(mockGit as any);

    expect(stats.totalFiles).toBe(1);
    expect(stats.totalLines).toBe(2);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("handles empty repo", async () => {
    mockRaw.mockResolvedValueOnce("");

    const stats = await getCodebaseStats(mockGit as any);

    expect(stats.totalFiles).toBe(0);
    expect(stats.totalLines).toBe(0);
    expect(stats.byLanguage).toEqual([]);
  });

  it("sorts languages by lines descending", async () => {
    mockRaw
      .mockResolvedValueOnce("a.ts\nb.py\n")  // ls-files
      .mockResolvedValueOnce("/test/repo\n");  // rev-parse
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile
      .mockResolvedValueOnce("1\n2\n")     // ts: 2 lines
      .mockResolvedValueOnce("1\n2\n3\n"); // py: 3 lines

    const stats = await getCodebaseStats(mockGit as any);

    expect(stats.byLanguage[0].language).toBe("Python");
    expect(stats.byLanguage[1].language).toBe("TypeScript");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: FAIL — `getCodebaseStats` not found.

- [ ] **Step 3: Implement `getCodebaseStats()`**

Add to `src/main/git/codebase-stats.ts`:

```typescript
import * as fs from "fs/promises";
import type { SimpleGit } from "simple-git";
import type { CodebaseStats, LanguageStat, TypeStat, FileType } from "../../shared/codebase-stats-types";

// Catppuccin-based colors for languages
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#89b4fa", JavaScript: "#f9e2af", Python: "#a6e3a1", Go: "#94e2d5",
  Rust: "#fab387", Java: "#f38ba8", "C#": "#cba6f7", "C++": "#89dceb", C: "#74c7ec",
  Ruby: "#f38ba8", PHP: "#cba6f7", Kotlin: "#fab387", Scala: "#f38ba8", Swift: "#fab387",
  Dart: "#89b4fa", HTML: "#fab387", CSS: "#89b4fa", SCSS: "#f38ba8", Sass: "#f38ba8",
  Less: "#89b4fa", JSON: "#f9e2af", YAML: "#a6e3a1", TOML: "#fab387", XML: "#fab387",
  Shell: "#a6e3a1", PowerShell: "#89b4fa", SQL: "#89dceb", GraphQL: "#f38ba8",
  Markdown: "#a6adc8", Vue: "#a6e3a1", Svelte: "#fab387", SVG: "#f9e2af",
  Lua: "#89b4fa", Perl: "#94e2d5", Groovy: "#a6e3a1", Terraform: "#cba6f7",
  Elixir: "#cba6f7", Clojure: "#a6e3a1", Haskell: "#cba6f7", Erlang: "#f38ba8",
  "F#": "#89b4fa", Zig: "#fab387", Nim: "#f9e2af", D: "#f38ba8", R: "#89b4fa",
  Protobuf: "#a6adc8", HCL: "#cba6f7", Fish: "#94e2d5", Batch: "#a6adc8",
  "Objective-C": "#89b4fa", Text: "#6c7086", reStructuredText: "#a6adc8",
  AsciiDoc: "#a6adc8", INI: "#a6adc8", Env: "#a6adc8", Stylus: "#a6e3a1",
};

const TYPE_COLORS: Record<FileType, string> = {
  source: "#89b4fa",
  test: "#a6e3a1",
  config: "#fab387",
  styles: "#f38ba8",
  docs: "#cba6f7",
  cicd: "#f9e2af",
  other: "#6c7086",
};

const DEFAULT_LANGUAGE_COLOR = "#6c7086";
const BATCH_SIZE = 50;

async function countLines(repoPath: string, filePath: string): Promise<number> {
  try {
    const fullPath = path.join(repoPath, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    if (content.length === 0) return 0;
    // Count newlines; add 1 if file doesn't end with newline
    const count = content.split("\n").length;
    return content.endsWith("\n") ? count - 1 : count;
  } catch {
    return 0;
  }
}

export async function getCodebaseStats(git: SimpleGit): Promise<CodebaseStats> {
  const output = await git.raw(["ls-files", "--cached"]);
  const allFiles = output.trim().split("\n").filter(Boolean);

  // Filter out binary files
  const files = allFiles.filter((f) => !isBinary(f));
  if (files.length === 0) {
    return {
      totalLines: 0, totalFiles: 0, languageCount: 0,
      byLanguage: [], byType: [],
      testRatio: { sourceLines: 0, testLines: 0, ratio: 0, percentage: 0 },
    };
  }

  // Get repo root for full paths
  const repoPath = (await git.raw(["rev-parse", "--show-toplevel"])).trim();

  // Count lines in batches
  const fileLinesMap: { file: string; lines: number }[] = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (f) => ({ file: f, lines: await countLines(repoPath, f) }))
    );
    fileLinesMap.push(...results);
  }

  // Aggregate by language
  const langMap = new Map<string, { lines: number; files: number }>();
  // Aggregate by type
  const typeMap = new Map<FileType, { lines: number; files: number }>();

  let totalLines = 0;
  for (const { file, lines } of fileLinesMap) {
    totalLines += lines;
    const language = getLanguage(file);
    const fileType = getFileType(file);

    if (language) {
      const entry = langMap.get(language) ?? { lines: 0, files: 0 };
      entry.lines += lines;
      entry.files += 1;
      langMap.set(language, entry);
    }

    const typeEntry = typeMap.get(fileType) ?? { lines: 0, files: 0 };
    typeEntry.lines += lines;
    typeEntry.files += 1;
    typeMap.set(fileType, typeEntry);
  }

  // Build byLanguage sorted by lines desc
  const byLanguage: LanguageStat[] = Array.from(langMap.entries())
    .map(([language, data]) => ({
      language,
      lines: data.lines,
      files: data.files,
      percentage: totalLines > 0 ? Math.round((data.lines / totalLines) * 1000) / 10 : 0,
      color: LANGUAGE_COLORS[language] ?? DEFAULT_LANGUAGE_COLOR,
    }))
    .sort((a, b) => b.lines - a.lines);

  // Build byType
  const allTypes: FileType[] = ["source", "test", "config", "styles", "docs", "cicd", "other"];
  const byType: TypeStat[] = allTypes
    .map((type) => {
      const data = typeMap.get(type) ?? { lines: 0, files: 0 };
      return { type, lines: data.lines, files: data.files, color: TYPE_COLORS[type] };
    })
    .filter((t) => t.lines > 0 || t.files > 0);

  // Test ratio
  const sourceLines = typeMap.get("source")?.lines ?? 0;
  const testLines = typeMap.get("test")?.lines ?? 0;
  const testRatio = {
    sourceLines,
    testLines,
    ratio: sourceLines > 0 ? Math.round((testLines / sourceLines) * 100) / 100 : 0,
    percentage: sourceLines + testLines > 0
      ? Math.round((testLines / (sourceLines + testLines)) * 1000) / 10
      : 0,
  };

  return {
    totalLines,
    totalFiles: fileLinesMap.length,
    languageCount: langMap.size,
    byLanguage,
    byType,
    testRatio,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/git/codebase-stats.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/git/codebase-stats.ts src/main/git/codebase-stats.test.ts
git commit -m "feat(git): implement getCodebaseStats with line counting and aggregation"
```

---

### Task 4: Wire Up GitService, IPC Channel, Handler, and Preload

**Files:**
- Modify: `src/main/git/git-service.ts` (add method near line 1698, before `getLeaderboard`)
- Modify: `src/shared/ipc-channels.ts:200-203` (add channel)
- Modify: `src/main/ipc/stats.ipc.ts` (add handler)
- Modify: `src/preload/index.ts:356-361` (expose to renderer)

- [ ] **Step 1: Add IPC channel constant**

In `src/shared/ipc-channels.ts`, inside the `STATS` object (line ~200):

```typescript
  STATS: {
    LEADERBOARD: "git:stats:leaderboard",
    AUTHOR_DETAIL: "git:stats:author-detail",
    CODEBASE: "git:stats:codebase",          // ADD THIS
  },
```

- [ ] **Step 2: Add `getCodebaseStats()` method to GitService**

In `src/main/git/git-service.ts`, add before `getLeaderboard` (around line 1698):

At the top of `git-service.ts`, add the import:

```typescript
import { getCodebaseStats as computeCodebaseStats } from "./codebase-stats";
```

Then add the method:

```typescript
  async getCodebaseStats(): Promise<import("../../shared/codebase-stats-types").CodebaseStats> {
    const git = this.ensureRepo();
    return this.run("git ls-files (codebase stats)", [], async () => {
      return computeCodebaseStats(git);
    });
  }
```

- [ ] **Step 3: Add IPC handler**

In `src/main/ipc/stats.ipc.ts`, add after the existing handlers:

```typescript
  ipcMain.handle(IPC.STATS.CODEBASE, async () => {
    return gitService.getCodebaseStats();
  });
```

- [ ] **Step 4: Expose in preload**

In `src/preload/index.ts`, inside the `stats` section (around line 360), add:

```typescript
    getCodebaseStats: (): Promise<import("../shared/codebase-stats-types").CodebaseStats> =>
      ipcRenderer.invoke(IPC.STATS.CODEBASE),
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc-channels.ts src/main/git/git-service.ts src/main/ipc/stats.ipc.ts src/preload/index.ts
git commit -m "feat(ipc): wire up getCodebaseStats through IPC pipeline"
```

---

### Task 5: Zustand Store

**Files:**
- Create: `src/renderer/store/codebase-stats-store.ts`

- [ ] **Step 1: Create the store**

```typescript
// src/renderer/store/codebase-stats-store.ts
import { create } from "zustand";
import type { CodebaseStats } from "../../shared/codebase-stats-types";

interface CodebaseStatsState {
  stats: CodebaseStats | null;
  loading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  stats: null as CodebaseStats | null,
  loading: false,
  error: null as string | null,
};

export const useCodebaseStatsStore = create<CodebaseStatsState>((set) => ({
  ...initialState,

  loadStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await window.electronAPI.stats.getCodebaseStats();
      set({ stats, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/store/codebase-stats-store.ts
git commit -m "feat(store): add useCodebaseStatsStore for codebase statistics"
```

---

### Task 6: React Component — CodebaseStatsPanel

**Files:**
- Create: `src/renderer/components/stats/CodebaseStatsPanel.tsx`
- Create: `src/renderer/components/stats/CodebaseStatsPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

```typescript
// src/renderer/components/stats/CodebaseStatsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodebaseStatsPanel } from "./CodebaseStatsPanel";

// Mock stores
const mockLoadStats = vi.fn();
const mockReset = vi.fn();
let mockStatsState: Record<string, unknown> = {};
let mockRepo: { path: string } | null = { path: "/test/repo" };

vi.mock("../../store/codebase-stats-store", () => ({
  useCodebaseStatsStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockStatsState) : mockStatsState,
}));
vi.mock("../../store/repo-store", () => ({
  useRepoStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector({ repo: mockRepo }) : { repo: mockRepo },
}));

describe("CodebaseStatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = { path: "/test/repo" };
    mockStatsState = {
      stats: null,
      loading: false,
      error: null,
      loadStats: mockLoadStats,
      reset: mockReset,
    };
  });

  it("shows loading spinner when loading", () => {
    mockStatsState.loading = true;
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("shows error message with retry", () => {
    mockStatsState.error = "Something went wrong";
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/retry/i)).toBeTruthy();
  });

  it("shows no-repo message when no repo", () => {
    mockRepo = null;
    render(<CodebaseStatsPanel />);
    expect(screen.getByText(/open a repository/i)).toBeTruthy();
  });

  it("renders stats when data is available", () => {
    mockStatsState.stats = {
      totalLines: 15000,
      totalFiles: 120,
      languageCount: 4,
      byLanguage: [
        { language: "TypeScript", lines: 10000, files: 80, percentage: 66.7, color: "#89b4fa" },
        { language: "CSS", lines: 3000, files: 20, percentage: 20.0, color: "#f38ba8" },
      ],
      byType: [
        { type: "source", lines: 10000, files: 80, color: "#89b4fa" },
        { type: "test", lines: 3000, files: 30, color: "#a6e3a1" },
      ],
      testRatio: { sourceLines: 10000, testLines: 3000, ratio: 0.3, percentage: 23.1 },
    };
    render(<CodebaseStatsPanel />);
    expect(screen.getByText("15,000")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("CSS")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/stats/CodebaseStatsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CodebaseStatsPanel component**

Create `src/renderer/components/stats/CodebaseStatsPanel.tsx` with:
- Summary row (Total LOC, Files, Languages) as 3 metric cards
- By Language section: horizontal bar per language with name, colored bar, LOC count, percentage
- By Type section: 2×3 grid of cards with colored left border
- Test Ratio section: stacked bar with ratio text
- Loading, error, no-repo, empty states
- Refresh button in header
- All inline styles using Catppuccin CSS variables
- `useEffect` to load stats on mount and when `repo.path` changes

The component should follow the same patterns as `StatsPanel.tsx`:
- Full-height flexbox container: `{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", background: "var(--surface-0)", color: "var(--text-primary)", padding: "16px" }`
- Use `useRepoStore((s) => s.repo)` for repo state
- Use `useCodebaseStatsStore()` for stats state
- Format numbers with `toLocaleString()` for thousand separators

```typescript
// src/renderer/components/stats/CodebaseStatsPanel.tsx
import React, { useEffect } from "react";
import { useCodebaseStatsStore } from "../../store/codebase-stats-store";
import { useRepoStore } from "../../store/repo-store";

const TYPE_LABELS: Record<string, string> = {
  source: "Source", test: "Test", config: "Config",
  styles: "Styles", docs: "Docs", cicd: "CI/CD", other: "Other",
};

export const CodebaseStatsPanel: React.FC = () => {
  const repo = useRepoStore((s) => s.repo);
  const { stats, loading, error, loadStats, reset } = useCodebaseStatsStore();

  useEffect(() => {
    if (!repo) { reset(); return; }
    loadStats();
  }, [repo?.path]);

  if (!repo) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        Open a repository to see codebase statistics
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        Loading codebase statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px" }}>
        <span style={{ color: "var(--text-secondary)" }}>{error}</span>
        <button onClick={loadStats} style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "4px 12px", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats || stats.totalFiles === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        No tracked files found
      </div>
    );
  }

  const maxLangLines = stats.byLanguage[0]?.lines ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", background: "var(--surface-0)", color: "var(--text-primary)", padding: "16px", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>Codebase Statistics</span>
        <button onClick={loadStats} style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>
          ⟳ Refresh
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: "12px" }}>
        {[
          { label: "Total LOC", value: stats.totalLines.toLocaleString() },
          { label: "Files", value: stats.totalFiles.toLocaleString() },
          { label: "Languages", value: String(stats.languageCount) },
        ].map((item) => (
          <div key={item.label} style={{ flex: 1, background: "var(--surface-1)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{item.value}</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* By Language */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Lines of Code by Language
        </div>
        {stats.byLanguage.map((lang) => (
          <div key={lang.language} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}>
            <span style={{ width: "80px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{lang.language}</span>
            <div style={{ flex: 1, background: "var(--surface-1)", borderRadius: "3px", height: "18px" }}>
              <div style={{ background: lang.color, height: "100%", width: `${(lang.lines / maxLangLines) * 100}%`, borderRadius: "3px", minWidth: "2px" }} />
            </div>
            <span style={{ width: "60px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{lang.lines.toLocaleString()}</span>
            <span style={{ width: "40px", textAlign: "right", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>{lang.percentage}%</span>
          </div>
        ))}
      </div>

      {/* By Type */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Lines of Code by Type
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          {stats.byType.map((t) => (
            <div key={t.type} style={{ background: "var(--surface-1)", borderRadius: "6px", padding: "10px", textAlign: "center", borderLeft: `3px solid ${t.color}` }}>
              <div style={{ color: t.color, fontSize: "18px", fontWeight: "bold" }}>{t.lines.toLocaleString()}</div>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{TYPE_LABELS[t.type] ?? t.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Ratio */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px", marginBottom: "10px" }}>
          Test Code Ratio
        </div>
        {stats.testRatio.sourceLines + stats.testRatio.testLines > 0 ? (
          <>
            <div style={{ display: "flex", borderRadius: "6px", height: "24px", overflow: "hidden" }}>
              <div style={{ background: "#89b4fa", width: `${100 - stats.testRatio.percentage}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#1e1e2e", fontSize: "10px", fontWeight: "bold" }}>Source {(100 - stats.testRatio.percentage).toFixed(0)}%</span>
              </div>
              <div style={{ background: "#a6e3a1", width: `${stats.testRatio.percentage}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {stats.testRatio.percentage >= 10 && (
                  <span style={{ color: "#1e1e2e", fontSize: "10px", fontWeight: "bold" }}>Test {stats.testRatio.percentage.toFixed(0)}%</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              <span style={{ color: "#a6e3a1" }}>{stats.testRatio.testLines.toLocaleString()}</span> lines of test code for{" "}
              <span style={{ color: "#89b4fa" }}>{stats.testRatio.sourceLines.toLocaleString()}</span> lines of source code
              <span style={{ color: "var(--text-muted)" }}> — ratio 1:{stats.testRatio.ratio > 0 ? (1 / stats.testRatio.ratio).toFixed(1) : "∞"}</span>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>No source or test files found</div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run component tests to verify they pass**

Run: `npx vitest run src/renderer/components/stats/CodebaseStatsPanel.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/stats/CodebaseStatsPanel.tsx src/renderer/components/stats/CodebaseStatsPanel.test.tsx
git commit -m "feat(ui): add CodebaseStatsPanel component with language, type, and test ratio views"
```

---

### Task 7: Dockview Integration in AppShell

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`

- [ ] **Step 1: Add import**

At line ~23 (after StatsPanel import), add:

```typescript
import { CodebaseStatsPanel } from "../stats/CodebaseStatsPanel";
```

- [ ] **Step 2: Register in components record**

At line ~39 (after `stats` entry), add:

```typescript
  codebaseStats: () => <CodebaseStatsPanel />,
```

- [ ] **Step 3: Add to default layout**

After the `stats` panel creation (around line 286), add:

```typescript
      event.api.addPanel({
        id: "codebaseStats",
        component: "codebaseStats",
        title: "Codebase Stats",
        position: { referencePanel: statsPanel, direction: "within" },
      });
```

Note: `statsPanel` is the variable holding the stats panel reference from the existing code. Check the exact variable name used in the default layout creation section.

- [ ] **Step 4: Add migration logic**

After the existing stats migration block (around line 229), add:

```typescript
      if (!event.api.getPanel("codebaseStats")) {
        const ref =
          event.api.getPanel("stats") ??
          event.api.getPanel("console") ??
          event.api.getPanel("commandLog") ??
          event.api.getPanel("details");
        if (ref) {
          event.api.addPanel({
            id: "codebaseStats",
            component: "codebaseStats",
            title: "Codebase Stats",
            position: { referencePanel: ref, direction: "within" },
          });
        }
      }
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx
git commit -m "feat(layout): integrate CodebaseStatsPanel into dockview with migration"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 390+ tests PASS.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Lint**

Run: `npx eslint src/`
Expected: No new errors (existing warnings are OK).

- [ ] **Step 4: Manual smoke test**

Run: `npm start`
- Open a repository
- Check the dockview tab area — "Codebase Stats" tab should appear alongside Stats, Command Log, Console
- Click it — should show language bars, type cards, test ratio
- Click Refresh — should reload data
- Switch repos — should reset and reload

- [ ] **Step 5: Update memory**

Update MEMORY.md and claude-mem with feature completion.
