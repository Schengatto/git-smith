# AI-Assisted PR Description Generation

**Date:** 2026-03-22
**Status:** Approved

## Overview

Enhance the PrDialog "Create New" tab with AI-powered generation of PR title and body. The user selects a target branch from a dropdown with autocomplete, then uses dedicated buttons to generate title and/or body based on the diff and commits between the current branch and the target.

## Requirements

- Dropdown with autocomplete for target branch selection (local + remote branches)
- "Generate Title with AI" button next to the Title field
- "Generate Body with AI" button above the Body textarea
- AI body generation uses PR template if found in the repository
- Confirm dialog before overwriting non-empty fields (shown BEFORE any API calls)
- AI buttons visible only when an AI provider is configured
- AI buttons disabled when source === target branch
- Guard: if no commits found between branches, show inline message and skip AI call
- Errors displayed via existing `DialogError` component pattern

## Architecture

### Approach

Minimal backend additions, leverage existing infrastructure:
- `generatePrDescription()` already exists in MCP client
- `logRange.compare()` and `diffBranches.compare()` already provide commit/diff data
- `PrDialog.tsx` already has the Create tab with title/body fields

### Data fetching strategy

**Main process handles all data fetching.** The renderer sends `(sourceBranch, targetBranch)` to the IPC handler, which resolves commits, diff, and template internally, then calls the AI. This keeps the renderer thin and follows the existing `GENERATE_PR_DESCRIPTION` pattern where the handler fetches data server-side.

### Backend Changes

#### GitService: `getPrTemplate()`

