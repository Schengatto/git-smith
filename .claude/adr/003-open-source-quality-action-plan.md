# ADR 003 — Open Source Quality Action Plan

**Data:** 2026-03-21
**Stato:** Completato
**Contesto:** Audit completo del progetto per garantire uno standard alto di qualità prima del rilascio open source pubblico. L'analisi ha coperto: documentazione, sicurezza Electron, qualità del codice, architettura, test coverage, CI/CD.

**Verdetto complessivo:** Il progetto ha un'ottima base (architettura IPC solida, CI/CD professionale, documentazione completa). I punti da migliorare sono concentrati su sicurezza Electron, qualità interna del codice e copertura test (~48%).

---

## P0 — Critici (da fare prima del rilascio pubblico)

### 1. Spostare `AppSettings` in `src/shared/` ed eliminare duplicazione
- **File coinvolti:** `src/main/store.ts:6`, `src/renderer/components/dialogs/SettingsDialog.tsx:8-29`
- **Problema:** Il tipo `AppSettings` e' ridefinito localmente nel renderer con divergenze (es. `theme: string` vs `"dark" | "light"`) e cast unsafe `as unknown as`
- **Fix:** Creare `src/shared/settings-types.ts`, importare in entrambi i processi
- [x] Completato

### 2. Aggiungere costante IPC per `"menu:open-repo"`
- **File coinvolti:** `src/preload/index.ts:404`, `src/main/menu.ts`
- **Problema:** Unico IPC channel hardcoded come stringa letterale invece di usare la costante `IPC`
- **Fix:** Aggiungere `MENU: { OPEN_REPO: "menu:open-repo" }` a `src/shared/ipc-channels.ts`
- [x] Completato

### 3. Valutare `sandbox: true` sulle BrowserWindow
- **File coinvolti:** `src/main/index.ts:51`, `src/main/window-manager.ts:75`
- **Problema:** `sandbox: false` su tutte le finestre riduce l'isolamento OS del renderer
- **Fix:** Attivare `sandbox: true` se il preload non richiede accesso Node diretto, oppure documentare la giustificazione
- [x] Completato

### 4. Criptare `aiApiKey` con `safeStorage` di Electron
- **File coinvolti:** `src/main/store.ts:84`
- **Problema:** API key salvata in plaintext nel config.json locale
- **Fix:** Usare `electron.safeStorage.encryptString()` / `decryptString()` per proteggere il valore su disco
- [x] Completato

### 5. Validare `mergeToolPath` e `mergeToolArgs` contro injection
- **File coinvolti:** `src/main/git/git-service.ts:1301-1311`
- **Problema:** Path e args del merge tool vengono da settings utente e passati a `spawn()` senza validazione
- **Fix:** Validare che toolPath sia un path assoluto a un eseguibile, e che args contenga solo placeholder noti (`$BASE`, `$LOCAL`, `$REMOTE`, `$MERGED`)
- [x] Completato

### 6. Aggiungere Error Boundary root per `<App />`
- **File coinvolti:** `src/renderer/index.tsx:32-36`
- **Problema:** Un errore di render in qualsiasi componente produce uno schermo bianco senza recovery
- **Fix:** Wrappare `<App />` in un ErrorBoundary con UI di recovery e bottone "Reload"
- [x] Completato

---

## P1 — Importanti (qualita' open-source)

### 7. Refactor `CommitGraphPanel` — estrarre dialog state
- **File coinvolti:** `src/renderer/components/graph/CommitGraphPanel.tsx:72-104`
- **Problema:** God component con 20+ `useState`, ~1100 righe
- **Fix:** Estrarre ogni dialog in un componente standalone con stato locale, o creare un `useDialogState` custom hook
- [x] Completato

