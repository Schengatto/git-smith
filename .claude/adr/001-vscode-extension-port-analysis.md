# ADR-001: Analisi di fattibilità — Portare Git Expansion come estensione VS Code

**Data:** 2026-03-17
**Stato:** Proposta
**Contesto:** Valutazione della complessità per portare Git Expansion (Electron + React + TypeScript) come plugin VS Code

---

## Contesto

Git Expansion è un'applicazione desktop Git GUI costruita con Electron 41 + React 18 + TypeScript + Tailwind CSS. L'architettura attuale prevede un main process Electron che gestisce le operazioni git (via `simple-git`), un renderer React per la UI, e un layer IPC ben definito che separa i due mondi.

L'obiettivo è valutare se e come portare questa applicazione come estensione di Visual Studio Code.

## Stato attuale del progetto

| Metrica | Valore |
|---------|--------|
| Componenti React | 47 |
| Dialog modali | 22 |
| Metodi git-service | 101 |
| Canali IPC | 145 |
| Store Zustand | 7 |
| Dipendenze native | Nessuna (solo Electron API) |

## Analisi di riutilizzabilità

### Riutilizzabile direttamente (~35-40%)

- **Git service** (`src/main/git/git-service.ts`) — `simple-git` funziona nel contesto di un'estensione VS Code senza modifiche. I 101 metodi asincroni sono tutti portabili.
- **Tipi e interfacce** (`src/shared/`) — Completamente riutilizzabili.
- **Logica di stato** — I 7 store Zustand si adattano facilmente a VS Code context/state API o ExtensionContext globalState.

### Richiede riscrittura (~60%)

| Area | Componenti coinvolti | Problema | Soluzione VS Code |
|------|---------------------|----------|-------------------|
| Componenti React | 47 componenti | VS Code non supporta React nativo | Webview API o UI nativa VS Code |
| Dialog modali | 22 dialog | Nessun sistema di modal in VS Code | QuickPick, InputBox, o Webview |
| Commit graph | CommitGraphPanel (1236 righe) | Visualizzazione canvas/SVG custom | Webview con rendering dedicato |
| Layout pannelli | Dockview (drag & drop) | VS Code ha layout fisso (sidebar/editor/panel) | TreeView, Editor, Panel API |
| Menu personalizzati | MenuBar React custom | VS Code gestisce i menu nativamente | Command Palette + context menu contributes |
| Merge conflict 3-way | MergeConflictDialog (560 righe) | Dialog React con textarea | Webview dedicata o custom merge editor |
| Streaming output | GitOperationLogDialog | Dialog real-time stdout/stderr | OutputChannel o Terminal API |

## Sfide principali

### 1. Commit Graph (complessità: ALTA)

Il commit graph con virtualizzazione (`react-virtuoso`), rendering SVG delle branch lines, e paginazione è il componente più complesso (1236 righe). VS Code non ha equivalente nativo — richiede un Webview con canvas rendering. Estensioni come Git Graph e GitLens affrontano lo stesso problema con approcci Webview.

### 2. Layout multi-pannello (complessità: ALTA)

Dockview permette layout libero con drag & drop dei pannelli. VS Code ha un layout fisso con posizioni predefinite (sidebar, editor area, panel). La sidebar di Git Expansion (branches, remotes, tags, stashes) si mappa bene su TreeView, ma il layout flessibile va ripensato.

### 3. Sistema di dialog (complessità: MEDIA)

I 22 dialog vanno ripensati caso per caso:

| Dialog | Approccio VS Code |
|--------|-------------------|
| CheckoutDialog | QuickPick con lista branch |
| MergeDialog | QuickPick + opzioni |
| CloneDialog | Multi-step QuickPick |
| CommitDialog | SCM API (input box nativo) |
| StashDialog (597 righe) | Webview (troppo complesso per QuickPick) |
| RebaseDialog (615 righe) | Webview |
| InteractiveRebaseDialog (473 righe) | Webview |
| MergeConflictDialog (560 righe) | Webview o custom merge editor |
| SettingsDialog (621 righe) | VS Code Settings contributes |
| StaleBranchesDialog (353 righe) | Webview o TreeView + comandi |
| AboutDialog, TagDialog, BranchDialogs | QuickPick / InputBox |

