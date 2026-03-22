# ADR 004 — Feature Expansion Plan

**Status:** Proposed
**Date:** 2026-03-21
**Context:** Git Expansion has completed all 8 phases of the original plan, all 22 ADR-002 features, and all 18 ADR-003 quality items. This ADR proposes 20 new features to further improve the application.

---

## Feature List

### Tier 1 — High Impact

| # | Feature | Complexity | Priority |
|---|---------|-----------|----------|
| 1 | Git Grep / Code Search | Medium | P0 |
| 2 | Branch Diff Comparison | Medium | P0 |
| 3 | .gitignore Visual Editor | Low | P0 |
| 4 | Drag & Drop Staging | Low | P0 |
| 5 | Multi-repo Workspace (Tabs) | High | P1 |

### Tier 2 — Advanced

| # | Feature | Complexity | Priority |
|---|---------|-----------|----------|
| 6 | Integrated Terminal | High | P1 |
| 7 | Branch Commit Range Comparison | Medium | P1 |
| 8 | 3-Way Merge Conflict Editor | High | P2 |
| 9 | Git Hooks Manager | Medium | P1 |
| 10 | Commit Message Templates | Low | P0 |

### Tier 3 — Quality of Life

| # | Feature | Complexity | Priority |
|---|---------|-----------|----------|
| 11 | Undo/Redo Git Operations | Medium | P1 |
| 12 | Desktop Notifications | Low | P1 |
| 13 | Commit Message Snippets | Low | P1 |
| 14 | Advanced Statistics Dashboard | Medium | P2 |
| 15 | Author Filter in Commit Graph | Low | P0 |

### Tier 4 — Integrations

| # | Feature | Complexity | Priority |
|---|---------|-----------|----------|
| 16 | CI/CD Pipeline Status | Medium | P1 |
| 17 | Issue Tracker Linking | Medium | P2 |
| 18 | Inline Code Review Comments | High | P2 |
| 19 | SSH Key Manager | Medium | P2 |
| 20 | Gist/Snippet Creation | Low | P2 |

---

## Feature Details

### #1 — Git Grep / Code Search

**Descrizione:** Ricerca full-text nel repository tramite `git grep`, con UI dedicata che mostra risultati raggruppati per file, preview del contesto, e possibilita di aprire il file nell'editor.

**IPC Channels:**
- `git:grep:search` — Esegue `git grep` con pattern, opzioni (case-insensitive, regex, whole-word)
- `git:grep:cancel` — Annulla una ricerca in corso

**Implementazione:**
1. `src/shared/ipc-channels.ts` — Aggiungere canali `git:grep:search`, `git:grep:cancel`
2. `src/main/git/git-service.ts` — Metodo `grep(pattern, options)` che invoca `git grep -n --heading`
3. `src/main/ipc/grep-handlers.ts` — Handler IPC con supporto abort
4. `src/preload/index.ts` — Esporre `gitGrep.search()`, `gitGrep.cancel()`
5. `src/renderer/store/grep-store.ts` — Store Zustand per risultati, loading, filtri
6. `src/renderer/components/GrepPanel/` — Pannello con barra di ricerca, lista risultati virtualizzata, preview contesto

**Test:**
- Unit: parsing output `git grep`, filtri, regex validation
- E2E: ricerca in test repo, verifica risultati corretti

---

### #2 — Branch Diff Comparison

**Descrizione:** Confronto diretto tra due branch/tag/commit, mostrando lista file modificati, statistiche (aggiunte/rimozioni), e diff aggregato navigabile.

**IPC Channels:**
- `git:diff:branches` — Esegue `git diff branch1...branch2 --stat` e `git diff branch1...branch2`

**Implementazione:**
1. `src/shared/ipc-channels.ts` — Aggiungere `git:diff:branches`
2. `src/main/git/git-service.ts` — Metodo `diffBranches(from, to)` con output stat + patch
3. `src/main/ipc/diff-handlers.ts` — Aggiungere handler
4. `src/preload/index.ts` — Esporre `gitDiff.branches()`
5. `src/renderer/components/BranchDiffDialog/` — Dialog con due dropdown per selezionare ref, lista file con stat, DiffViewer per file selezionato
6. Menu contestuale: aggiungere "Compare with..." su branch nel sidebar e nel graph

