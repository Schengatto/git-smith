# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.3.0 (2026-03-18)


### Features

* add computeLineDiff LCS utility for AI conflict resolution ([22678e0](https://github.com/Schengatto/git-expansion/commit/22678e01452279c09ba724c8654f29125e7fb7d4))
* add embedded console panel with git shell ([37f26a2](https://github.com/Schengatto/git-expansion/commit/37f26a2769bb7f6f2546de4fa1adca3a31758f03))
* add external merge tool configuration with preset support ([dc77b3c](https://github.com/Schengatto/git-expansion/commit/dc77b3c0c5e394884afdfc6a3aca1d699cd23604))
* add file context menu with history and blame actions ([68aebb5](https://github.com/Schengatto/git-expansion/commit/68aebb582ddb54635246d7dc55b6100d54e17659))
* add Files tab to Diff/Files panel, search bar, and HEAD fallback ([70e6d69](https://github.com/Schengatto/git-expansion/commit/70e6d69c2c6af95397de47a99bdfef08549862df))
* add Google Gemini as AI provider option ([fc974c7](https://github.com/Schengatto/git-expansion/commit/fc974c71b65b21b9cdce0298299991736d82b3a2))
* add MCP server and AI client integration ([709e6a7](https://github.com/Schengatto/git-expansion/commit/709e6a79ca0e25b585911ee67cefee53d9c6b8e4))
* add multi-account Git identity management with SSH config import ([474e3b3](https://github.com/Schengatto/git-expansion/commit/474e3b3632fcf428dffb5329cc752b75da55c43c))
* auto-fetch on repo open and refresh graph after background fetch ([c879afc](https://github.com/Schengatto/git-expansion/commit/c879afcda9755ff8468f4d49cc46d51e23efc694))
* auto-launch external merge tool when file is selected ([931a58a](https://github.com/Schengatto/git-expansion/commit/931a58a7b47b564d7b9dbf7fbbf83ed1eacfc519))
* **changelog:** add ChangelogDialog component ([346c991](https://github.com/Schengatto/git-expansion/commit/346c991ad5df17d9ddc47e9a945043008a2f4fc8))
* **changelog:** add conventional commit parser with TDD ([c043505](https://github.com/Schengatto/git-expansion/commit/c043505daa29abfea06d77f7e75b0e53a62e4279))
* **changelog:** add git service methods for tags and changelog commits ([b14a3d0](https://github.com/Schengatto/git-expansion/commit/b14a3d0bf7e595469d24dee35c6b0372d9dfc8e4))
* **changelog:** add IPC handlers for changelog generation ([e4ce644](https://github.com/Schengatto/git-expansion/commit/e4ce644a8e3cfb05bd96d4a366ce30120340baf0))
* **changelog:** add shared types and IPC channel constants ([3f54726](https://github.com/Schengatto/git-expansion/commit/3f5472694c81b8ed8fb5a4678c623c4bd366f110))
* **changelog:** auto-generate on open and dropdown change ([98153df](https://github.com/Schengatto/git-expansion/commit/98153dfc993c772095074a2fcbda9211473a2a04))
* **changelog:** expose changelog IPC in preload API ([9d56b46](https://github.com/Schengatto/git-expansion/commit/9d56b469e114fa7fdd237c97b15779ad5b5e291f))
* **changelog:** wire dialog router and context menu entry ([aea114e](https://github.com/Schengatto/git-expansion/commit/aea114ede946bb7a45cc7d0d1db182d8061966de))
* **dialog-windows:** adapt CommitInfoWindow for window mode ([c7a7614](https://github.com/Schengatto/git-expansion/commit/c7a761429c057effda4f2be57fedeb19a535cc4b))
* **dialog-windows:** adapt InteractiveRebaseDialog for window mode ([4537158](https://github.com/Schengatto/git-expansion/commit/4537158bc44843e7f64197c3191ef48c81cdb1c4))
* **dialog-windows:** adapt MergeConflictDialog for window mode ([22c4378](https://github.com/Schengatto/git-expansion/commit/22c4378797d4d9560df22ae73fa10333d449c446))
* **dialog-windows:** adapt SettingsDialog for window mode ([da23cc7](https://github.com/Schengatto/git-expansion/commit/da23cc7beeba5d18bcad62ecbe2bad72553725da))
* **dialog-windows:** adapt StashDialog for window mode ([02dfbc5](https://github.com/Schengatto/git-expansion/commit/02dfbc56c567273a86c530ac5ebb557dfb1fbf4f))
* **dialog-windows:** add dialog IPC handlers ([503b0a0](https://github.com/Schengatto/git-expansion/commit/503b0a000072cb9a56cabf33888b8c6c0a765832))
* **dialog-windows:** add DialogRouter and entry point branching ([1131bb3](https://github.com/Schengatto/git-expansion/commit/1131bb37fe6465b6e30ced39895656509b01de6f))
* **dialog-windows:** add IPC channels and shared types ([e1d2a2d](https://github.com/Schengatto/git-expansion/commit/e1d2a2d916c1d015573449c5e73183a89de4ffe3))
* **dialog-windows:** add WindowManager for child BrowserWindows ([c92485e](https://github.com/Schengatto/git-expansion/commit/c92485ebca837eecbfeff12c94789812ed2531af))
* **dialog-windows:** expose dialog API in preload ([f86d8ed](https://github.com/Schengatto/git-expansion/commit/f86d8edfbd7aa0cc6009b4ca776ad986f52192a3))
* **dialog-windows:** wire up dialog opening from UI ([bb6ccb7](https://github.com/Schengatto/git-expansion/commit/bb6ccb741a8e212e8022684cd4d9a9f3365fe206))
* **layout:** add reset layout option and console panel migration ([6914ba0](https://github.com/Schengatto/git-expansion/commit/6914ba0dddc443a01e956dd64ab27601ff97342e))
* release v0.2.0 - basic features ([#2](https://github.com/Schengatto/git-expansion/issues/2)) ([45238b9](https://github.com/Schengatto/git-expansion/commit/45238b955a6093a8589b656f5875983cf1f1bf51))
* **release:** add APP IPC channel constants for auto-updater ([d8b4c37](https://github.com/Schengatto/git-expansion/commit/d8b4c37d2d424be78358491b7b46cabefaf07f71))
* **release:** add Squirrel.Windows lifecycle handling and externalize build deps ([ac5f60f](https://github.com/Schengatto/git-expansion/commit/ac5f60f0ab24fd398bc86f0738c4d38cb87a9832))
* **release:** configure Forge publisher-github with latest.yml generation ([74068a5](https://github.com/Schengatto/git-expansion/commit/74068a567c45a00216c9f5e48da8b4e9a686d7a6))
* **release:** harden auto-updater with isPackaged guard and IPC constants ([249d742](https://github.com/Schengatto/git-expansion/commit/249d74279d15c2f468fe2683692df03823116da0))
* **release:** show feedback dialog on manual Check for Updates ([f0e08cf](https://github.com/Schengatto/git-expansion/commit/f0e08cffe3ff590cef8aeb619ab6026c68609129))
* **stats:** add ActivityHeatmap component ([8e06635](https://github.com/Schengatto/git-expansion/commit/8e066354d7d4068c62ca814ecf2b895432e7204c))
* **stats:** add AuthorDetailExpander component ([e3cd4ea](https://github.com/Schengatto/git-expansion/commit/e3cd4ea136b3ad4aa4ab64485772d453629e0c6f))
* **stats:** add IPC channels and shared types ([5ed6899](https://github.com/Schengatto/git-expansion/commit/5ed6899786c17b65e4a152ba2f7c54e9f6945269))
* **stats:** add IPC handlers for leaderboard and author detail ([0a00bfa](https://github.com/Schengatto/git-expansion/commit/0a00bfac92dbff748e02586b40164b07892aa853))
* **stats:** add Sparkline SVG component ([c8a7976](https://github.com/Schengatto/git-expansion/commit/c8a7976ba8168880b4d3009161f3a98ae691121c))
* **stats:** add StatsPanel component with leaderboard and author detail ([3fc074e](https://github.com/Schengatto/git-expansion/commit/3fc074e2225270ea01a1f511b784c17e44430d22))
* **stats:** add Zustand store for stats panel state management ([845e79d](https://github.com/Schengatto/git-expansion/commit/845e79ded5e1bc6479d532d656fd1337ee62b3c2))
* **stats:** expose stats API in preload bridge ([26c8536](https://github.com/Schengatto/git-expansion/commit/26c85368ee8ffa91a9e1d758d80d1f7c19736f9e))
* **stats:** implement getLeaderboard with shortstat parsing and streak calculation ([7b2bbad](https://github.com/Schengatto/git-expansion/commit/7b2bbad049dcbc88296cf26303ee9a1398955083))
* **stats:** register StatsPanel in AppShell dockview layout ([c531be9](https://github.com/Schengatto/git-expansion/commit/c531be91c03b08226e2789e47f748201407c1e1f))
* update author links, add PayPal donation, fix wiki and issues URLs ([6785c31](https://github.com/Schengatto/git-expansion/commit/6785c316577af6d0b3db7ea767694ea778ec9600))


### Bug Fixes

* add commitInfo panel migration for existing saved layouts ([e31ba65](https://github.com/Schengatto/git-expansion/commit/e31ba6515ebd32dc51277feefeb43e4aba175aa9))
* build correct patch for line-level unstaging with reverse apply ([05f5970](https://github.com/Schengatto/git-expansion/commit/05f597094f219bd41f7ec334bda9abb6a47b5ac9))
* **changelog:** fix Generate button overflow, ref validation, and breaking dedup ([a85deff](https://github.com/Schengatto/git-expansion/commit/a85deff0852285e27d1c84fd7b37f3da743fcbd8))
* **changelog:** fix vertical scrollbar for overflowing content ([c0adc33](https://github.com/Schengatto/git-expansion/commit/c0adc33016e75c24896e9fcd06244f2bbbcb041a))
* **changelog:** move Generate button to bottom bar for reliable visibility ([0b804fb](https://github.com/Schengatto/git-expansion/commit/0b804fb3f2229e2ec7c87ff36e39f77b2f1913e6))
* **changelog:** restructure top bar layout so Generate button is always visible ([928002e](https://github.com/Schengatto/git-expansion/commit/928002e5d078c5f626698659c937d8191e9b256d))
* **changelog:** use git format escapes instead of literal null bytes in args ([7ac1830](https://github.com/Schengatto/git-expansion/commit/7ac18309746db6a4eb0a493099e5c40b1768bef0))
* checkout remote branch creates local tracking branch instead of detached HEAD ([658c0d5](https://github.com/Schengatto/git-expansion/commit/658c0d526042e33ccef6d3949732dfe64df07d4d))
* diff line numbers now scroll with file content ([72e9bb3](https://github.com/Schengatto/git-expansion/commit/72e9bb35a0358329ecc9a3609d472118f1309e56))
* disable line/hunk staging for conflicted files during merge ([ba4dfc4](https://github.com/Schengatto/git-expansion/commit/ba4dfc402ba0f80baed41f9b3e966905e14af129))
* fall back to full hunk unstage when all addition lines are selected ([4aecbb2](https://github.com/Schengatto/git-expansion/commit/4aecbb21d30bd0d13a02611d36e61d00f4a1129a))
* filter operation log dialog to only show current operation output ([2ddc139](https://github.com/Schengatto/git-expansion/commit/2ddc1397464248265f297bd1b4ed266147c166d9))
* fixed staging issue ([b4b5a65](https://github.com/Schengatto/git-expansion/commit/b4b5a6501465c655ada3fb7823c90946a60f7649))
* handle no-newline-at-eof marker in partial line staging patches ([1b500fd](https://github.com/Schengatto/git-expansion/commit/1b500fd3f39a15a17f110bdbc3d594ec11a7afcc))
* improve diff viewer contrast for both dark and light themes ([d4c4779](https://github.com/Schengatto/git-expansion/commit/d4c477954d0d48497634f5d86d6e055fe51ed7a3))
* merge tool preset selection resetting to None ([5d1b043](https://github.com/Schengatto/git-expansion/commit/5d1b043f04f365b6dc67b87764a71c00b5794510))
* show merge conflict banner in commit dialog when merge is blocked ([34433e0](https://github.com/Schengatto/git-expansion/commit/34433e02493ae84e4cf65900b15ba6cc5b115bda))
* show SetUpstream dialog instead of error when pushing branch without remote ([6a3ea6f](https://github.com/Schengatto/git-expansion/commit/6a3ea6fb6e9cd4291877fbacbd734a32710bfc36))
* staging deleted/renamed files no longer fails with pathspec error ([a2b5e8f](https://github.com/Schengatto/git-expansion/commit/a2b5e8fdbd7341918eb70505360715bdfa6a8a2d))
* **stats:** fix column alignment and author detail not loading ([4a71073](https://github.com/Schengatto/git-expansion/commit/4a71073ddaff6e1d839f233f2c3bd4f0623f0039))
* **stats:** include all branches in leaderboard and author detail queries ([26b71ca](https://github.com/Schengatto/git-expansion/commit/26b71ca8a36ad7ffb1d0dd2edbf131ad6bc99219))
* **stats:** reload author statistics on repo change instead of only resetting ([4cb3362](https://github.com/Schengatto/git-expansion/commit/4cb3362c2579fe308991e7201c17c429f0a8c089))
* **stats:** remove unused variables in ActivityHeatmap and stats-store test ([4f924d9](https://github.com/Schengatto/git-expansion/commit/4f924d98bca3416828c7a6abc8bb5c64a9645d41))
* unstage of files ([3640311](https://github.com/Schengatto/git-expansion/commit/36403114d2f9ef883cb8d2b1c25d68c902e260b2))


### Refactoring

* split commit info into independent Dockview panel separate from diff/files ([2b106ba](https://github.com/Schengatto/git-expansion/commit/2b106baa2e8d0d9278ea2a9a194ad7f74c39feac))


### Documentation

* add changelog dialog design specification ([f1ca922](https://github.com/Schengatto/git-expansion/commit/f1ca922c53bc6c9dce53a69e62021d853d82bf91))
* add changelog dialog implementation plan ([7dc2148](https://github.com/Schengatto/git-expansion/commit/7dc2148ee85d518fbb72303f921d576cef3fb831))
* add design spec for dialog child windows ([28293a5](https://github.com/Schengatto/git-expansion/commit/28293a577298d2878892ad138ee18df2839a8290))
* add design specification for author statistics panel ([c37a83d](https://github.com/Schengatto/git-expansion/commit/c37a83de9c1a2bf3157d6750a6452b7bebbe333f))
* add implementation plan for dialog child windows ([5d977b7](https://github.com/Schengatto/git-expansion/commit/5d977b77c49452bb0ab51eadf378f614919cb525))
* add release and auto-update design spec and implementation plan ([16eeea5](https://github.com/Schengatto/git-expansion/commit/16eeea5ffcf3fffc0ff3dd741571d8990c428bff))
* address spec review feedback for author statistics panel ([1dba253](https://github.com/Schengatto/git-expansion/commit/1dba2533af390540df25d85e32d5af604e732033))

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