Searches for a PR template in the repository, checking these paths in order:
1. `.github/pull_request_template.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `.github/PULL_REQUEST_TEMPLATE/*.md` (first file found in directory)
4. `docs/pull_request_template.md`
5. `docs/PULL_REQUEST_TEMPLATE.md`
6. `pull_request_template.md` (root)
7. `PULL_REQUEST_TEMPLATE.md` (root)

Returns the content of the first file found, or `null` if none exists.

#### MCP Client: `generatePrTitle(commits, diff)`

New method. Sends a prompt to generate a concise title (max 70 chars, conventional commit style). Input: commit list + truncated diff (4000 chars — title needs less context than body).

Prompt:
```
Generate a concise pull request title (max 70 characters) in conventional
commit style (e.g. "feat: add user authentication").
Based on these commits: {commits}
And this diff summary: {diff truncated to 4000 chars}
Return ONLY the title, no quotes, no explanation.
```

#### MCP Client: modify `generatePrDescription(commits, diff, template?)`

Add optional `template` parameter. When present, the prompt instructs the AI to follow the template structure instead of the default format. Template content comes from the repository and is treated as trusted user data.

Prompt (with template):
```
Generate a pull request description based on these commits and changes.
Follow this template structure:
{template}

Commits: {commits}
Diff: {diff truncated to 6000 chars}
Return ONLY the description body, no title.
```

Prompt (without template, existing behavior):
```
Generate a pull request description based on these commits and changes.
Use this format:
## Summary
## Changes
## Test plan

Commits: {commits}
Diff: {diff truncated to 6000 chars}
Return ONLY the description body, no title.
```

Diff truncation: body uses 6000 chars (vs 4000 for title) because the description needs more context to produce a meaningful summary of changes.

### IPC Channels

New channels:
- `IPC.PR.GET_TEMPLATE` -> `gitService.getPrTemplate()`
- `IPC.MCP.GENERATE_PR_TITLE` -> resolves commits/diff from `(sourceBranch, targetBranch)`, calls `mcpClient.generatePrTitle()`
- `IPC.MCP.GENERATE_PR_DESCRIPTION` (modified) -> now also resolves PR template internally and passes it to `mcpClient.generatePrDescription()`

Handler signatures:
- `GENERATE_PR_TITLE(sourceBranch: string, targetBranch: string): Promise<string>`
- `GENERATE_PR_DESCRIPTION(sourceBranch: string, targetBranch: string): Promise<string>` (changed from `commitHashes: string[]`)

Note: the old `GENERATE_PR_DESCRIPTION(commitHashes)` signature is not used elsewhere, so changing it is safe.

### Preload API

New methods:
- `window.electronAPI.pr.getTemplate(): Promise<string | null>`
- `window.electronAPI.mcp.generatePrTitle(sourceBranch: string, targetBranch: string): Promise<string>`

Modified:
- `window.electronAPI.mcp.generatePrDescription(sourceBranch: string, targetBranch: string): Promise<string>` (changed from `commitHashes: string[]`)

### Type updates

- `src/preload/index.ts`: update `ElectronAPI` type for new/modified methods
- No new shared types needed (uses existing `CommitInfo`, `BranchDiffResult`)

### Frontend Changes

#### PrDialog.tsx — Target Branch Dropdown

Replace the text input for target branch with an autocomplete dropdown:
- Load branches via `window.electronAPI.branch.list()` (already available)
- Show local and remote branches (strip `origin/` prefix, deduplicate)
- Text filter for quick search
- Default: `main` (fallback to `master` if main doesn't exist)

#### PrDialog.tsx — AI Title Button

- Position: next to the Title input field
- Style: small button with sparkle icon + "AI" text
- Click flow:
  1. If Title field is not empty, show confirm dialog "Overwrite current title?" — before any API calls
  2. If no commits between branches (guard), show inline error "No commits between branches" and stop
  3. Call `mcp.generatePrTitle(sourceBranch, targetBranch)`
  4. Populate Title field with result
  5. On error: display via `DialogError` component (set `error` state)
- Loading state: spinner on button, button disabled

#### PrDialog.tsx — AI Body Button

- Position: above the Body textarea
- Style: same as title button
- Click flow:
  1. If Body textarea is not empty, show confirm dialog "Overwrite current body?" — before any API calls
  2. If no commits between branches (guard), show inline error and stop
  3. Call `mcp.generatePrDescription(sourceBranch, targetBranch)` (handler resolves template internally)
  4. Populate Body textarea with result
  5. On error: display via `DialogError` component
- Loading state: spinner on button, button disabled

#### Visibility Conditions

- AI buttons visible only if `aiProvider !== "none"` (check settings)
- AI buttons disabled if source branch === target branch
- AI buttons disabled while generating (loading state)

#### "No commits" guard

Before calling AI, the renderer checks if there are commits between branches. Two options:
- **Option A**: Call `logRange.compare()` on target branch change and cache the count (responsive but adds a call)
- **Option B**: Let the main process handler return an empty string if no commits, and show error on empty result

Use **Option B** for simplicity — the main process handler returns `""` if `logRange` is empty, and the renderer shows "No changes found between branches" when the AI returns empty.

### Mcp Store changes

- Add `lastPrTitle: string | null` state
- Add `generatePrTitle(source: string, target: string): Promise<string>` action
- Modify `generatePrDescription` action to accept `(source: string, target: string)` instead of `commitHashes: string[]`
- Both actions set `generating = true` during execution and handle errors consistently

### Data Flow

```
User selects target branch from dropdown
  -> Click "AI Title" or "AI Body"
    -> [if field not empty] confirm dialog — BEFORE any API calls
    -> [if cancelled] stop
    -> renderer calls mcp.generatePrTitle(source, target)
       OR mcp.generatePrDescription(source, target)
    -> main process handler:
       1. logRange.compare(target, source) -> commits[]
       2. diffBranches.compare(target, source) -> diff
       3. [for body] getPrTemplate() -> template | null
       4. [if no commits] return ""
       5. callAi(prompt) -> result
    -> renderer receives result
    -> [if empty] show "No changes found between branches"
    -> populate field
```

## Files to Modify

| File | Action |
|------|--------|
| `src/main/git/git-service.ts` | Add `getPrTemplate()` |
| `src/main/mcp/mcp-client.ts` | Add `generatePrTitle()`, modify `generatePrDescription()` for template param |
| `src/shared/ipc-channels.ts` | Add `PR.GET_TEMPLATE`, `MCP.GENERATE_PR_TITLE` |
| `src/main/ipc/git-pr.ipc.ts` | Register handler for `GET_TEMPLATE` |
| `src/main/ipc/mcp.ipc.ts` | Register handler for `GENERATE_PR_TITLE`, modify `GENERATE_PR_DESCRIPTION` handler |
| `src/preload/index.ts` | Expose `pr.getTemplate()`, update `mcp.generatePrTitle()` and `mcp.generatePrDescription()` signatures |
| `src/renderer/store/mcp-store.ts` | Add `generatePrTitle()` action, `lastPrTitle` state, modify `generatePrDescription` signature |
| `src/renderer/components/dialogs/PrDialog.tsx` | Branch dropdown, AI buttons, confirm dialog, loading, error display |

## Tests

- `git-service-comprehensive.test.ts`: `getPrTemplate()` — template found at each path, not found, directory pattern
- `mcp-client.test.ts`: `generatePrTitle()`, `generatePrDescription()` with template, without template
- `mcp.ipc.test.ts`: handler returns empty string when no commits between branches
- `PrDialog.test.tsx`: AI buttons visible/hidden based on provider, confirm dialog on overwrite, loading states, error display, empty result handling