**Test:**
- Unit: parsing diff stat, gestione ref invalidi
- E2E: confronto due branch in test repo

---

### #3 — .gitignore Visual Editor

**Descrizione:** Editor visuale per `.gitignore` con aggiunta pattern via UI, template per linguaggio/framework, preview dei file che verrebbero ignorati.

**IPC Channels:**
- `git:gitignore:read` — Legge il file `.gitignore`
- `git:gitignore:write` — Scrive il file `.gitignore`
- `git:gitignore:preview` — Esegue `git status --ignored --short` per mostrare file ignorati
- `git:gitignore:templates` — Restituisce template da gitignore.io o bundle locale

**Implementazione:**
1. `src/shared/ipc-channels.ts` — Aggiungere canali gitignore
2. `src/main/git/git-service.ts` — Metodi per leggere/scrivere `.gitignore`, listar file ignorati
3. `src/main/ipc/gitignore-handlers.ts` — Handler IPC
4. `src/preload/index.ts` — Esporre `gitIgnore.*`
5. `src/renderer/components/GitignoreDialog/` — Dialog con: editor testuale, bottone "+ Add pattern", dropdown template, sezione preview file ignorati
6. Bundlare template comuni (Node, Python, Java, Rust, Go, etc.) in `src/shared/gitignore-templates.ts`

**Test:**
- Unit: parsing .gitignore, merge con template
- E2E: aggiungere pattern, verificare preview

---

### #4 — Drag & Drop Staging

**Descrizione:** Drag and drop di file tra le liste unstaged e staged nel CommitDialog, con supporto multi-selezione.

**Implementazione:**
1. `src/renderer/components/CommitDialog/StagingPanel.tsx` — Aggiungere `draggable` sui file item, `onDragOver`/`onDrop` sulle liste
2. Supporto multi-selezione: Ctrl+click per selezione multipla, drag del gruppo
3. Feedback visivo: highlight della zona di drop, indicatore numero file trascinati
4. Riutilizzare le azioni `stageFiles`/`unstageFiles` gia esistenti nello store

**Test:**
- Unit: logica selezione multipla, validazione drop target
- E2E: drag file da unstaged a staged

---

### #5 — Multi-repo Workspace (Tabs)

**Descrizione:** Gestire piu repository contemporaneamente in tab nella stessa finestra, con possibilita di switch rapido e stato indipendente per ogni repo.

**IPC Channels:**
- `workspace:tab:open` — Apre un nuovo tab con un repository
- `workspace:tab:close` — Chiude un tab
- `workspace:tab:list` — Lista tab aperti
- `workspace:tab:switch` — Cambia tab attivo

**Implementazione:**
1. `src/renderer/store/workspace-store.ts` — Store Zustand per gestione tab: `{ tabs: Tab[], activeTabId }` dove ogni Tab ha il proprio `repoPath` e stato
2. `src/renderer/components/TabBar/` — Barra tab con nome repo, icona dirty/clean, bottone chiudi, drag per riordinare
3. Refactor `AppShell` — Isolare lo stato repo-specifico in un contesto per-tab, lazy mount/unmount dei pannelli
4. `src/main/git/git-service.ts` — Supportare operazioni multiple concurrent (gia thread-safe con simple-git)
5. Persistenza: salvare tab aperti in settings, ripristinare all'avvio
6. Shortcut: Ctrl+Tab per switch, Ctrl+W per chiudere tab

**Test:**
- Unit: workspace store (add/remove/switch tab)
- E2E: aprire due repo in tab diversi, verificare switch

---

### #6 — Integrated Terminal

**Descrizione:** Terminale embedded nell'app tramite xterm.js, aperto nella directory del repository corrente, con supporto per comandi git diretti.

