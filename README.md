# Ordo

Offline desktop Kanban for macOS and Windows — organise, prioritise and visualise your backlog across several boards.

> Status: design and mockups approved, code skeleton in place (the app opens on the first-launch screen). MVP features are next.

## Develop

Requirements: Node ≥ 22.12 and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev          # run the app with hot reload
pnpm test         # unit + integration tests (Vitest)
pnpm typecheck && pnpm lint
pnpm storybook    # component catalogue, light/dark, fr/en, every colour theme
pnpm dist         # unsigned installer for the current OS (apps/desktop/release/)
```

CI (GitHub Actions) runs the checks, the Electron end-to-end test, and builds unsigned `.dmg` and `.exe` installers as artifacts.

## Documentation

- Functional spec: [`docs/product/spec.md`](docs/product/spec.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md) · Data model: [`docs/data-model.md`](docs/data-model.md)
- Design: [`docs/design/`](docs/design/) (approved mockups, tokens)
- Decisions: [`docs/adr/`](docs/adr/) · Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Working with coding agents: [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md)

Stack: Electron · React · TypeScript · SQLite (better-sqlite3 + Drizzle) · shadcn/ui + Tailwind · TanStack.
