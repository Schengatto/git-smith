# ADR-002: Idee per funzionalita future

**Data:** 2026-03-21
**Stato:** Proposta
**Contesto:** Raccolta di idee per nuove funzionalita da implementare in Git Expansion, ispirate a Git Extensions e strumenti simili

---

## Contesto

Git Expansion ha gia implementato un ampio set di funzionalita (commit graph, merge/rebase/cherry-pick dialogs, conflict resolution, stash, branch management, AI integration, MCP, ecc.). Questo ADR raccoglie le idee per le prossime funzionalita, organizzate per categoria e priorita.

## Funzionalita gia implementate (riferimento)

- Commit graph con avatar, branch lines, HEAD highlight
- CommitDialog con tree view, stage/unstage, template convenzionali
- Merge, Rebase, Checkout dialog
- Merge conflict resolver (interno + tool esterni)
- Stash dialog
- Clone dialog avanzato
- Sidebar con branches, remotes, tags, submodules, stashes
- Branch filter e visibility filter
- Context menu (delete branch/tag, file history, blame, open, copy)
- AI commit messages, conflict resolution, code review (MCP)
- Git accounts multi-identita
- Author Statistics e Codebase Statistics panel
- Console panel (xterm.js)
- Auto-fetch, auto-update, changelog dialog
- Dialog child windows
- Conflict banner (merge/rebase/cherry-pick in progress)
- Cherry-pick dialog avanzato (selezione multipla, opzioni)
- Revert commit (right-click context menu)
- Search commits (full-text, autore, hash, pickaxe)
- Diff side-by-side toggle (unified/split in DiffViewer)
- Dark/Light theme toggle (toolbar)
- **Command Palette** (Ctrl+Shift+P) — accesso rapido a tutte le azioni
- **Git Reflog Viewer** — visualizza reflog con filtro e navigazione ai commit
- **Squash Commits** — dialog per squash di range di commit con editor messaggio combinato
- **File History Timeline** — timeline visiva con dots, compare mode (diff tra due versioni), navigazione al commit nel grafo
- **Archive/Export** — esporta commit/branch come .zip o .tar.gz
- **Git Bisect UI** — interfaccia grafica per bisect con good/bad/skip, stato e navigazione nel grafo
- **Worktrees** — gestione worktree multiple: crea, lista, rimuovi, apri in file manager
- **Patches** — crea patch da commit (format-patch) e applica patch con preview
- **File Blame View** — blame con annotazioni per riga, colori per eta (heatmap), navigazione al commit nel grafo
- **Syntax Highlighting nel Diff** — highlight del codice sorgente nei diff viewer via diff2html + highlight.js
- **Keyboard Shortcuts Panel** — dialog con tutti gli shortcut, filtro per ricerca, shortcut ? per aprirlo
- **GPG Commit Signing** — visualizzazione firma verificata (badge) nei dettagli commit
- **Git Notes** — aggiungere/visualizzare/rimuovere note ai commit, visualizzazione nel pannello commit info
- **Batch Operations** — fetch all su tutti i repo recenti in un colpo solo

---

## Idee per nuove funzionalita

### Categoria: Git Operations

| # | Funzionalita | Descrizione | Complessita | Priorita | Stato |
|---|-------------|-------------|-------------|----------|-------|
| 1 | ~~Cherry-pick dialog~~ | Dialog dedicato per cherry-pick con selezione multipla di commit, preview, opzioni (no-commit, mainline) | Media | Alta | ✅ Implementato |
| 2 | ~~Revert commit~~ | Right-click su commit -> Revert, con preview delle modifiche prima di confermare | Bassa | Alta | ✅ Implementato |
| 3 | ~~Squash commits~~ | Seleziona range di commit -> squash in uno solo con editor del messaggio combinato | Media | Media | ✅ Implementato |
| 4 | ~~Archive/Export~~ | Esporta un commit o branch come .zip/.tar.gz | Bassa | Bassa | ✅ Implementato |
| 5 | ~~Git Bisect UI~~ | Interfaccia grafica per `git bisect` (good/bad/skip) con evidenziazione nel grafo e progresso | Alta | Media | ✅ Implementato |
| 6 | ~~Worktrees~~ | Gestione worktree multiple: crea, lista, rimuovi, apri in nuova finestra | Media | Media | ✅ Implementato |
| 7 | **Submodules management** | Dialog per add/update/sync/deinit submodules (la sidebar li mostra gia) | Media | Bassa | |
| 8 | ~~Patches~~ | Crea/applica patch file (format-patch / am) con preview | Bassa | Bassa | ✅ Implementato |