**Dipendenze:** `xterm`, `xterm-addon-fit`, `node-pty`

**IPC Channels:**
- `terminal:create` — Crea un nuovo processo PTY
- `terminal:write` — Invia input al terminale
- `terminal:resize` — Ridimensiona il terminale
- `terminal:close` — Chiude il processo PTY
- `terminal:data` — Evento: output dal terminale (main → renderer)

**Implementazione:**
1. `src/main/terminal/pty-manager.ts` — Gestione processi node-pty, spawn shell nella repo dir
2. `src/main/ipc/terminal-handlers.ts` — Handler IPC per create/write/resize/close
3. `src/preload/index.ts` — Esporre `terminal.*` API
4. `src/renderer/components/TerminalPanel/` — Componente con xterm.js, addon fit per auto-resize, integrazione con dockview come pannello bottom
5. Supporto tab multipli nel terminale
6. Auto-cd nella directory del repo quando si cambia repository

**Note:** `node-pty` e un modulo nativo — richiede rebuild per ogni piattaforma in electron-forge config.

**Test:**
- Unit: pty-manager lifecycle (create, write, close)
- E2E: aprire terminale, eseguire `git status`, verificare output

---

### #7 — Branch Commit Range Comparison

**Descrizione:** Visualizzare graficamente i commit presenti in un branch ma non nell'altro (e viceversa), usando `git log branch1..branch2` e `git log branch2..branch1`.

**IPC Channels:**
- `git:log:range` — Esegue `git log ref1..ref2` con formato strutturato

**Implementazione:**
1. `src/shared/ipc-channels.ts` — Aggiungere `git:log:range`
2. `src/main/git/git-service.ts` — Metodo `logRange(from, to)` con parsing commit
3. `src/main/ipc/log-handlers.ts` — Handler IPC
4. `src/preload/index.ts` — Esporre `gitLog.range()`
5. `src/renderer/components/BranchCompareDialog/` — Dialog con due dropdown ref, due colonne di commit (solo in A, solo in B), click su commit per vedere dettagli
6. Integrazione: accessibile da context menu "Compare branches..." nel sidebar

**Test:**
- Unit: parsing output log range, gestione branch inesistenti
- E2E: confrontare due branch divergenti

---

### #8 — 3-Way Merge Conflict Editor

**Descrizione:** Editor di merge conflict integrato con vista 3-way (base, ours, theirs) e pannello risultato, con possibilita di accettare blocchi singoli o combinazioni.

**Dipendenze:** `monaco-editor` o `codemirror` (per editor con syntax highlighting)

**IPC Channels:**
- `git:conflict:read-versions` — Legge le 3 versioni del file (`:1:`, `:2:`, `:3:`)
- `git:conflict:save-resolution` — Salva il file risolto e fa `git add`

**Implementazione:**
1. `src/main/git/git-service.ts` — Metodi `getConflictVersions(filePath)` usando `git show :1:file`, `:2:file`, `:3:file`
2. `src/main/ipc/conflict-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `gitConflict.readVersions()`, `gitConflict.saveResolution()`
4. `src/renderer/components/MergeEditor/` — Layout 3 pannelli (base top-center, ours left, theirs right) + pannello risultato bottom
5. Ogni blocco conflitto ha bottoni: "Accept Ours", "Accept Theirs", "Accept Both", "Edit Manually"
6. Syntax highlighting basato su estensione file
7. Toolbar: "Accept All Ours", "Accept All Theirs", "Save & Mark Resolved"

**Test:**
- Unit: parsing versioni conflitto, merge blocchi
- E2E: aprire file in conflitto, risolvere, verificare risultato

---

### #9 — Git Hooks Manager

**Descrizione:** UI per visualizzare, creare, modificare, abilitare/disabilitare gli hook git del repository (`.git/hooks/` o path custom via `core.hooksPath`).

**IPC Channels:**
- `git:hooks:list` — Lista hook presenti con stato (attivo/disabilitato)
- `git:hooks:read` — Legge il contenuto di un hook
- `git:hooks:write` — Scrive/crea un hook
- `git:hooks:toggle` — Abilita/disabilita (rename .sample)
- `git:hooks:delete` — Elimina un hook

**Implementazione:**
1. `src/main/git/hooks-service.ts` — Servizio dedicato: legge `core.hooksPath` o default `.git/hooks/`, lista file, gestisce permessi esecuzione
2. `src/main/ipc/hooks-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `gitHooks.*`
4. `src/renderer/components/HooksDialog/` — Dialog con: lista hook (pre-commit, pre-push, commit-msg, etc.), stato on/off, editor contenuto, template per hook comuni
5. Template predefiniti: lint-staged, commitlint, test runner, branch naming
6. Warning quando husky e attivo (evitare conflitti)

