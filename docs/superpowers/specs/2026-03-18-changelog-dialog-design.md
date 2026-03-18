# Changelog Dialog — Design Specification

**Date:** 2026-03-18
**Feature:** Right-click commit in graph → "Generate Changelog..."
**Display:** Separate Electron child window (700×550, resizable)

## Overview

Adds a "Generate Changelog..." context menu entry to the commit graph. Opens a child window that shows a structured changelog grouped by conventional commit type, covering the range from a user-selected base ref (previous tag pre-selected) to the clicked commit.

## Scope

- Changelog covers the range `base..target` where target is the right-clicked commit
- User picks the base ref from a dropdown (tags, branches, commits); previous tag is pre-selected
- Commits are parsed and grouped by conventional commit prefix
- Merge commits are excluded (`--no-merges`) to avoid noise
- Read-only view with "Copy as Markdown" export

## Architecture

### Data Flow

```
Right-click commit → "Generate Changelog..." context menu item →
  openDialogWindow({ dialog: "ChangelogDialog", data: { commit: hash } }) →
    Dialog loads → IPC: CHANGELOG.TAGS_BEFORE(hash) → populate dropdown →
    User picks base, clicks "Generate" →
    IPC: CHANGELOG.GENERATE(from, to) →
    Main process: git log --no-merges from..to → parse conventional commits → group →
    Returns ChangelogData → Dialog renders grouped changelog
```

### Approach

**Backend-parsed (Approach A):** Main process fetches the git log for the range, parses conventional commit prefixes, and returns a structured `ChangelogData` object. The renderer only displays it.

Rationale: follows the existing pattern where backend handlers do the heavy lifting and the renderer receives ready-to-display data. Parsing logic is testable in isolation next to the git operations.

## Types

```typescript
// src/shared/git-types.ts

interface ChangelogEntry {
  hash: string;
  abbreviatedHash: string;
  subject: string;       // full subject line
  description: string;   // subject without type prefix
  type: string;          // "feat", "fix", "refactor", etc.
  scope?: string;        // optional scope from "feat(scope): ..."
  breaking: boolean;
  authorName: string;
  authorDate: string;
}

interface ChangelogGroup {
  label: string;         // "Features", "Bug Fixes", etc.
  color: string;         // CSS variable or hex for the group accent
  entries: ChangelogEntry[];
}

interface ChangelogData {
  from: string;          // base ref display name
  to: string;            // target ref display name
  groups: ChangelogGroup[];
  totalCommits: number;
  authors: string[];     // unique author names
}
```

## IPC Channels

```typescript
// src/shared/ipc-channels.ts
CHANGELOG: {
  TAGS_BEFORE: 'git:changelog:tags-before',  // (hash: string) => string[]
  GENERATE: 'git:changelog:generate',         // (from: string, to: string) => ChangelogData
}
```

- `TAGS_BEFORE`: returns tag names reachable before the given commit, ordered newest-first by creator date. Used to populate the "From" dropdown with the previous tag pre-selected.
- `GENERATE`: takes two ref strings, runs `git log --no-merges from..to`, parses conventional commits, returns grouped `ChangelogData`.

## Conventional Commit Grouping

| Prefix | Group Label | Color (Catppuccin) |
|--------|-------------|-------------------|
| `feat` | Features | Green (`--green` / `#a6e3a1`) |
| `fix` | Bug Fixes | Peach (`--peach` / `#fab387`) |
| `perf` | Performance | Mauve (`--mauve` / `#cba6f7`) |
| `refactor` | Refactoring | Blue (`--blue` / `#89b4fa`) |
| `docs` | Documentation | Teal (`--teal` / `#94e2d5`) |
| `test` | Tests | Yellow (`--yellow` / `#f9e2af`) |
| `chore`, `build`, `ci` | Maintenance | Overlay1 (`--overlay1` / `#6c7086`) |
| *(no prefix / unknown)* | Other | Subtext0 (`--subtext0` / `#a6adc8`) |

**Breaking changes:** Commits containing `BREAKING CHANGE:` in the body or `!` after the type (e.g., `feat!:`) are flagged with `breaking: true` and rendered in a separate "Breaking Changes" section at the top, colored red (`--red` / `#f38ba8`).

**Scope display:** If a commit has a scope (e.g., `feat(auth): add login`), the entry renders as "**auth:** add login" — scope in bold followed by the description.

## Parsing Logic

Located in `src/main/git/changelog-parser.ts`:

```
Pattern: /^(\w+)(\(.+?\))?(!)?:\s*(.+)$/
```

- Group 1: type (feat, fix, etc.)
- Group 2: optional scope with parens
- Group 3: optional `!` for breaking
- Group 4: description

Non-matching subjects go to the "Other" group. The parser also scans the commit body for `BREAKING CHANGE:` lines.

## Git Service Methods

In `src/main/git/git-service.ts`:

### `getTagsBefore(hash: string): Promise<string[]>`

```bash
git tag --merged <hash> --sort=-creatordate
```

