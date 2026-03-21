# Git Expansion - Manuale Utente

> **Versione:** 0.4.0
> **Licenza:** MIT
> **Piattaforme:** Windows, Linux (DEB/RPM)

Git Expansion e un client Git grafico cross-platform ispirato a [Git Extensions](https://gitextensions.github.io/), costruito con Electron, React e TypeScript. Offre un'interfaccia moderna con tema Catppuccin per gestire repository Git in modo visuale e completo.

---

## Indice

1. [Installazione e Requisiti](#1-installazione-e-requisiti)
2. [Primo Avvio](#2-primo-avvio)
3. [Interfaccia Principale](#3-interfaccia-principale)
   - [Barra dei Menu](#31-barra-dei-menu)
   - [Toolbar](#32-toolbar)
   - [Sidebar](#33-sidebar)
   - [Grafico dei Commit](#34-grafico-dei-commit)
   - [Pannello Dettagli Commit](#35-pannello-dettagli-commit)
   - [Barra di Stato](#36-barra-di-stato)
   - [Banner Conflitti](#37-banner-conflitti)
4. [Gestione Repository](#4-gestione-repository)
   - [Creare un Repository](#41-creare-un-repository)
   - [Aprire un Repository](#42-aprire-un-repository)
   - [Clonare un Repository](#43-clonare-un-repository)
   - [Scansionare il Filesystem](#44-scansionare-il-filesystem)
   - [Repository Preferiti e Recenti](#45-repository-preferiti-e-recenti)
5. [Commit e Staging](#5-commit-e-staging)
   - [Commit Dialog](#51-commit-dialog)
   - [Staging e Unstaging File](#52-staging-e-unstaging-file)
   - [Staging per Righe e Hunk](#53-staging-per-righe-e-hunk)
   - [Amend dell'Ultimo Commit](#54-amend-dellultimo-commit)
   - [Template di Commit](#55-template-di-commit)
   - [Messaggi AI per i Commit](#56-messaggi-ai-per-i-commit)
6. [Branch](#6-branch)
   - [Creare un Branch](#61-creare-un-branch)
   - [Checkout di un Branch](#62-checkout-di-un-branch)
   - [Rinominare ed Eliminare Branch](#63-rinominare-ed-eliminare-branch)
   - [Eliminare Branch Remoti](#64-eliminare-branch-remoti)
7. [Merge](#7-merge)
   - [Merge Dialog](#71-merge-dialog)
   - [Opzioni di Merge](#72-opzioni-di-merge)
   - [Abort e Continue](#73-abort-e-continue)
8. [Rebase](#8-rebase)
   - [Rebase Standard](#81-rebase-standard)
   - [Rebase Interattivo](#82-rebase-interattivo)
   - [Gestione Conflitti durante Rebase](#83-gestione-conflitti-durante-rebase)
9. [Cherry-Pick](#9-cherry-pick)
10. [Risoluzione Conflitti](#10-risoluzione-conflitti)
    - [Editor Interno 3-Way](#101-editor-interno-3-way)
    - [Tool di Merge Esterno](#102-tool-di-merge-esterno)
    - [Risoluzione con AI](#103-risoluzione-con-ai)
11. [Diff e Visualizzazione File](#11-diff-e-visualizzazione-file)
    - [Diff Viewer](#111-diff-viewer)
    - [File History](#112-file-history)
    - [Blame View](#113-blame-view)
    - [Confronto tra Commit](#114-confronto-tra-commit)
    - [Menu Contestuale File](#115-menu-contestuale-file)
12. [Tag](#12-tag)
13. [Stash](#13-stash)
14. [Remote](#14-remote)
    - [Fetch, Pull e Push](#141-fetch-pull-e-push)
    - [Gestione dei Remote](#142-gestione-dei-remote)
    - [Branch Remoti Obsoleti](#143-branch-remoti-obsoleti)
15. [Reset](#15-reset)
16. [Submodule](#16-submodule)
17. [Changelog](#17-changelog)
18. [Console Integrata](#18-console-integrata)
19. [Log dei Comandi](#19-log-dei-comandi)
20. [Statistiche](#20-statistiche)
    - [Statistiche Autori](#201-statistiche-autori)
    - [Statistiche Codebase](#202-statistiche-codebase)
21. [Account Git](#21-account-git)
22. [Impostazioni](#22-impostazioni)
    - [Generale](#221-generale)
    - [Account](#222-account)
    - [Git Config](#223-git-config)
    - [Fetch](#224-fetch)
    - [Commit](#225-commit)
    - [Diff e Grafico](#226-diff-e-grafico)
    - [Merge Tool](#227-merge-tool)
    - [Avanzate](#228-avanzate)
    - [AI / MCP](#229-ai--mcp)
23. [Integrazione AI e MCP](#23-integrazione-ai-e-mcp)
    - [Provider AI Supportati](#231-provider-ai-supportati)
    - [MCP Server](#232-mcp-server)
    - [Funzionalita AI](#233-funzionalita-ai)
24. [Aggiornamenti Automatici](#24-aggiornamenti-automatici)
25. [Scorciatoie da Tastiera](#25-scorciatoie-da-tastiera)
26. [Temi](#26-temi)
27. [Layout Personalizzabile](#27-layout-personalizzabile)

---

## 1. Installazione e Requisiti

### Requisiti di Sistema

- **Node.js** 20 o superiore (solo per build da sorgente)
- **Git** 2.30 o superiore (deve essere nel PATH di sistema)
- **Sistema Operativo:** Windows 10+, Linux (distribuzioni basate su Debian/RPM)

### Installazione da Release

Scaricare l'installer appropriato dalla pagina [GitHub Releases](https://github.com/Schengatto/git-expansion/releases):

- **Windows:** Installer Squirrel (`.exe`) o archivio ZIP
- **Linux:** Pacchetto `.deb` (Debian/Ubuntu) o `.rpm` (Fedora/RHEL)

### Build da Sorgente

```bash
git clone https://github.com/Schengatto/git-expansion.git
cd git-expansion
npm install
npm start          # Avvia in modalita sviluppo
npm run make       # Crea i pacchetti distribuibili
```

---

## 2. Primo Avvio

Al primo avvio, Git Expansion mostra una **schermata di benvenuto** con:

- **Azioni rapide:** Crea, Apri, Clona o Scansiona repository
- **Repository recenti:** Lista dei repository aperti di recente (inizialmente vuota)
- **Suggerimenti per le scorciatoie:** `Ctrl+O` per aprire, `Ctrl+N` per creare

L'applicazione ricorda l'ultimo repository aperto e lo riapre automaticamente nelle sessioni successive.

---

## 3. Interfaccia Principale

L'interfaccia e divisa in diverse aree, tutte personalizzabili grazie al sistema di pannelli agganciabili (dockview).

### 3.1 Barra dei Menu

La barra dei menu in alto offre quattro menu principali:

#### Menu Start
| Voce | Scorciatoia | Descrizione |
|------|-------------|-------------|
| Create new repository... | | Inizializza un nuovo repository Git |
| Open repository... | `Ctrl+O` | Apri un repository esistente |
| Favorite repositories | | Sottomenu con repository organizzati per categoria |
| Recent repositories | | Ultimi 10 repository aperti |
| Clone repository... | | Clona un repository remoto |
| Scan for repositories... | | Cerca repository Git nel filesystem |
| Exit | `Ctrl+Q` | Chiudi l'applicazione |

#### Menu Dashboard
| Voce | Scorciatoia | Descrizione |
|------|-------------|-------------|
| Refresh | `F5` | Aggiorna il grafico e lo stato |
| Reset layout | | Ripristina il layout dei pannelli al default |

#### Menu Tools
| Voce | Scorciatoia | Descrizione |
|------|-------------|-------------|
| Git bash | `Ctrl+G` | Apre un terminale Git nella directory del repo |
| Stale remote branches... | | Trova ed elimina branch remoti obsoleti |
| Settings... | `Ctrl+,` | Apre le impostazioni |

#### Menu Help
| Voce | Descrizione |
|------|-------------|
| User manual | Apre la documentazione online (GitHub wiki) |
| Report an issue | Apre la pagina per segnalare bug su GitHub |
| Check for updates... | Verifica disponibilita aggiornamenti |
| About Git Expansion | Mostra versione, licenza e informazioni |

### 3.2 Toolbar

La toolbar appare sotto la barra dei menu e si adatta al contesto:

- **Senza repository aperto:** Mostra solo i pulsanti Open e Init
- **Con repository aperto:** Mostra la serie completa di operazioni

Pulsanti disponibili (da sinistra a destra):
| Pulsante | Descrizione |
|----------|-------------|
| Open | Apri un repository |
| Init | Crea un nuovo repository |
| Refresh | Aggiorna grafico e stato |
| Account | Selettore account Git attivo |
| Fetch | Scarica aggiornamenti dal remote (con dropdown per opzioni) |
| Pull | Pull dal remote (con dropdown: merge, rebase) |
| Push | Push al remote |
| Commit (`Ctrl+K`) | Apre il Commit Dialog |
| Merge | Apre il Merge Dialog |
| Rebase | Apre il Rebase Dialog |
| Cherry-pick | Cherry-pick di un commit |

I pulsanti Fetch e Pull hanno dropdown aggiuntivi con opzioni avanzate (fetch all, fetch prune, pull con rebase, pull con merge).

### 3.3 Sidebar

La sidebar a sinistra mostra l'albero del repository con sezioni espandibili:

- **Barra di ricerca:** Filtra branch, remote, tag per nome
- **Branches:** Branch locali e remoti con indicatori ahead/behind
- **Remotes:** Lista dei remote configurati
- **Tags:** Tutti i tag del repository
- **Submodules:** Sottomoduli git
- **Stashes:** Lista degli stash salvati

Ogni sezione supporta il **menu contestuale** (click destro) con le operazioni specifiche:

**Branch (click destro):**
- Checkout, Merge, Rebase, Delete, Rename, Set upstream

**Remote (click destro):**
- Add, Remove, Edit URL

**Tag (click destro):**
- Delete, Push to remote

**Stash (click destro):**
- Apply, Pop, Drop, Inspect

### 3.4 Grafico dei Commit

Il pannello centrale mostra il grafico dei commit con:

- **Linee colorate** per ogni branch/lane
- **Punti/dot** per ogni commit (il commit HEAD ha un dot piu grande con bordo bianco e testo in grassetto)
- **Avatar Gravatar** accanto al nome dell'autore
- **Decorazioni:** Etichette per branch e tag su ogni commit
- **Scrolling virtualizzato** per gestire repository con migliaia di commit
- **Paginazione:** Pulsante "Load More" per caricare altri commit (blocchi da 500)

#### Filtri del Grafico

Nella toolbar del grafico sono disponibili due filtri:

1. **Filtro branch per nome:** Campo di testo per filtrare i commit per nome del branch (sottostringa)
2. **Filtro visibilita branch:** Dropdown per includere/escludere branch specifici dalla visualizzazione

Questi filtri vengono **salvati per ogni repository** e ripristinati automaticamente alla riapertura.

#### Ricerca Commit

Premere `Ctrl+F` per aprire la barra di ricerca nel grafico. E possibile cercare per:
- Messaggio di commit
- Nome autore
- Hash del commit
- Nome di riferimento (branch/tag)

#### Menu Contestuale del Grafico (click destro su un commit)

| Voce | Descrizione |
|------|-------------|
| Checkout | Checkout del commit o branch |
| Create branch | Crea un nuovo branch da questo commit |
| Delete branch | Elimina il branch a cui punta il commit |
| Rename branch | Rinomina il branch |
| Merge into current | Mergia questo branch nel branch corrente |
| Rebase current onto | Rebase del branch corrente su questo commit |
| Cherry-pick | Applica questo commit sul branch corrente |
| Reset current branch | Reset del branch corrente a questo commit |
| Create tag | Crea un tag su questo commit |
| Delete tag | Elimina un tag |
| Delete remote branch | Elimina il branch remoto |
| Compare with HEAD | Confronta questo commit con HEAD |
| Compare with selected | Confronta con un altro commit selezionato |
| Generate changelog | Genera un changelog da questo commit |
| AI code review | Revisione del codice tramite AI |

### 3.5 Pannello Dettagli Commit

Quando si seleziona un commit nel grafico, il pannello dettagli mostra due tab:

#### Tab Diff
Mostra il diff unificato del commit con:
- Modalita **line-by-line** o **side-by-side** (commutabile)
- Syntax highlighting
- Linee colorate (rosso = rimosse, verde = aggiunte)

#### Tab Files
Mostra l'albero dei file modificati con:
- Badge di stato per ogni file (A = aggiunto, M = modificato, D = eliminato, R = rinominato, C = copiato)
- Click su un file per vedere il suo diff
- Click destro per il menu contestuale file

Se nessun commit e selezionato, il pannello mostra le informazioni di HEAD come fallback.

### 3.6 Barra di Stato

La barra in basso mostra:
- **Branch corrente** (es. `main`)
- **Conteggio modifiche:** Numero di file staged, unstaged e untracked
- **Hash HEAD:** Primi 8 caratteri dell'hash del commit corrente
- **Colore accento:** Cambia in base allo stato del repository (pulito/sporco)

### 3.7 Banner Conflitti

Quando un'operazione di merge, rebase o cherry-pick e in corso e ci sono conflitti, appare un banner nella parte superiore dell'interfaccia:

- **Colore rosso:** Ci sono conflitti irrisolti
- **Colore verde:** Tutti i conflitti sono stati risolti
- **Progresso:** Per il rebase, mostra lo step corrente (es. "Step 3/7")
- **Contatore conflitti:** Mostra quanti conflitti sono stati risolti (es. "2/5 risolti")

Pulsanti disponibili:
| Pulsante | Descrizione |
|----------|-------------|
| Resolve Conflicts | Apre l'editor di risoluzione conflitti |
| Skip Commit | Salta il commit corrente (durante rebase) |
| Abort | Annulla l'intera operazione |
| Continue | Procedi con l'operazione dopo la risoluzione |

---

## 4. Gestione Repository

### 4.1 Creare un Repository

1. Clicca su **Start > Create new repository...** oppure premi il pulsante **Init** nella toolbar
2. Seleziona la directory dove creare il repository
3. Git Expansion eseguira `git init` nella directory scelta
4. Il nuovo repository verra aperto automaticamente

### 4.2 Aprire un Repository

- Scorciatoia: `Ctrl+O`
- Menu: **Start > Open repository...**
- Toolbar: Pulsante **Open**

Si aprira un dialogo per selezionare la directory del repository. Il repository verra aggiunto automaticamente alla lista dei recenti.

### 4.3 Clonare un Repository

Menu: **Start > Clone repository...**

Il Clone Dialog offre le seguenti opzioni:

| Opzione | Descrizione |
|---------|-------------|
| URL | Indirizzo del repository remoto (HTTPS o SSH) |
| Destinazione | Directory locale dove clonare (con pulsante Browse) |
| Branch | Branch specifico da clonare (opzionale) |
| Bare clone | Clona solo il database Git senza working tree |
| Fetch submodules | Scarica anche i sottomoduli |
| Shallow clone | Clone superficiale con profondita configurabile |

### 4.4 Scansionare il Filesystem

Menu: **Start > Scan for repositories...**

La funzione Scan cerca ricorsivamente repository Git nel filesystem:

1. Seleziona la **directory radice** da cui iniziare la ricerca
2. Imposta la **profondita massima** (1-10, default 4)
3. Avvia la scansione
4. I repository trovati vengono mostrati in tempo reale con conteggio progressivo
5. Tutti i repository trovati vengono aggiunti automaticamente alla lista dei recenti

### 4.5 Repository Preferiti e Recenti

#### Repository Recenti
- Accessibili da **Start > Recent repositories**
- Mostra gli ultimi 10 repository aperti
- I repository rimossi dal filesystem vengono automaticamente eliminati dalla lista

#### Repository Preferiti
- Accessibili da **Start > Favorite repositories**
- Organizzati in **categorie** personalizzabili
- Per aggiungere un repository ai preferiti: assegna una categoria al repository
- Le categorie possono essere create, rinominate ed eliminate

---

## 5. Commit e Staging

### 5.1 Commit Dialog

Apri con: `Ctrl+K` oppure pulsante **Commit** nella toolbar.

Il Commit Dialog e ispirato a Git Extensions e presenta:

- **Pannello sinistro superiore:** Lista file unstaged con badge di stato
- **Pannello sinistro inferiore:** Lista file staged con badge di stato
- **Pannello centrale/destro:** Visualizzazione diff del file selezionato
- **Area messaggio:** Campo per il messaggio di commit
- **Barra superiore:** Branch corrente e percorso del file selezionato

### 5.2 Staging e Unstaging File

Nel Commit Dialog:

- **Stage:** Seleziona i file nella lista unstaged e clicca il pulsante con freccia giu (o doppio click)
- **Unstage:** Seleziona i file nella lista staged e clicca il pulsante con freccia su (o doppio click)
- **Stage All / Unstage All:** Pulsanti per spostare tutti i file in blocco
- **Discard:** Scarta le modifiche ai file selezionati

### 5.3 Staging per Righe e Hunk

Per un controllo granulare, e possibile fare staging di singole righe o blocchi di codice (hunk):

1. Seleziona un file nella lista unstaged
2. Nel diff viewer, seleziona le righe specifiche che vuoi includere nello staging
3. Usa i pulsanti **Stage Lines** o **Unstage Lines** per operare sulle singole righe

> **Nota:** Lo staging per righe non e disponibile per i file in conflitto.

### 5.4 Amend dell'Ultimo Commit

Nel Commit Dialog, il pulsante commit ha un **menu dropdown** con l'opzione **Amend**:

- Modifica il messaggio dell'ultimo commit
- Aggiunge i file staged all'ultimo commit
- Il campo messaggio viene precompilato con il messaggio dell'ultimo commit

### 5.5 Template di Commit

Il dropdown del messaggio di commit offre:

- **Messaggi recenti:** Gli ultimi 10 messaggi di commit usati
- **Template conventional commits:** Template predefiniti seguendo la convenzione Conventional Commits:
  - `feat: `, `fix: `, `docs: `, `style: `, `refactor: `, `test: `, `chore: `, ecc.

### 5.6 Messaggi AI per i Commit

Se un provider AI e configurato (vedi [Impostazioni AI/MCP](#229-ai--mcp)):

- Il pulsante **AI** nel Commit Dialog genera automaticamente un messaggio di commit basato sul diff staged
- Il messaggio segue la convenzione Conventional Commits
- Puoi modificare il suggerimento prima di confermare

---

## 6. Branch

### 6.1 Creare un Branch

Modalita:
1. **Menu contestuale del grafico:** Click destro su un commit > **Create branch**
2. **Sidebar:** Click destro su un branch > **Create branch**
3. **Commit Dialog:** Pulsante "Create branch" nella barra superiore

Opzioni:
- **Nome:** Nome del nuovo branch
- **Start point:** Commit o branch da cui partire (default: commit selezionato)
- **Checkout:** Opzione per fare checkout immediatamente del nuovo branch

### 6.2 Checkout di un Branch

Il Checkout Dialog (accessibile dal grafico o dalla sidebar) offre:

| Opzione | Descrizione |
|---------|-------------|
| Branch locale | Seleziona tra i branch locali |
| Branch remoto | Crea automaticamente un tracking branch locale |
| Commit hash | Checkout in modalita detached HEAD |
| Gestione modifiche locali | None / Merge / Stash / Reset |

### 6.3 Rinominare ed Eliminare Branch

- **Rinomina:** Click destro su un branch > Rename > Inserisci il nuovo nome
- **Elimina locale:** Click destro > Delete branch (con opzione force per branch non mergiati)
- **Elimina remoto:** Click destro > Delete remote branch (richiede conferma)

### 6.4 Eliminare Branch Remoti

Disponibile sia dal grafico (click destro) che dalla sidebar. Per eliminazioni in blocco di branch obsoleti, usa **Tools > Stale remote branches** (vedi [sezione 14.3](#143-branch-remoti-obsoleti)).

---

## 7. Merge

### 7.1 Merge Dialog

Accessibile da:
- Toolbar: Pulsante **Merge**
- Grafico: Click destro > **Merge into current branch**
- Sidebar: Click destro su un branch > **Merge**

### 7.2 Opzioni di Merge

| Opzione | Descrizione |
|---------|-------------|
| Branch | Branch da mergiare nel branch corrente |
| Fast-forward | Permetti fast-forward quando possibile |
| No fast-forward | Forza la creazione di un merge commit |
| Squash | Combina tutti i commit in un unico commit |
| No commit | Esegui il merge senza creare il commit automaticamente |
| Allow unrelated histories | Permetti merge di storie non correlate |
| Add log messages | Aggiungi i messaggi dei commit al messaggio di merge |
| Custom message | Messaggio personalizzato per il merge commit |

### 7.3 Abort e Continue

Se il merge genera conflitti:
- Il **Banner Conflitti** appare con le opzioni Resolve / Abort / Continue
- **Abort:** Annulla completamente il merge, ripristinando lo stato precedente
- **Continue:** Dopo aver risolto i conflitti, procedi con il merge commit

---

## 8. Rebase

### 8.1 Rebase Standard

Accessibile da:
- Toolbar: Pulsante **Rebase**
- Grafico: Click destro > **Rebase current onto**
- Sidebar: Click destro su branch > **Rebase**

Opzioni disponibili:
| Opzione | Descrizione |
|---------|-------------|
| Onto | Branch o commit su cui fare rebase |
| Preserve merges | Mantieni i merge commit |
| Autosquash | Riordina automaticamente i commit fixup! e squash! |
| Auto-stash | Salva e ripristina automaticamente le modifiche locali |
| Update refs | Aggiorna i riferimenti dei branch durante il rebase |

### 8.2 Rebase Interattivo

Attivando l'opzione **Interactive** nel Rebase Dialog, si apre l'editor di rebase interattivo:

- **Tabella dei commit:** Lista dei commit che verranno rebasati
- **Azioni disponibili per ogni commit:**

| Azione | Tasto | Colore | Descrizione |
|--------|-------|--------|-------------|
| Pick | `P` | Verde | Mantieni il commit |
| Reword | `R` | Blu | Modifica solo il messaggio |
| Squash | `S` | Arancione | Fondi con il commit precedente |
| Fixup | `F` | Giallo | Come squash ma scarta il messaggio |
| Edit | `E` | Viola | Fermati per modificare il commit |
| Drop | `D` | Rosso | Elimina il commit |

- **Drag and drop:** Riordina i commit trascinandoli
- **Scorciatoie da tastiera:** Premi la lettera corrispondente per cambiare azione

### 8.3 Gestione Conflitti durante Rebase

Durante un rebase con conflitti:
- Il banner mostra il progresso (es. "Step 3/7")
- Opzioni: **Skip** (salta il commit), **Abort** (annulla il rebase), **Continue** (procedi al prossimo step)

---

## 9. Cherry-Pick

Per applicare un commit specifico sul branch corrente:

1. Nel grafico, click destro sul commit desiderato
2. Seleziona **Cherry-pick**
3. Il commit viene applicato sul branch corrente

In caso di conflitti, il banner apparira con le opzioni Abort / Continue.

---

## 10. Risoluzione Conflitti

Quando un'operazione genera conflitti, Git Expansion offre tre modalita di risoluzione:

### 10.1 Editor Interno 3-Way

L'editor interno mostra una vista a tre colonne:

- **Ours (sinistra):** La versione del branch corrente
- **Base (centro):** La versione antenata comune
- **Theirs (destra):** La versione del branch in arrivo

Per ogni sezione in conflitto, sono disponibili i pulsanti:
| Pulsante | Descrizione |
|----------|-------------|
| Accept Ours | Usa la versione del branch corrente |
| Accept Theirs | Usa la versione del branch in arrivo |
| Accept Both | Mantieni entrambe le versioni |
| Custom | Modifica manualmente la risoluzione |

La lista file a sinistra mostra il conteggio dei conflitti e lo stato di risoluzione per ogni file.

### 10.2 Tool di Merge Esterno

Git Expansion supporta tool di merge esterni:
- **KDiff3**
- **Meld**
- **Beyond Compare**
- E altri configurabili

Configurazione in **Settings > Merge Tool**: seleziona il tool, specifica il percorso dell'eseguibile e il pattern degli argomenti.

### 10.3 Risoluzione con AI

Se un provider AI e configurato:
- Il pulsante **"Resolve with AI"** analizza le versioni ours/theirs/base
- Mostra un'anteprima della risoluzione suggerita con diff LCS
- Puoi accettare o modificare il suggerimento prima di applicarlo

---

## 11. Diff e Visualizzazione File

### 11.1 Diff Viewer

Il visualizzatore diff supporta due modalita:

- **Line-by-line (unificato):** Mostra le modifiche in un'unica vista con linee colorate
- **Side-by-side (affiancato):** Mostra la versione prima e dopo affiancate

Funzionalita:
- Syntax highlighting
- Numeri di riga sincronizzati
- Colori: rosso per righe rimosse, verde per righe aggiunte
- Per le immagini: viewer side-by-side con before/after

### 11.2 File History

Mostra la cronologia dei commit per un singolo file:

1. Click destro su un file > **File History**
2. Appare una lista virtualizzata di tutti i commit che hanno modificato quel file
3. Supporta `git log --follow` per tracciare file rinominati
4. Click su un commit per vedere il diff di quel file in quel commit

### 11.3 Blame View

Mostra l'annotazione riga per riga di un file:

1. Click destro su un file > **Blame**
2. Per ogni riga vengono mostrati: autore, hash del commit, data
3. Utile per capire chi ha scritto ogni riga e quando

### 11.4 Confronto tra Commit

Per confrontare due commit:

1. Nel grafico, click destro su un commit > **Compare with HEAD** (confronta con il commit corrente)
2. Oppure seleziona un commit, poi click destro su un altro > **Compare with selected commit**
3. Si apre il **Commit Compare Dialog** con la lista dei file modificati e il diff per ciascuno

### 11.5 Menu Contestuale File

In tutti i pannelli dove appaiono file, il click destro offre:

| Voce | Descrizione |
|------|-------------|
| File History | Cronologia dei commit per questo file |
| Blame | Vista blame con annotazioni riga per riga |
| Open | Apri il file con l'applicazione predefinita |
| Show in Folder | Apri la cartella contenente nel file manager |
| Copy Path | Copia il percorso del file negli appunti |
| Add to .gitignore | Aggiungi il file/pattern al .gitignore |

---

## 12. Tag

### Creare un Tag

1. Click destro su un commit nel grafico > **Create tag**
2. Oppure click destro nella sezione Tags della sidebar > **Create tag**

Opzioni:
| Opzione | Descrizione |
|---------|-------------|
| Nome | Nome del tag |
| Messaggio | Messaggio per tag annotati (opzionale) |
| Annotated | Se selezionato, crea un tag annotato con messaggio |
| Push to remote | Pusha il tag immediatamente dopo la creazione |

### Eliminare un Tag

- **Locale:** Click destro > **Delete tag**
- **Remoto:** Nella conferma di eliminazione, spunta l'opzione **Delete remote tag** per eliminare anche dal remote
- E possibile eliminare tag remoti anche dalla sidebar

---

## 13. Stash

Lo Stash Dialog offre due modalita:

### Modalita Creazione (Working Directory)
- Mostra la lista dei file modificati in un albero
- Opzioni: include untracked, keep index, staged only
- Campo messaggio opzionale per descrivere lo stash

### Modalita Gestione (Stash List)
- Lista di tutti gli stash salvati con descrizione
- Per ogni stash:

| Azione | Descrizione |
|--------|-------------|
| Apply | Applica lo stash senza rimuoverlo dalla lista |
| Pop | Applica lo stash e rimuovilo dalla lista |
| Drop | Elimina lo stash dalla lista |
| Inspect | Visualizza i file e le modifiche contenute |

---

## 14. Remote

### 14.1 Fetch, Pull e Push

#### Fetch
- **Fetch:** Scarica gli aggiornamenti dal remote predefinito
- **Fetch All:** Scarica da tutti i remote configurati
- **Fetch Prune:** Scarica e rimuovi i riferimenti a branch remoti eliminati

#### Pull
- **Pull (merge):** Scarica e integra con merge
- **Pull (rebase):** Scarica e integra con rebase

#### Push
- Push sul remote predefinito
- Opzioni: force push, set upstream

Tutte queste operazioni mostrano il **Git Operation Log Dialog** con output in tempo reale e possibilita di annullamento.

### 14.2 Gestione dei Remote

Dalla sidebar o dal menu contestuale:
- **Add remote:** Aggiungi un nuovo remote (nome + URL)
- **Remove remote:** Rimuovi un remote
- **Edit URL:** Modifica l'URL di un remote esistente

### 14.3 Branch Remoti Obsoleti

Menu: **Tools > Stale remote branches...**

Questo strumento trova branch remoti piu vecchi di una soglia configurabile:

1. Imposta la **soglia di eta** (es. 30, 60, 90 giorni)
2. Avvia la ricerca
3. Vengono mostrati i branch che non hanno ricevuto commit oltre la soglia
4. Seleziona i branch da eliminare
5. Conferma l'eliminazione in blocco

---

## 15. Reset

Il Reset Dialog permette di spostare HEAD a un commit specifico:

| Modalita | Descrizione |
|----------|-------------|
| **Soft** | Sposta solo HEAD; staging area e working tree invariati |
| **Mixed** | Sposta HEAD e resetta la staging area; working tree invariato |
| **Hard** | Sposta HEAD, resetta staging area e working tree. **Attenzione: le modifiche vengono perse!** |

Accessibile dal grafico: click destro su un commit > **Reset current branch to this commit**.

Le modalita sono codificate a colori nel dialog per evidenziare il livello di rischio.

---

## 16. Submodule

Dalla sezione **Submodules** della sidebar:

| Azione | Descrizione |
|--------|-------------|
| Add | Aggiungi un nuovo sottomodulo (URL + percorso opzionale) |
| Initialize | Inizializza i sottomoduli non ancora inizializzati |
| Update | Aggiorna i sottomoduli all'ultimo commit registrato |

---

## 17. Changelog

Per generare un changelog tra due punti della storia:

1. Click destro su un commit nel grafico > **Generate changelog**
2. Seleziona il tag/commit di inizio e fine
3. Il changelog viene generato automaticamente, raggruppato per tipo di Conventional Commit:
   - **Features** (`feat:`)
   - **Bug Fixes** (`fix:`)
   - **Documentation** (`docs:`)
   - **Styles** (`style:`)
   - **Refactoring** (`refactor:`)
   - **Tests** (`test:`)
   - **Chores** (`chore:`)

Il dialog puo essere aperto anche come finestra separata.

---

## 18. Console Integrata

Git Expansion include un terminale integrato (simile alla Console di Git Extensions):

- **Shell:** Rileva automaticamente la shell del sistema (bash/zsh su Linux, cmd/PowerShell su Windows)
- **Font:** Cascadia Code (fallback: Consolas, Courier New)
- **Colori:** Sincronizzati con il tema dell'applicazione
- **Scrollback:** 5000 righe di cronologia
- **Ridimensionamento:** Si adatta automaticamente alla dimensione del pannello

Il terminale si apre automaticamente nella directory del repository corrente.

---

## 19. Log dei Comandi

Il pannello **Command Log** mostra tutti i comandi Git eseguiti dall'applicazione:

- Timestamp per ogni comando
- Comando completo con argomenti
- Massimo 200 voci nella cronologia
- Pulsante **Clear** per svuotare il log

Utile per debug e per capire quali operazioni Git vengono eseguite dall'interfaccia.

### Git Operation Log Dialog

Per le operazioni che possono richiedere tempo (push, pull, fetch, merge, rebase, cherry-pick):

- Si apre automaticamente un dialogo modale con output in tempo reale
- Mostra stdout e stderr del processo Git
- Pulsante **Cancel** per interrompere l'operazione
- Checkbox **Auto-close on success** per chiudere automaticamente dopo 1.5 secondi in caso di successo
- In caso di errore, mostra il messaggio in un riquadro rosso

---

## 20. Statistiche

### 20.1 Statistiche Autori

Il pannello **Author Statistics** mostra una classifica dei contributori:

#### Classifica
- Ordinabile per: commit, aggiunte, eliminazioni, file toccati
- Filtro temporale: All Time, Ultimo Mese, Ultima Settimana
- Avatar Gravatar per ogni autore

#### Dettaglio Autore (click per espandere)
- **Sparkline:** Grafico a linee dell'attivita nelle ultime 52 settimane
- **Heatmap:** Mappa di calore in stile GitHub dell'attivita giornaliera
- **Top Files:** File su cui l'autore ha lavorato di piu
- **Streaks:** Serie consecutive di giorni con commit

Le statistiche si aggiornano automaticamente dopo un auto-fetch.

### 20.2 Statistiche Codebase

Il pannello **Codebase Statistics** analizza il codice del repository:

- **LOC per linguaggio:** Grafico a barre con 70+ estensioni supportate
- **LOC per tipo:** Suddivisione in source, test, config, styles, docs, CI/CD, other
- **Test Ratio:** Barra che mostra il rapporto tra codice di test e codice sorgente

---

## 21. Account Git

Git Expansion supporta la gestione di piu identita Git:

### Configurazione Account
In **Settings > Accounts**:

1. Aggiungi uno o piu account con:
   - Nome
   - Email
   - Chiave di firma (opzionale)
   - Percorso chiave SSH (opzionale)
2. Imposta un **account predefinito**

### Assegnazione per Repository
- Ogni repository puo avere un account specifico assegnato
- Il selettore account nella toolbar mostra l'account attivo
- Cambiare account aggiorna automaticamente `user.name` e `user.email` nel config locale del repo

### Import SSH
Git Expansion puo analizzare il file `~/.ssh/config` per importare le configurazioni SSH esistenti.

---

## 22. Impostazioni

Apri con: `Ctrl+,` oppure **Tools > Settings...**

### 22.1 Generale
| Impostazione | Descrizione |
|-------------|-------------|
| Theme | Dark (Catppuccin Mocha) o Light (Catppuccin Latte) |
| Auto-fetch | Abilita/disabilita il fetch automatico periodico |
| Fetch interval | Intervallo in secondi tra i fetch automatici |
| Prune on auto-fetch | Rimuovi riferimenti remoti obsoleti durante l'auto-fetch |

### 22.2 Account
Gestione account Git multipli (vedi [sezione 21](#21-account-git)).

### 22.3 Git Config
Modifica diretta delle chiavi di configurazione Git:
- `user.name` e `user.email`
- Impostazioni core
- Default per merge e pull
- Configurazione a livello locale (repo) o globale

### 22.4 Fetch
- Remote predefinito
- Impostazioni di prune

### 22.5 Commit
| Impostazione | Descrizione |
|-------------|-------------|
| Default template | Template predefinito per i messaggi di commit |
| Sign commits | Firma i commit con GPG/SSH |
| Default message | Messaggio predefinito per nuovi commit |

### 22.6 Diff e Grafico
| Impostazione | Descrizione |
|-------------|-------------|
| Context lines | Numero di righe di contesto nel diff |
| Side-by-side | Preferenza per la visualizzazione side-by-side |
| Max initial load | Numero massimo di commit caricati inizialmente nel grafico |
| Show remote branches | Mostra/nascondi i branch remoti nel grafico |

### 22.7 Merge Tool
| Impostazione | Descrizione |
|-------------|-------------|
| Tool name | Nome del tool (KDiff3, Meld, Beyond Compare, ecc.) |
| Tool path | Percorso dell'eseguibile |
| Arguments pattern | Pattern degli argomenti da passare al tool |

### 22.8 Avanzate
| Impostazione | Descrizione |
|-------------|-------------|
| Max concurrent processes | Numero massimo di processi Git paralleli |
| Git binary path | Percorso personalizzato dell'eseguibile Git (con pulsante Browse) |

### 22.9 AI / MCP
| Impostazione | Descrizione |
|-------------|-------------|
| Provider | none / Anthropic / OpenAI / Google Gemini / Custom MCP |
| API key | Chiave API del provider selezionato |
| Model | Modello specifico da utilizzare |
| Base URL | URL personalizzato per l'endpoint API |
| MCP Server | Abilita/disabilita il server MCP integrato |

---

## 23. Integrazione AI e MCP

### 23.1 Provider AI Supportati

| Provider | Descrizione |
|----------|-------------|
| **Anthropic** | Claude (claude-3-opus, claude-3-sonnet, ecc.) |
| **OpenAI** | GPT-4, GPT-3.5, ecc. |
| **Google Gemini** | Gemini Pro, ecc. |
| **Custom MCP** | Qualsiasi server compatibile con il protocollo MCP |

### 23.2 MCP Server

Git Expansion include un **server MCP integrato** che espone 50+ operazioni Git come tool per assistenti AI esterni:

- Operazioni di lettura: status, log, diff, blame, branch list, ecc.
- Operazioni di scrittura: commit, checkout, merge, push, ecc.
- Comunicazione via protocollo stdio standard MCP

Per attivarlo: **Settings > AI / MCP > MCP Server > Enabled**

### 23.3 Funzionalita AI

Quando un provider AI e configurato, le seguenti funzionalita diventano disponibili:

| Funzionalita | Dove | Descrizione |
|-------------|------|-------------|
| **Commit message** | Commit Dialog | Genera un messaggio conventional commit dal diff |
| **Conflict resolution** | Merge Conflict Dialog | Suggerisce la risoluzione di conflitti con anteprima diff |
| **PR description** | Toolbar/Menu | Genera la descrizione di una Pull Request dai commit |
| **Code review** | Grafico (click destro) | Revisione del codice per un commit specifico |

---

## 24. Aggiornamenti Automatici

Git Expansion supporta gli aggiornamenti automatici tramite GitHub Releases:

1. **Verifica manuale:** Menu **Help > Check for updates...**
2. **Notifica automatica:** L'applicazione verifica periodicamente la disponibilita di nuove versioni
3. Quando disponibile, viene mostrata una notifica con l'opzione di scaricare e installare

L'aggiornamento viene scaricato in background e installato al riavvio.

---

## 25. Scorciatoie da Tastiera

### Globali

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl+O` | Apri repository |
| `Ctrl+N` | Crea nuovo repository (quando nessun repo e aperto) |
| `Ctrl+K` | Apri Commit Dialog |
| `Ctrl+Q` | Esci dall'applicazione |
| `Ctrl+,` | Apri Impostazioni |
| `Ctrl+G` | Apri Git bash |
| `F5` | Aggiorna |

### Grafico dei Commit

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl+F` | Mostra/nascondi la barra di ricerca |

### Commit Dialog

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl+Enter` | Conferma il commit |

### Rebase Interattivo

| Scorciatoia | Azione |
|-------------|--------|
| `P` | Pick (mantieni commit) |
| `R` | Reword (modifica messaggio) |
| `S` | Squash (fondi) |
| `F` | Fixup (fondi senza messaggio) |
| `E` | Edit (modifica commit) |
| `D` | Drop (elimina commit) |

### Generali

| Scorciatoia | Azione |
|-------------|--------|
| `Escape` | Chiudi menu contestuali e dialoghi |
| `Enter` | Conferma nei campi di input |

---

## 26. Temi

Git Expansion offre due temi basati sulla palette **Catppuccin**:

### Dark Theme (Catppuccin Mocha)
- Sfondo scuro con testo chiaro
- Colori accento vibranti
- Alta leggibilita con contrasto ottimizzato

### Light Theme (Catppuccin Latte)
- Sfondo chiaro con testo scuro
- Colori accento adattati per lo sfondo chiaro
- Contrasto elevato per la leggibilita

Cambia tema da: **Settings > General > Theme**

Il tema viene salvato e applicato immediatamente senza riavvio.

---

## 27. Layout Personalizzabile

L'interfaccia usa il sistema **dockview** per pannelli agganciabili:

- **Drag & drop:** Trascina i pannelli per riposizionarli
- **Tab:** Raggruppa piu pannelli nella stessa area con tab
- **Ridimensionamento:** Trascina i bordi per ridimensionare i pannelli
- **Persistenza:** Il layout viene salvato per ogni repository e ripristinato automaticamente

### Pannelli Disponibili

| Pannello | Descrizione |
|----------|-------------|
| Sidebar | Browser di branch, remote, tag, stash, submodule |
| Commit Graph | Grafico dei commit con linee colorate |
| Commit Info | Dettagli del commit selezionato |
| Diff / Files | Diff viewer e albero file del commit |
| Command Log | Cronologia dei comandi Git eseguiti |
| Console | Terminale integrato |
| Author Statistics | Statistiche per autore |
| Codebase Statistics | Statistiche del codice sorgente |

### Reset Layout

Se il layout diventa problematico: **Dashboard > Reset layout** ripristina la disposizione predefinita.

---

## Appendice: Risoluzione Problemi

### Git non trovato
Se Git non e nel PATH di sistema, configura il percorso manualmente in **Settings > Advanced > Git binary path**.

### Performance con repository grandi
- Riduci il numero di commit caricati inizialmente in **Settings > Diff & Graph > Max initial load**
- Usa i filtri branch per limitare la visualizzazione
- Disabilita "Show remote branches" se non necessario

### Auto-fetch non funziona
Verifica che **Settings > General > Auto-fetch** sia abilitato e che l'intervallo sia configurato correttamente.

### Conflitti non rilevati
Assicurati che Git sia aggiornato (2.30+). Premi `F5` per aggiornare lo stato del repository.

---

*Git Expansion e un software open-source rilasciato sotto licenza MIT.*
*Repository: https://github.com/Schengatto/git-expansion*
*Segnala bug: https://github.com/Schengatto/git-expansion/issues*