**Test:**
- Unit: parsing hooks directory, toggle logic
- E2E: creare hook, verificare presenza, toggle, eliminare

---

### #10 — Commit Message Templates

**Descrizione:** Template personalizzabili per messaggi di commit con placeholder, selezionabili da dropdown nel CommitDialog. Supporto per Conventional Commits e template custom.

**Implementazione:**
1. `src/shared/settings-types.ts` — Aggiungere `commitTemplates: CommitTemplate[]` a `AppSettings`
2. `src/main/store.ts` — Default templates: feat, fix, docs, refactor, test, chore (Conventional Commits)
3. `src/renderer/components/CommitDialog/TemplateSelector.tsx` — Dropdown con lista template, click applica al campo messaggio
4. `src/renderer/components/SettingsDialog/` — Tab commit: sezione per gestire template (add/edit/delete)
5. Formato template: `{ name, prefix, body, description }` — es. `{ name: "Feature", prefix: "feat: ", body: "", description: "New feature" }`
6. Supporto placeholder: `{scope}`, `{description}`, `{body}`, `{breaking}` con prompt inline

**Test:**
- Unit: template rendering con placeholder, settings persistence
- E2E: selezionare template, verificare messaggio applicato

---

### #11 — Undo/Redo Git Operations

**Descrizione:** Stack di operazioni git recenti con possibilita di annullare tramite reflog. Mostra cronologia operazioni con bottone undo per ciascuna.

**IPC Channels:**
- `git:undo:history` — Restituisce le ultime N operazioni dal reflog con info
- `git:undo:revert` — Esegue l'undo di un'operazione (reset al reflog precedente)

**Implementazione:**
1. `src/main/git/git-service.ts` — Metodo `getUndoHistory()` che parsa reflog con contesto (checkout, commit, merge, rebase, etc.)
2. `src/main/git/undo-service.ts` — Logica undo: mappa tipo operazione → strategia di annullamento (commit → reset HEAD~1, checkout → checkout @{1}, etc.)
3. `src/main/ipc/undo-handlers.ts` — Handler IPC
4. `src/preload/index.ts` — Esporre `gitUndo.*`
5. `src/renderer/components/UndoPanel/` — Pannello o dropdown nella toolbar con lista operazioni recenti, bottone undo, conferma per operazioni distruttive
6. Shortcut: Ctrl+Z (con contesto — solo quando focus non e su input text)

**Test:**
- Unit: mapping operazione → strategia undo, parsing reflog
- E2E: fare commit, undo, verificare HEAD tornato indietro

---

### #12 — Desktop Notifications

**Descrizione:** Notifiche native del sistema operativo per eventi importanti: fetch completato con nuovi commit, push riuscito/fallito, background operations.

**Implementazione:**
1. `src/shared/settings-types.ts` — Aggiungere `notifications: { enabled, onFetch, onPush, onError }` a settings
2. `src/main/notifications/notification-service.ts` — Servizio che usa `Electron.Notification` API
3. `src/main/ipc/` — Integrare notifiche negli handler esistenti: dopo fetch (se nuovi commit), dopo push, su errori
4. `src/renderer/components/SettingsDialog/` — Sezione notifiche in tab General
5. Notifiche contestuali: "3 new commits on main from remote", "Push to origin/feature-x successful"
6. Click su notifica porta focus all'app e naviga al contesto rilevante