Returns tag names reachable from the given commit, sorted by creator date (newest first). This ensures correct ordering regardless of tag naming convention.

### `getChangelogCommits(from: string, to: string): Promise<RawCommitForChangelog[]>`

Uses `simple-git`'s `.log()` API with `--no-merges` and NUL-delimited format to safely parse commit data including multi-line bodies:

```bash
git log <from>..<to> --no-merges --format='%H%x00%h%x00%s%x00%b%x00%an%x00%aI%x1e'
```

Fields separated by `%x00` (NUL), records separated by `%x1e` (record separator). This avoids collisions with commit body content.

Returns raw commit data (hash, abbreviated hash, subject, body, author name, author date) for parsing.

## Dialog Configuration

### dialog-types.ts

Add `"ChangelogDialog"` to the `DialogName` union type and add config entry:

```typescript
// src/shared/dialog-types.ts
ChangelogDialog: {
  width: 700,
  height: 550,
  minWidth: 500,
  minHeight: 400,
  modal: false,
}
```

## Preload API

```typescript
// src/preload/index.ts — add to electronAPI
changelog: {
  getTagsBefore: (hash: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGELOG.TAGS_BEFORE, hash),
  generate: (from: string, to: string): Promise<ChangelogData> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGELOG.GENERATE, from, to),
}
```

## UI Layout

### Window

- Opened via `openDialogWindow({ dialog: "ChangelogDialog", data: { commit: hash } })`
- Size: 700×550, resizable, minWidth: 500, minHeight: 400
- Title: `Changelog` (static — set via `document.title` in the dialog component after generation to `Changelog — <from>..<to>`)

### Top Bar

- **"From" dropdown:** tags reachable before target commit (sorted by creator date), previous tag pre-selected. Styled as select input matching app theme.
- **"to" display:** fixed, shows abbreviated hash + subject of the clicked commit (read-only)
- **"Generate" button:** primary action, accent color (`--blue`)

### Content Area

- Scrollable area filling remaining window height
- Each group rendered as:
  - Group header: colored label (e.g., "✦ Features" in green)
  - Left border in group color, 2px
  - Entries: description text (with bold scope if present) + abbreviated hash in muted color
- Breaking Changes section always renders first when present, with red color and ⚠ icon
- Empty state: centered message "Click Generate to create changelog" before first generation

### Bottom Bar

- Left: stats line — "{N} commits · {M} authors"
- Right: "Copy as Markdown" button + "Close" button

## Markdown Export Format

```markdown
## Changelog (<from>..<to>)

### ⚠ Breaking Changes
- remove legacy auth middleware (d4e5f6a)

### Features
- add changelog dialog to commit graph (abc1234)
- **auth:** add login flow (b2c3d4e)

### Bug Fixes
- fix graph pagination losing lane context (1a2b3c4)

### Refactoring
- extract dialog router for child windows (9a0b1c2)

### Maintenance
- update electron to v41 (3d4e5f6)
```

Empty groups are omitted from the output. Scoped entries render as `**scope:** description`.

## Context Menu Integration

In `CommitGraphPanel.tsx`, add entry after the "Compare" section (before "Copy Hash"):

```typescript
{
  label: 'Generate Changelog...',
  icon: '📋',
  onClick: () => openDialogWindow({ dialog: 'ChangelogDialog', data: { commit: row.commit.hash } })
}
```

Separator before the entry.

## Dialog Router Integration

In `DialogRouter.tsx`, add case:

```typescript
case 'ChangelogDialog':
  return <ChangelogDialog commit={params.commit} mode="window" />;
```

## Files to Create/Modify

### New Files
- `src/main/git/changelog-parser.ts` — conventional commit parser + grouping logic
- `src/main/git/changelog-parser.test.ts` — unit tests for parser
- `src/main/ipc/changelog.ipc.ts` — IPC handlers for TAGS_BEFORE and GENERATE
- `src/renderer/components/dialogs/ChangelogDialog.tsx` — dialog component

### Modified Files
- `src/shared/ipc-channels.ts` — add CHANGELOG channel constants
- `src/shared/git-types.ts` — add ChangelogEntry, ChangelogGroup, ChangelogData types
- `src/shared/dialog-types.ts` — add ChangelogDialog to DialogName union and DIALOG_CONFIGS
- `src/main/git/git-service.ts` — add getTagsBefore() and getChangelogCommits()
- `src/preload/index.ts` — expose changelog IPC methods
- `src/renderer/components/graph/CommitGraphPanel.tsx` — add context menu entry
- `src/renderer/components/dialogs/DialogRouter.tsx` — add ChangelogDialog case

## Error Handling

- If no tags exist before the commit, dropdown shows branches and root commit as fallback
- If `git log` returns no commits for the range, show "No commits in this range" message
- If parsing fails for a commit subject, it falls into the "Other" group (never errors)

## Testing

- `changelog-parser.test.ts`: unit tests for parsing various conventional commit formats, breaking changes detection, scope extraction, non-conventional fallback, scope display formatting
- Integration: verify IPC handlers return correct ChangelogData structure