### 4. Streaming output git (complessità: BASSA)

L'output real-time delle operazioni git attualmente usa un dialog custom con scroll. In VS Code si mappa naturalmente su `OutputChannel` o `Terminal` API.

## Approcci possibili

### Approccio A: Webview-heavy

Inserire tutta la UI React esistente in un Webview panel VS Code. Comunicazione via `postMessage` al posto di IPC Electron.

| Pro | Contro |
|-----|--------|
| Riuso ~60-70% del codice UI | Scarsa integrazione nativa (tema, keybinding) |
| Tempi di sviluppo ridotti | Esperienza utente "app dentro app" |
| Meno rischio di regressioni | Performance overhead del Webview |

**Stima: 2-3 mesi**

### Approccio B: Nativo VS Code

Riscrivere la UI usando TreeView, SCM Provider API, QuickPick, editor decorations, e le API native di VS Code.

| Pro | Contro |
|-----|--------|
| Integrazione perfetta con VS Code | Riscrittura quasi totale della UI |
| Tema, keybinding, comandi nativi | Alcune feature impossibili da replicare |
| Migliore performance | Tempi lunghi |

**Stima: 6-9 mesi**

### Approccio C: Ibrido (raccomandato)

Usare API native per le parti che si mappano bene (sidebar, comandi, SCM) e Webview per i componenti complessi (commit graph, dialog avanzati).

| Componente | Implementazione |
|------------|----------------|
| Sidebar (branches, remotes, tags) | TreeView nativo |
| Operazioni base (fetch, pull, push) | Comandi VS Code |
| Checkout, merge semplice | QuickPick nativo |
| Commit graph | Webview React (riuso componente) |
| Stash, rebase, conflict resolution | Webview React (riuso dialog) |
| Settings | VS Code Settings contributes |
| Output operazioni | OutputChannel |

| Pro | Contro |
|-----|--------|
| Buon compromesso integrazione/riuso | Doppio paradigma UI da mantenere |
| Commit graph resta React (valore chiave) | Complessità architetturale maggiore |
| ~45-50% riuso codice | Due sistemi di stato da sincronizzare |

**Stima: 3-5 mesi**

## Architettura proposta (Approccio C)

```
vscode-git-expansion/
  src/
    extension.ts          → Activation, command registration
    git/
      git-service.ts      → Riuso diretto da Electron (simple-git)
    providers/
      branch-tree.ts      → TreeDataProvider per sidebar
      remote-tree.ts      → TreeDataProvider per remoti
      tag-tree.ts          → TreeDataProvider per tag
      stash-tree.ts        → TreeDataProvider per stash
    commands/
      checkout.ts          → QuickPick-based checkout
      merge.ts             → QuickPick-based merge
      fetch-pull-push.ts   → Operazioni remote
    webview/
      graph-panel.ts       → WebviewPanel per commit graph
      stash-panel.ts       → WebviewPanel per stash dialog
      rebase-panel.ts      → WebviewPanel per rebase
      conflict-panel.ts    → WebviewPanel per merge conflicts
    shared/
      types.ts             → Riuso da src/shared/
```

## Raccomandazione

L'**approccio ibrido (C)** offre il miglior rapporto costo/beneficio. Il commit graph visuale è il vero differenziatore di Git Expansion rispetto a GitLens e Git Graph — mantenerlo come Webview React preserva il valore principale del progetto.

Il git-service con i suoi 101 metodi è completamente portabile senza modifiche significative, il che riduce notevolmente il rischio tecnico.

### Priorità di implementazione suggerita

1. **Fase 1** — Estensione base: git-service, sidebar TreeView, comandi base (fetch/pull/push/checkout)
2. **Fase 2** — Commit graph Webview con navigazione e filtri
3. **Fase 3** — Dialog avanzati (stash, rebase, merge conflict) come Webview
4. **Fase 4** — Feature complete: settings, auto-fetch, scan repos

## Riferimenti

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code SCM API](https://code.visualstudio.com/api/extension-guides/scm-provider)
- [VS Code TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)