**Test:**
- Unit: notification-service logic, settings filtering
- E2E: trigger fetch con nuovi commit, verificare notifica

---

### #13 — Commit Message Snippets

**Descrizione:** Libreria di frasi/tag frequenti salvabili e inseribili nel messaggio di commit con un click. Diverso dai template: gli snippet sono frammenti brevi inseribili in qualsiasi punto.

**Implementazione:**
1. `src/shared/settings-types.ts` — Aggiungere `commitSnippets: Snippet[]` dove `Snippet = { label, text, shortcut? }`
2. `src/main/store.ts` — Default snippets: "Co-authored-by:", "BREAKING CHANGE:", "Closes #", "Refs #", "Signed-off-by:"
3. `src/renderer/components/CommitDialog/SnippetMenu.tsx` — Menu popup (attivabile con bottone o shortcut) che mostra snippet, click inserisce al cursore
4. `src/renderer/components/SettingsDialog/` — Sezione per gestire snippet custom
5. Auto-complete: quando si digita un trigger (es. `co:`) suggerire lo snippet corrispondente

**Test:**
- Unit: inserimento snippet alla posizione cursore, gestione settings
- E2E: aprire menu snippet, inserire nel messaggio

---

### #14 — Advanced Statistics Dashboard

**Descrizione:** Dashboard con grafici avanzati: commit per giorno/settimana/mese, heatmap attivita (stile GitHub), code churn (linee aggiunte vs rimosse nel tempo), top contributor nel tempo.

**Dipendenze:** `recharts` o `chart.js` per grafici

**IPC Channels:**
- `git:stats:timeline` — Commit aggregati per periodo (giorno/settimana/mese)
- `git:stats:heatmap` — Dati per heatmap attivita (ultimo anno)
- `git:stats:churn` — Linee aggiunte/rimosse per periodo
- `git:stats:contributors-timeline` — Contributi per autore nel tempo

**Implementazione:**
1. `src/main/git/stats-service.ts` — Servizio dedicato che usa `git log` con formati custom per aggregazione
2. `src/main/ipc/stats-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `gitStats.*`
4. `src/renderer/components/StatsPanel/` — Estendere il pannello stats esistente con:
   - Grafico a barre: commit per periodo (selettore giorno/settimana/mese)
   - Heatmap: griglia 52x7 stile GitHub contributions
   - Grafico a linee: code churn nel tempo
   - Grafico stacked area: contributi per autore
5. Filtri: intervallo date, branch, autore

**Test:**
- Unit: aggregazione dati timeline, calcolo heatmap
- E2E: aprire dashboard, verificare rendering grafici

---

### #15 — Author Filter in Commit Graph

**Descrizione:** Filtro per autore nel commit graph, per evidenziare o mostrare solo i commit di un determinato autore.

**Implementazione:**
1. `src/renderer/store/commit-graph-store.ts` — Aggiungere stato `authorFilter: string | null` e `authorFilterMode: 'highlight' | 'filter'`
2. `src/renderer/components/CommitGraph/AuthorFilter.tsx` — Dropdown con lista autori (estratti dai commit caricati), campo ricerca, toggle modalita (highlight/nascondi)
3. `src/renderer/components/CommitGraph/CommitGraphPanel.tsx` — Applicare filtro: modalita highlight = opacity ridotta su commit di altri autori; modalita filter = nascondere commit di altri autori
4. Integrazione con barra ricerca esistente (Ctrl+F): aggiungere tab/opzione "by author"

**Test:**
- Unit: logica filtro, estrazione lista autori unici
- E2E: selezionare autore, verificare commit filtrati/evidenziati

---

### #16 — CI/CD Pipeline Status

**Descrizione:** Mostrare lo stato delle pipeline CI/CD (GitHub Actions, GitLab CI) accanto ai commit nel graph e nei dettagli commit. Icona con stato (success/failure/pending/running).

**IPC Channels:**
- `ci:status:get` — Ottiene lo stato CI per un commit SHA (via `gh` CLI o `glab` CLI)
- `ci:status:watch` — Polling per aggiornamenti su commit recenti

**Implementazione:**
1. `src/main/ci/ci-service.ts` — Servizio che rileva provider (GitHub/GitLab) dal remote URL e invoca `gh run list` o `glab ci list`
2. `src/main/ipc/ci-handlers.ts` — Handler IPC con cache per evitare richieste duplicate
3. `src/preload/index.ts` — Esporre `ci.*`
4. `src/renderer/store/ci-store.ts` — Store con cache stato per SHA
5. `src/renderer/components/CommitGraph/CIStatusBadge.tsx` — Badge colorato (verde/rosso/giallo/blu) accanto al commit nel graph
6. `src/renderer/components/CommitDetails/CIStatusSection.tsx` — Sezione nei dettagli commit con lista job, durata, link alla pipeline
7. Auto-refresh: polling ogni 30s per commit recenti con stato pending/running

**Test:**
- Unit: parsing output `gh`/`glab`, cache logic
- E2E: mock CLI output, verificare badge nel graph

---

### #17 — Issue Tracker Linking

**Descrizione:** Riconoscere riferimenti a issue nei messaggi di commit (es. `#123`, `JIRA-456`) e renderli come link cliccabili. Mostrare stato issue inline se possibile.