### 8. Sostituire `catch {}` silenti con feedback utente
- **File coinvolti:** `src/renderer/components/commit/CommitDialog.tsx:221,229,239,249`, `src/renderer/components/sidebar/Sidebar.tsx:137`, `src/renderer/components/dialogs/RemoteDialog.tsx:22`
- **Problema:** Operazioni user-facing (staging, fetch) falliscono silenziosamente
- **Fix:** Mostrare toast/notifica di errore all'utente
- [x] Completato

### 9. Implementare cache in-memory per `store.ts`
- **File coinvolti:** `src/main/store.ts`
- **Problema:** `readFileSync`/`writeFileSync` ad ogni chiamata, nessun cache. Causa jank su Windows con antivirus
- **Fix:** Cache in-memory del config parsato + write debounced + flush su `app.before-quit`
- [x] Completato

### 10. Configurare vitest coverage con soglie minime
- **File coinvolti:** `vitest.config.ts`
- **Problema:** Nessun coverage reporting configurato
- **Fix:** Abilitare `coverage` in vitest config, impostare soglie minime (es. 60%), aggiungere coverage gate nel CI
- [x] Completato

### 11. Scrivere test per `git-service.ts`
- **File coinvolti:** `src/main/git/git-service.ts`
- **Problema:** Core del progetto (45+ metodi) con zero test unitari
- **Fix:** Creare `git-service.test.ts` con test per i metodi principali, mockando `simple-git`
- [x] Completato

### 12. Aggiungere campi mancanti a `package.json`
- **File coinvolti:** `package.json`
- **Problema:** Mancano `engines`, `keywords`, `bugs`, `homepage`
- **Fix:** Aggiungere `"engines": {"node": ">=20"}`, `"keywords": ["git","gui","electron","version-control","desktop"]`, `"bugs"` e `"homepage"` con URL GitHub
- [x] Completato

---

## P2 — Miglioramenti (community-ready)

### 13. Aggiungere `aria-label` ai bottoni icon-only
- **File coinvolti:** Toolbar, dialogs, graph panel (solo 3 file usano `aria-label` attualmente)
- **Problema:** Bottoni con solo icona/simbolo senza label accessibili, app inutilizzabile con screen reader
- **Fix:** Audit di tutti i `<button>` icon-only e aggiunta di `aria-label` descrittivi
- [x] Completato

### 14. Rivedere le 14 soppressioni di `exhaustive-deps`
- **File coinvolti:** `AppShell.tsx`, `CommitGraphPanel.tsx`, `Sidebar.tsx` e altri
- **Problema:** `eslint-disable react-hooks/exhaustive-deps` usato 14 volte, potenziali stale-closure bug
- **Fix:** Rivedere caso per caso: commentare quelli legittimi (mount-only), ristrutturare gli altri con refs/stable callbacks
- [x] Completato

### 15. Implementare i18n con `react-i18next`
- **File coinvolti:** Tutti i componenti renderer
- **Problema:** `language` setting esiste ma non e' consumato. Tutte le stringhe UI hardcoded in inglese
- **Fix:** Integrare `react-i18next`, estrarre stringhe in file di traduzione, consumare il setting `language`
- [x] Completato

### 16. Abilitare `noUncheckedIndexedAccess` in tsconfig
- **File coinvolti:** `tsconfig.json`
- **Problema:** Accesso a indici di array senza check `undefined` non segnalato dal compiler
- **Fix:** Aggiungere `"noUncheckedIndexedAccess": true` e fixare gli errori risultanti
- [x] Completato

### 17. Creare ROADMAP.md
- **Problema:** Manca un documento che comunichi alla community la direzione futura del progetto
- **Fix:** Creare `ROADMAP.md` con milestone e feature pianificate
- [x] Completato

### 18. Sostituire index keys con ID stabili nelle liste interattive
- **File coinvolti:** `BlameView.tsx:214`, `MenuBar.tsx:171,193`, `MergeConflictDialog.tsx:573,599`
- **Problema:** `key={i}` in liste dove gli elementi possono essere riordinati/filtrati
- **Fix:** Usare ID univoci degli elementi come key
- [x] Completato
