# Ordo — agent guide

Ordo is an offline desktop Kanban app (macOS + Windows) for a single user: organise, prioritise and visualise a task backlog across several boards.
This file is the entry point for every coding agent. Read it fully before any change, then read the linked docs relevant to your task.

## Status

Milestones 1 (mockups) and 2 (skeleton) are done: approved mockups are in `docs/design/mockups/`, tokens in `docs/design/tokens.md`. Milestone 3 (MVP) is in progress, one lot per PR: lot 1 (tasks: quick add, cards, detail window) lot 2 (drag and drop, keyboard moves, virtualised columns, error toast), lot 3 (columns: add, settings popover, show more / collapse, delete to the trash) and lot 4 (boards: create with icon and colour, rename, duplicate, archive and restore, reorder) are done.
See `docs/roadmap.md`.

## Stack (decided — see `docs/adr/`)

- Electron + electron-vite, packaged with electron-builder (unsigned `.dmg` / NSIS `.exe` for now)
- TypeScript strict everywhere, pnpm workspaces monorepo
- SQLite via better-sqlite3 (WAL, FTS5), Drizzle ORM + drizzle-kit migrations
- Typed IPC contract in `packages/contracts`, validated with Zod in the main process
- React 19, TanStack Query, TanStack Router (memory history), TanStack Virtual, Zustand (ephemeral UI state only)
- shadcn/ui (Radix) + Tailwind CSS, Lucide icons, cmdk, Tiptap editor, Pragmatic drag and drop (core, hitbox, auto-scroll), react-day-picker (shadcn Calendar)
- i18next + react-i18next (French default, English), date-fns
- Vitest, Testing Library, Playwright (Electron), Storybook, ESLint, Prettier, dependency-cruiser, GitHub Actions (macOS + Windows)

Never add a dependency that is not listed here without asking first.

## Commands

| Command                    | What it does                                    |
| -------------------------- | ----------------------------------------------- |
| `pnpm dev`                 | Run the app with hot reload                     |
| `pnpm typecheck`           | `tsc --noEmit` across all packages              |
| `pnpm lint`                | ESLint + dependency-cruiser                     |
| `pnpm test`                | Vitest (domain, contracts, renderer components) |
| `pnpm e2e`                 | Playwright against the built Electron app       |
| `pnpm storybook`           | Component catalogue, light + dark               |
| `pnpm db:generate`         | Generate a Drizzle migration from the schema    |
| `pnpm build` / `pnpm dist` | Build / produce installers                      |

## Repository map

```text
apps/desktop/src/main/        Electron main process: ipc/ adapters, application/ use cases, infrastructure/ (db, repos, fs), app/ (windows, menus)
apps/desktop/src/preload/     contextBridge only — exposes window.api
apps/desktop/src/renderer/    React UI: app/, features/<feature>/, shared/ui/, styles/ (design tokens), i18n/
packages/domain/              Pure TypeScript: entities, rules, ranking, filters. No I/O.
packages/contracts/           IPC channels + Zod schemas + inferred types, shared by all processes
docs/                         product spec, architecture, data model, ADRs, design, glossary, roadmap
.claude/                      settings, slash commands, review agents
```

## Golden rules

1. **Layers are enforced.** `domain` imports nothing. `contracts` imports only `domain`. `renderer` never imports `main`. A feature imports another feature only through its `index.ts`. dependency-cruiser fails CI on violations. Details: `docs/architecture.md`.
2. **The renderer never touches the database or Node APIs.** Everything goes through `window.api`, typed by `packages/contracts`.
3. **Every IPC input is validated with Zod in the main process** before reaching a use case.
4. **Writes happen in use cases, inside a transaction.** Repositories are dumb.
5. **Ordering uses fractional ranks** (`rank` text column). Moving a card writes exactly one row. Never renumber a column.
6. **No hard-coded colours, sizes or strings in components.** Colours and spacing come from design tokens (`renderer/styles/`); user-facing text comes from i18n keys (`fr` default, `en`).
7. **No UI without an approved mockup.** If a screen or state has no mockup in `docs/design/mockups/`, stop and ask (or run `/mockup`).
8. **Offline by construction.** No network calls, no remote fonts, no telemetry. The only exception would be an opt-in auto-update, not in scope yet.
9. **Performance budgets are requirements**, not goals: see `docs/architecture.md#performance-budgets`.
10. **English everywhere in the repo** (code, comments, commits, docs). French only in translation files.

## Ask before acting

Stop and ask the user a question — with 2–3 options and your recommendation — when:

- the spec is silent or ambiguous about the behaviour you need;
- two rules or documents contradict each other;
- the change touches the database schema, the IPC contract, or an ADR;
- you would add, remove or upgrade a dependency;
- a visual choice has no approved mockup;
- you are about to do something hard to undo (data migration, deleting files, rewriting history).

Do not guess silently. A short question is always cheaper than a wrong implementation.

## Workflow for a feature

1. Read the relevant part of `docs/product/spec.md`. Ask if anything is unclear.
2. Check the mockup exists and is approved (`docs/design/mockups/`).
3. Domain first: pure functions + Vitest tests in `packages/domain`.
4. Contract: add/extend the channel and Zod schemas in `packages/contracts`.
5. Main: use case + repository + IPC adapter.
6. Renderer: query/mutation hooks (optimistic where it matters), components, stories, i18n keys in both languages.
7. E2E test for the user-visible flow.
8. Update docs / write an ADR if a decision changed.

## Definition of done

- `pnpm typecheck`, `pnpm lint`, `pnpm test` green; dependency-cruiser has no violation
- Stories exist for new components, in light and dark themes
- Strings translated in `fr` and `en`
- Docs or ADR updated if a decision changed
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), scope = package or feature (`feat(board-view): …`)

## Further reading

- `docs/product/spec.md` — functional spec and feature lots (MVP / V1 / Later / Never)
- `docs/architecture.md` — processes, layers, IPC, performance, offline
- `docs/data-model.md` — SQLite schema and data rules
- `docs/design/README.md` — visual direction, tokens, mockup process
- `docs/glossary.md` — domain vocabulary, French ↔ English
- `docs/adr/` — architecture decision records
- `docs/roadmap.md` — milestones
