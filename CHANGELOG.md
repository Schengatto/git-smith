# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-14

### Added

- **Commit graph** with colored lane lines, virtualized scrolling, and ref decorations
- **Staging panel** with file-level and line-level (hunk) staging
- **Diff viewer** with unified and side-by-side modes (diff2html)
- **Commit dialog** with amend support, discard changes, and commit message template
- **Branch management**: create, rename, delete, checkout, merge, rebase, cherry-pick
- **Interactive rebase** UI with drag-and-drop, action selector, keyboard shortcuts
- **Reset branch** to any commit (soft, mixed, hard)
- **Tag management**: create (lightweight/annotated), delete, push to remote
- **Remote operations**: push, pull (merge/rebase), fetch (all/prune), clone
- **Remote management**: add, remove remotes
- **Blame view** with per-line annotations
- **File history** (git log --follow) with per-commit diff
- **Stash operations**: create, pop, apply, drop
- **Submodule support**: list, update
- **Search/filter** commits by message, author, hash, or ref name
- **Auto-fetch** with configurable interval and prune option
- **Settings panel** with git config editing, fetch, commit, diff, and graph options
- **Command log** showing every git command executed
- **Dark theme** (Catppuccin Mocha) and **light theme** (Catppuccin Latte) with toggle
- **Welcome screen** with recent repositories
- **Keyboard shortcuts**: Ctrl+O (open), Ctrl+K (commit), Ctrl+F (search)
- **Context menus** on branches and commits
- **Auto-updater** via GitHub Releases (electron-updater)
- **Cross-platform packaging** for Windows, macOS, and Linux
- **E2E test** setup with Playwright
- **Application icon** with git graph visual