**IPC Channels:**
- `issues:resolve` — Risolve riferimento issue (titolo, stato) via CLI o API
- `issues:config:get` — Ottiene configurazione pattern issue

**Implementazione:**
1. `src/shared/settings-types.ts` — Aggiungere `issueTracker: { pattern: RegExp, urlTemplate: string, provider: 'github' | 'gitlab' | 'jira' | 'linear' | 'custom' }`
2. `src/main/issues/issue-service.ts` — Auto-detect da remote URL, risoluzione issue via `gh issue view` o API
3. `src/main/ipc/issue-handlers.ts` — Handler IPC
4. `src/renderer/components/CommitDetails/IssueLink.tsx` — Componente che parsa messaggio commit, trasforma riferimenti in link cliccabili, tooltip con titolo/stato issue
5. `src/renderer/components/SettingsDialog/` — Configurazione pattern e URL template
6. Integrazione nel CommitDialog: suggerimento issue aperte durante la scrittura del messaggio

**Test:**
- Unit: parsing pattern issue, URL template rendering
- E2E: commit con riferimento issue, verificare link nel dettaglio

---

### #18 — Inline Code Review Comments

**Descrizione:** Aggiungere commenti di review direttamente sulle righe del diff, con possibilita di esportare come PR review o salvare localmente.

**IPC Channels:**
- `review:comments:save` — Salva commenti localmente (JSON per repo)
- `review:comments:load` — Carica commenti per un commit/file
- `review:comments:export` — Esporta come PR review via `gh` CLI
- `review:comments:clear` — Cancella commenti di una review

