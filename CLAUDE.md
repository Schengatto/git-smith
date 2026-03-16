# Git Expansion - Project Rules

IMPORTANT: These rules are NON-NEGOTIABLE. Every single rule MUST be followed on EVERY task.

## Overview

Git Expansion is a cross-platform Git GUI desktop app built with Electron + React + TypeScript, inspired by Git Extensions.

## Tech Stack

- **Runtime**: Electron 41 + Vite
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand
- **Git**: simple-git library
- **UI**: Dockview (panels), react-virtuoso (lists), Catppuccin theme
- **Build**: Electron Forge (Squirrel/ZIP/DEB/RPM)

## Architecture

```text
src/main/          → Electron main process (git ops, IPC handlers, store)
src/preload/       → Context bridge (typed API)
src/renderer/      → React UI (components, stores)
src/shared/        → Shared types & IPC channel constants
```

## Adding a New Feature (checklist)

1. Define IPC channel in `src/shared/ipc-channels.ts`
2. Add method to `src/main/git/git-service.ts` (if git operation)
3. Add backend logic in `src/main/store.ts` (if persistence needed)
4. Register IPC handler in `src/main/ipc/`
5. Expose via preload in `src/preload/index.ts`
6. Add Zustand actions in `src/renderer/store/`
7. Build React component in `src/renderer/components/`

## Commands

- `npm start` — Dev mode
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E tests
- `npm run make` — Build distributables
- `npx tsc --noEmit` — Type check
- `npx eslint src/` — Lint

## Code Style

- Inline styles for components (no separate CSS files for components)
- CSS variables for theming (defined in `src/renderer/index.css`)
- Commits follow Conventional Commits (commitlint + husky enforced)

## Workflow Rules (execute in order)

### 1. PRE-TASK: Consult Memory (BLOCKING)

Before writing ANY code or making ANY changes:

- Read MEMORY.md for relevant context
- Search claude-mem (`mem-search` skill or MCP tools) for past decisions, bugs, and patterns related to the task
- DO NOT proceed until this step is done

### 2. Unit Tests (BLOCKING)

- All new/changed code MUST be covered by unit tests before the task is considered complete
- If no test framework exists yet, set one up before proceeding

### 3. Test Suite (BLOCKING)

- ALL existing project unit tests MUST pass before the task is complete
- If a test fails, fix it — do not skip or disable it

### 4. Memory Update (BLOCKING — NEVER SKIP)

At the END of every task, ALWAYS update BOTH:

- `MEMORY.md` (local auto-memory)
- `claude-mem` (cross-session memory via MCP tools)

This MUST happen BEFORE asking about commit/push/deploy.
This is the most frequently skipped rule — pay extra attention.

### 5. End of Task
- Always suggest a good commit message
- Always ask the user if they want to commit and push
- Never auto-commit or auto-push without explicit confirmation
