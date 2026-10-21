# Architecture

Hexagonal architecture spread over Electron's three processes. The UI never touches the database; the main process validates every call; the domain (ordering, filtering, status rules) is pure TypeScript, testable without Electron.

## Processes and layers

```text
Renderer (React, sandboxed)
  Screens (features/*) ──▶ TanStack Query (cache, optimistic) ──▶ IPC client (window.api, typed)
                                                                      │ invoke()
Preload ── contextBridge exposes window.api, nothing else ───────────┤
                                                                      │ ipcMain.handle
Main process (Node)
  IPC adapters (Zod validation) ──▶ Use cases (transactions) ──▶ Domain (pure)
                                         │ ports
                                         ▼
                                   Infrastructure (Drizzle repos) ──▶ SQLite file (WAL, FTS5)

packages/contracts (channels + Zod schemas + types) is imported by renderer, preload and main.
```

### Flow of a drag and drop

1. The screen updates the TanStack Query cache immediately (optimistic).
2. The IPC client calls `tasks.move({ taskId, toColumnId, beforeId, afterId })`.
3. The main-process adapter validates the input with the contract's Zod schema.
4. The `moveTask` use case checks the neighbours, ranks the task between `before` and its true successor in the database (so a stale client can never create a duplicate rank) and writes the single row in a transaction. `columns.move` works the same way for columns.
5. On error the board is reloaded from the database (moves can overlap, so no snapshot rollback) and the error toast offers to retry.

Columns are virtualised (TanStack Virtual): only the visible cards plus a small overscan are in the DOM; the focused card is always kept rendered. `e2e/performance.spec.ts` seeds 10,000 tasks and checks the cold-start budget, the virtualisation and a keyboard move. `search.integration.test.ts` (main) seeds 10,000 tasks with notes in SQLite and checks that `search.tasks` and `search.boardTaskIds` stay under 50 ms (median after a warm-up).

## Folder structure

```text
ordo/
├─ apps/
│  └─ desktop/
│     ├─ src/
│     │  ├─ main/                 # composition root
│     │  │  ├─ ipc/               # adapters: one handler per channel
│     │  │  ├─ application/       # use cases (createTask, moveTask, …)
│     │  │  ├─ infrastructure/    # db/ (Drizzle schema, migrations), repositories, backup, fs
│     │  │  └─ app/               # windows, menus, lifecycle
│     │  ├─ preload/              # contextBridge only
│     │  └─ renderer/
│     │     ├─ app/               # routes, providers, layout
│     │     ├─ features/          # boards, board-view, task-detail, search, command-palette, settings
│     │     │  └─ <feature>/      # components/, hooks/ (queries), store.ts, index.ts
│     │     ├─ shared/ui/         # adapted shadcn components
│     │     ├─ i18n/              # fr.json (default), en.json
│     │     └─ styles/            # design tokens (CSS variables)
│     ├─ e2e/                     # Playwright tests
│     └─ electron-builder.yml
├─ packages/
│  ├─ domain/                     # entities, rules, rank, filters (pure)
│  └─ contracts/                  # IPC channels + Zod schemas + types
├─ docs/
├─ .claude/
├─ AGENTS.md · CLAUDE.md
└─ pnpm-workspace.yaml
```

## Dependency rules (enforced by dependency-cruiser)

| From                  | May import                                             | Must not import                     |
| --------------------- | ------------------------------------------------------ | ----------------------------------- |
| `packages/domain`     | nothing (standard library only)                        | everything else                     |
| `packages/contracts`  | `domain`, `zod`                                        | main, preload, renderer             |
| `main/application`    | `domain`, `contracts`, ports                           | `main/ipc`, Electron, renderer      |
| `main/infrastructure` | `domain`, `application` ports, Drizzle, better-sqlite3 | `main/ipc`, renderer                |
| `main/ipc`            | `contracts`, `application`                             | `infrastructure` directly, renderer |
| `preload`             | `contracts`, Electron `contextBridge`/`ipcRenderer`    | main, renderer                      |
| `renderer`            | `contracts` (types), `domain` (pure helpers)           | main, preload, Node/Electron APIs   |
| `renderer/features/a` | `features/b/index.ts` only                             | `features/b/**` internals           |

## Electron security

`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, no `remote`, navigation and new windows blocked, only `window.api` exposed.

- **Attachments** are served to the page through a privileged local protocol, `ordo-file://attachment/<id>` (the only extra `img-src` of the CSP). The main process looks the id up in the database and serves the stored file from the attachments folder; a path never comes from the URL.
- **Dropped files**: the preload adds one function, `getPathForFile` (Electron's `webUtils`), because the sandboxed page cannot read a dropped file's path; `attachments.add` only copies existing regular files.
- **Opening attachments**: `shell.openPath` is never called on programs, installers, scripts or shortcuts (`isExecutableAttachment`); those are shown in the Finder / Explorer instead. Pasted data is accepted for known image types only, stored with the type's extension. Copies keep the Windows `Zone.Identifier` mark so the system still warns; on macOS the quarantine attribute is not carried (Node cannot copy extended attributes without a native addon), which is acceptable because executables are never opened. Device and network paths are refused for dropped files.
- **Closing the window** first asks the page to flush pending note saves (at most 2 s), then closes the database.
- **Links in notes** open in the default browser: `window.open` of an `http:`, `https:` or `mailto:` URL is handed to `shell.openExternal` by the window-open handler, which denies every new window.

## IPC contract

- One file per area in `packages/contracts` (`boards.ts`, `tasks.ts`, then `columns.ts`, `tags.ts`, `search.ts`, `settings.ts`, `attachments.ts` as they come), shared building blocks in `schemas.ts`, the channel map in `contract.ts`.
- Each channel = name + input schema + output schema. Types are inferred from Zod, never written twice.
- Errors cross the bridge as typed results (`{ ok: false, error: { code, message } }`), never as thrown Electron errors. Codes: `invalid_input` (schema or untrusted sender), `not_found`, `conflict` (a business rule refused the change, e.g. a due date before the start date), `internal`.

## Performance budgets

Target: a board of 10,000 tasks stays fluid. Measured in CI on a generated dataset, not estimated.

| Measure                   | Budget    | How                                                                                  |
| ------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Cold start to board shown | < 1.5 s   | Show window when ready, lazy-load editor and secondary views, prefetch current board |
| Drag and drop             | 60 fps    | Pragmatic DnD, memoised cards, virtualised columns, one row written thanks to `rank` |
| Search on 10,000 tasks    | < 50 ms   | FTS5 index (bm25 ranks first, joins only the best rows), 150 ms input debounce       |
| Open a task               | < 100 ms  | Primary-key query, editor kept loaded after first use                                |
| Idle memory               | < 300 MB  | One window, no heavy library at startup                                              |
| Note save                 | Invisible | Autosave 500 ms after last keystroke, in a transaction                               |

## Offline

- No network calls in the app. Fonts and icons are bundled. No telemetry.
- Data in `userData`. Schema migrations run at startup after a pre-migration copy of the DB file.
- V1: daily hot backup through SQLite's backup API, last 7 kept, restorable from settings.