**Implementazione:**
1. `src/main/review/review-service.ts` — Persistenza commenti in `.git/review-comments/` (JSON per commit SHA)
2. `src/main/ipc/review-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `review.*`
4. `src/renderer/store/review-store.ts` — Store con commenti per commit+file+riga
5. `src/renderer/components/DiffViewer/ReviewComment.tsx` — Componente inline nel diff: icona "+" su hover riga, textarea per commento, indicatore commenti esistenti
6. `src/renderer/components/ReviewSummaryDialog/` — Dialog con tutti i commenti della review, opzione esporta come PR review GitHub/GitLab
7. Supporto severity: comment, suggestion, issue

**Test:**
- Unit: persistenza commenti, export format
- E2E: aggiungere commento su riga diff, verificare persistenza

---

### #19 — SSH Key Manager

**Descrizione:** Generare, visualizzare e gestire chiavi SSH dall'interno dell'app. Mostrare chiavi esistenti, generare nuove coppie, copiare chiave pubblica, testare connessione.

**IPC Channels:**
- `ssh:keys:list` — Lista chiavi SSH in `~/.ssh/`
- `ssh:keys:generate` — Genera nuova coppia di chiavi
- `ssh:keys:get-public` — Legge chiave pubblica
- `ssh:keys:test` — Testa connessione SSH a un host (es. `ssh -T git@github.com`)

**Implementazione:**
1. `src/main/ssh/ssh-service.ts` — Servizio: lista file in `~/.ssh/`, genera chiavi con `ssh-keygen`, testa connessione
2. `src/main/ipc/ssh-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `ssh.*`
4. `src/renderer/components/SSHDialog/` — Dialog con:
   - Lista chiavi esistenti (nome, tipo, fingerprint, data creazione)
   - Form generazione: tipo (ed25519/rsa), commento, passphrase
   - Bottone copia chiave pubblica
   - Bottone test connessione (github.com, gitlab.com, custom)
5. Integrazione con SettingsDialog: link diretto a SSH manager

**Test:**
- Unit: parsing directory SSH, validazione parametri generazione
- E2E: (limitato) lista chiavi esistenti

---

### #20 — Gist/Snippet Creation

**Descrizione:** Creare gist GitHub o snippet GitLab direttamente da file o selezione di codice nel diff viewer.

**IPC Channels:**
- `gist:create` — Crea un gist/snippet via `gh gist create` o `glab snippet create`
- `gist:list` — Lista gist/snippet recenti

**Implementazione:**
1. `src/main/gist/gist-service.ts` — Servizio che rileva provider dal remote e usa CLI appropriata
2. `src/main/ipc/gist-handlers.ts` — Handler IPC
3. `src/preload/index.ts` — Esporre `gist.*`
4. `src/renderer/components/GistDialog/` — Dialog con: nome, descrizione, visibilita (public/secret), contenuto (da file o selezione)
5. Context menu nel DiffViewer e FileTree: "Create Gist from file", "Create Gist from selection"
6. Dopo creazione: mostrare URL, bottone copia, bottone apri nel browser

**Test:**
- Unit: gist-service logic, provider detection
- E2E: mock CLI, verificare dialog e invocazione

---

## Implementation Order (Suggested)

Ordine consigliato per massimizzare valore incrementale:

**Sprint 1 — Quick Wins (Low complexity, P0)**
1. #10 Commit Message Templates
2. #3 .gitignore Visual Editor
3. #4 Drag & Drop Staging
4. #15 Author Filter in Commit Graph

**Sprint 2 — Core Improvements (Medium complexity, P0-P1)**
5. #1 Git Grep / Code Search
6. #2 Branch Diff Comparison
7. #7 Branch Commit Range Comparison
8. #9 Git Hooks Manager

**Sprint 3 — Quality of Life (Low-Medium, P1)**
9. #12 Desktop Notifications
10. #13 Commit Message Snippets
11. #11 Undo/Redo Git Operations
12. #10 (already done in Sprint 1)

**Sprint 4 — Integrations (Medium, P1-P2)**
13. #16 CI/CD Pipeline Status
14. #17 Issue Tracker Linking
15. #20 Gist/Snippet Creation

**Sprint 5 — Advanced (High complexity, P1-P2)**
16. #5 Multi-repo Workspace (Tabs)
17. #6 Integrated Terminal
18. #14 Advanced Statistics Dashboard
19. #19 SSH Key Manager

**Sprint 6 — Complex UI (High complexity, P2)**
20. #8 3-Way Merge Conflict Editor
21. #18 Inline Code Review Comments

---

## Decision

Queste 20 funzionalita estendono Git Expansion da buon client Git a IDE Git completo. L'ordine di implementazione privilegia quick wins iniziali per dare valore immediato, seguito da features di media complessita che migliorano il workflow quotidiano, chiudendo con le funzionalita piu complesse ma ad alto impatto.