### Categoria: UI/UX

| # | Funzionalita | Descrizione | Complessita | Priorita | Stato |
|---|-------------|-------------|-------------|----------|-------|
| 9 | ~~File blame view~~ | Blame inline con annotazioni per riga, navigazione per commit, colori per eta | Alta | Alta | ✅ Implementato |
| 10 | ~~File history timeline~~ | Grafo dedicato per la storia di un singolo file con diff tra versioni | Media | Alta | ✅ Implementato |
| 11 | ~~Search commits~~ | Ricerca full-text nei messaggi di commit, autore, hash, contenuto diff (pickaxe) | Media | Alta | ✅ Implementato |
| 12 | ~~Diff side-by-side~~ | Toggle tra unified e split diff view | Media | Media | ✅ Implementato |
| 13 | ~~Syntax highlighting nel diff~~ | Highlight del codice sorgente nei diff viewer | Media | Media | ✅ Implementato |
| 14 | ~~Dark/Light theme toggle~~ | Switch rapido nella toolbar o shortcut | Bassa | Bassa | ✅ Implementato |
| 15 | ~~Keyboard shortcuts panel~~ | Dialog con tutti gli shortcut, configurabili dall'utente | Media | Bassa | ✅ Implementato |

### Categoria: Collaboration & Integrations

| # | Funzionalita | Descrizione | Complessita | Priorita | Stato |
|---|-------------|-------------|-------------|----------|-------|
| 16 | **GitHub/GitLab PR integration** | Crea/visualizza Pull Request e Merge Request direttamente dall'app | Alta | Alta | |
| 17 | **Git LFS support** | Visualizza file LFS, track/untrack, info su storage | Media | Bassa | |
| 18 | ~~GPG commit signing~~ | Configurazione chiavi GPG, visualizzazione firma verificata sui commit | Media | Media | ✅ Implementato |

### Categoria: Productivity

| # | Funzionalita | Descrizione | Complessita | Priorita | Stato |
|---|-------------|-------------|-------------|----------|-------|
| 19 | ~~Command palette~~ | Ctrl+Shift+P per accesso rapido a tutte le azioni (stile VS Code) | Media | Alta | ✅ Implementato |
| 20 | ~~Git reflog viewer~~ | Visualizza il reflog per recuperare commit persi o operazioni annullate | Bassa | Media | ✅ Implementato |
| 21 | ~~Git notes~~ | Aggiungere/visualizzare note ai commit (`git notes`) | Bassa | Bassa | ✅ Implementato |
| 22 | ~~Batch operations~~ | Fetch/pull su tutti i repo nei preferiti in un colpo solo, con report | Media | Media | ✅ Implementato |

---

## Criteri di priorita

- **Alta**: Funzionalita presenti in Git Extensions che mancano, o richieste frequenti per un Git GUI
- **Media**: Nice-to-have che migliorano significativamente l'esperienza
- **Bassa**: Funzionalita di nicchia o con workaround disponibili

## Prossimi passi

Le uniche funzionalita rimanenti sono:
- **#7 Submodules management** (Media complessita, Bassa priorita)
- **#16 GitHub/GitLab PR integration** (Alta complessita, Alta priorita)
- **#17 Git LFS support** (Media complessita, Bassa priorita)
