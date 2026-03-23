# Contributing to GitSmith

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Git](https://git-scm.com/) 2.30+
- npm 10+

### Setup

```bash
git clone https://github.com/Schengatto/git-expansion.git
cd gitsmith
npm install
npm start
```

### Running Tests

```bash
# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (requires the app to be built)
npm run test:e2e

# Lint
npm run lint

# Format
npm run format
```

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/Schengatto/git-expansion/issues) to avoid duplicates
2. Use the **Bug Report** issue template
3. Include your OS, Node.js version, and steps to reproduce

### Suggesting Features

1. Check [existing issues](https://github.com/Schengatto/git-expansion/issues) for similar suggestions
2. Use the **Feature Request** issue template
3. Describe the use case, not just the solution

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure all tests pass: `npm test`
5. Ensure no lint errors: `npm run lint`
6. Ensure TypeScript compiles: `npx tsc --noEmit`
7. Commit with a descriptive message (see [Commit Messages](#commit-messages))
8. Push to your fork and open a Pull Request

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by [commitlint](https://commitlint.js.org/). A git hook will reject commits that don't follow the format.

```
<type>(<optional scope>): <short description>

<optional body>

<optional footer>
```

**Allowed types:**

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or external dependencies |
| `ci` | CI configuration |
| `chore` | Other changes (no src or test modification) |
| `revert` | Reverts a previous commit |

**Rules:**
- Subject must be max 100 characters
- Subject must be lowercase (no Start Case, PascalCase, or UPPER CASE)
- Use imperative mood: "add feature" not "added feature"

**Examples:**
```
feat: add interactive rebase dialog
fix: resolve commit graph rendering for merge commits
docs: update contributing guidelines
feat(graph): add search filter for commits
fix(sidebar)!: change branch checkout to single click

BREAKING CHANGE: branch checkout now requires single click instead of double click
```

### Versioning

This project follows [Semantic Versioning](https://semver.org/). Releases are managed with `standard-version`:

```bash
npm run release          # Auto-detect version bump from commits
npm run release:patch    # 0.1.0 → 0.1.1
npm run release:minor    # 0.1.0 → 0.2.0
npm run release:major    # 0.1.0 → 1.0.0
```

This will:
1. Bump the version in `package.json`
2. Generate/update `CHANGELOG.md` from commit messages
3. Create a git commit and tag
4. Push the tag to trigger the release CI workflow

## Architecture Overview

```
src/
├── main/           # Electron main process (Node.js)
│   ├── git/        # GitService wrapper, graph-builder algorithm
│   └── ipc/        # IPC handlers organized by domain
├── preload/        # contextBridge typed API
├── renderer/       # React UI
│   ├── components/ # React components
│   └── store/      # Zustand state stores
└── shared/         # Types and constants shared between processes
```

### Key Patterns

- **IPC**: `ipcMain.handle` / `ipcRenderer.invoke` with channels named `git:<domain>:<action>`
- **State**: Zustand stores (repo, graph, ui, command-log)
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Git operations**: All go through `GitService` which wraps `simple-git` and logs every command

### Adding a New Git Feature

1. Add the method to `src/main/git/git-service.ts`
2. Add the IPC channel to `src/shared/ipc-channels.ts`
3. Add the handler in `src/main/ipc/`
4. Expose it in `src/preload/index.ts`
5. Use it in the renderer via `window.electronAPI`

## Code Style

- TypeScript strict mode
- Prettier for formatting (run `npm run format`)
- ESLint for linting (run `npm run lint`)
- Prefer functional components with hooks
- Use JSDoc comments on utility functions, not on self-explanatory code
- No unnecessary comments — code should be self-documenting

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
