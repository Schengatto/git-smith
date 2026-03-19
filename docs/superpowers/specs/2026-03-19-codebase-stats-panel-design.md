# Codebase Stats Panel — Design Specification

## Overview

New dockview panel ("Codebase Statistics") that displays lines-of-code metrics for the currently opened repository, broken down by programming language, file type, and test-to-source ratio.

## Data Source

- **Approach**: Direct analysis of git-tracked files via `git ls-files` + file reading (line counting)
- **Language detection**: Extension-based mapping covering 40+ languages
- **No external dependencies**: No cloc/tokei/scc required

## Backend: `getCodebaseStats()` in GitService

### Input
None (operates on current repo).

### Type Definitions

Location: `src/shared/codebase-stats-types.ts`

### Output: `CodebaseStats`
```typescript
interface CodebaseStats {
  totalLines: number;
  totalFiles: number;
  languageCount: number;
  byLanguage: LanguageStat[];   // sorted by lines descending
  byType: TypeStat[];
  testRatio: TestRatio;
}

interface LanguageStat {
  language: string;   // display name, e.g. "TypeScript"
  lines: number;
  files: number;
  percentage: number; // 0-100
  color: string;      // hex color for the bar
}

interface TypeStat {
  type: "source" | "test" | "config" | "styles" | "docs" | "cicd" | "other";
  lines: number;
  files: number;
  color: string;
}

interface TestRatio {
  sourceLines: number;
  testLines: number;
  ratio: number;      // testLines / sourceLines
  percentage: number;  // test as % of (source + test)
}
```

### Implementation Strategy

1. Run `git ls-files` to get all tracked files
2. For each file:
   - Determine **language** from extension (see mapping below)
   - Determine **type** from path patterns and extension
   - Count lines (`\n` count)
3. Aggregate into `CodebaseStats`
4. Skip binary files (detect by extension: images, fonts, compiled, etc.)

### File Type Classification Rules

| Type | Match criteria |
|------|---------------|
| **Test** | `*.test.*`, `*.spec.*`, files in `__tests__/`, `test/`, `tests/`, `spec/` directories |
| **Config** | `*.config.*`, `*rc`, `*rc.json`, `*rc.js`, `tsconfig*.json`, `package.json`, `.eslintrc*`, `.prettierrc*`, `Dockerfile`, `Makefile`, `forge.config.*`, `.yml`/`.yaml` NOT in CI/CD paths |
| **Styles** | `.css`, `.scss`, `.sass`, `.less`, `.styl` |
| **Docs** | `.md`, `.txt`, `.rst`, `.adoc`, `LICENSE`, `CHANGELOG` |
| **CI/CD** | Files in `.github/`, `.gitlab-ci*`, `Jenkinsfile`, `.circleci/` directories (path-based, not extension-based) |
| **Source** | Everything else that has a recognized language extension |
| **Other** | Unrecognized extensions (count files only, no LOC) |

### Language Extension Mapping (non-exhaustive)

**Web/Frontend**: `.ts` `.tsx` `.js` `.jsx` `.vue` `.svelte` `.html` `.css` `.scss` `.sass` `.less`
**Backend**: `.py` `.go` `.rs` `.java` `.kt` `.scala` `.rb` `.php` `.cs` `.fs` `.ex` `.exs` `.clj` `.erl` `.hs`
**Systems**: `.c` `.cpp` `.cc` `.cxx` `.h` `.hpp` `.zig` `.nim` `.d`
**Shell/Script**: `.sh` `.bash` `.zsh` `.fish` `.ps1` `.bat` `.cmd`
**Data/Config**: `.json` `.yaml` `.yml` `.toml` `.xml` `.ini` `.env`
**Mobile**: `.swift` `.m` `.mm` `.dart`
**Other**: `.sql` `.graphql` `.proto` `.r` `.R` `.lua` `.perl` `.pl` `.groovy` `.tf` `.hcl`

Each language gets a stable color from a predefined Catppuccin-based palette.

### Binary File Extensions (skip)
`.png` `.jpg` `.jpeg` `.gif` `.ico` `.woff` `.woff2` `.ttf` `.eot` `.mp3` `.mp4` `.zip` `.tar` `.gz` `.exe` `.dll` `.so` `.dylib` `.pdf` `.lock`

Note: `.svg` is excluded from the binary list (it's XML text, counted as markup). `.lock` files (e.g., `package-lock.json`) are skipped intentionally — they are generated files with excessive line counts.

### Performance Considerations

- File reading uses a concurrency limiter (chunk-based: process 50 files at a time via `Promise.all`, then next 50)
- Results are cached in memory; cache is invalidated only on repo path change or manual refresh (NOT on `repoChanged` events like fetch/pull — those don't change local files)
- Binary files are skipped entirely (no read attempt)
- For large repos (>5000 files), show a progress message "Scanning X/Y files..." instead of a plain spinner

## IPC

| Channel | Direction | Payload |
|---------|-----------|---------|
| `git:stats:codebase` | renderer → main → renderer | `() => CodebaseStats` |

## Frontend

### Zustand Store: `useCodebaseStatsStore`

```typescript
interface CodebaseStatsState {
  stats: CodebaseStats | null;
  loading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  reset: () => void;
}
```

- Calls `window.electronAPI.stats.getCodebaseStats()`
- Loads on mount when repo is open; reloads when `repo.path` changes
- Does NOT auto-refresh on `repoChanged` (fetch/pull don't change local files)
- Manual refresh via button
- `reset()` clears stats on repo switch to prevent stale data display

### Component: `CodebaseStatsPanel`

Location: `src/renderer/components/stats/CodebaseStatsPanel.tsx` (sibling to existing `StatsPanel.tsx`)

**Layout** (vertical scroll, 3 sections):

1. **Summary row** — 3 metric cards: Total LOC, Total Files, Languages count
2. **By Language** — horizontal bar chart, each row: language name (80px) | colored bar (proportional) | LOC count | percentage
3. **By Type** — 2×3 grid of cards with colored left border: Source, Test, Config, Styles, Docs, CI/CD
4. **Test Code Ratio** — stacked horizontal bar (source | test) with ratio text below

**States**:
- Loading: spinner centered
- Error: error message with retry button
- No repo: "Open a repository to see codebase statistics"
- Empty: "No tracked files found"

**Styling**: Inline styles, Catppuccin CSS variables (`--surface-0`, `--text-primary`, etc.)

### Dockview Integration

- Panel ID: `codebaseStats`
- Component key: `codebaseStats`
- Title: `Codebase Stats`
- Default position: tab within the same group as `stats` (Author Statistics), `commandLog`, `console`
- Migration: if `codebaseStats` panel not found in saved layout, add as tab next to `stats`; fallback to `console`, then `commandLog`, then `details`

## Preload

Expose in `window.electronAPI.stats`:
```typescript
getCodebaseStats: () => ipcRenderer.invoke("git:stats:codebase")
```

## Testing

- **GitService unit tests**: mock `git.raw()` for `ls-files`, mock `fs.readFile` for line counting, verify language detection and type classification
- **Component tests**: mock store, verify loading/error/data states render correctly
- **Edge cases**: empty repo, repo with only binary files, very large files
