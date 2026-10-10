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

### Troubleshooting

- **`corepack enable` / `pnpm install` fails with `Cannot find matching keyid`**: the Corepack bundled with older Node 22 releases has outdated npm signing keys. Run `npm install -g corepack@latest`, or update Node (`nvm install 22`). Fallback: `corepack disable && npm install -g pnpm@10.28.0`.
- **`pnpm dev` fails with `Error: Electron uninstall`**: the Electron binary was not downloaded during install (interrupted install). Run `node node_modules/electron/install.js`, then `pnpm dev` again.
- **macOS refuses to open the packaged app** (unsigned build): right-click the app → Open, or run `xattr -cr /Applications/Ordo.app`.

CI (GitHub Actions) runs the checks, the Electron end-to-end test, and builds unsigned `.dmg` and `.exe` installers as artifacts.

## Documentation

- Functional spec: [`docs/product/spec.md`](docs/product/spec.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md) · Data model: [`docs/data-model.md`](docs/data-model.md)
- Design: [`docs/design/`](docs/design/) (approved mockups, tokens)
- Decisions: [`docs/adr/`](docs/adr/) · Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Working with coding agents: [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md)

Stack: Electron · React · TypeScript · SQLite (better-sqlite3 + Drizzle) · shadcn/ui + Tailwind · TanStack.
