# 0008 — Toolchain versions and workspace layout

- Status: accepted
- Date: 2026-10-10

## Context

Setting up the skeleton (milestone 2) on the latest releases revealed peer-dependency conflicts.

## Decision

- **Vite 7** (not 8): electron-vite 5 supports Vite ≤ 7. `@vitejs/plugin-react` 5 goes with it.
- **TypeScript 5.9** (not 6/7): typescript-eslint supports TypeScript < 6.1, and TypeScript 7 changes the compiler API that tools rely on.
- **Electron pinned to an exact version** (`44.7.0`): electron-builder needs an exact version to download binaries.
- **pnpm with `node-linker=hoisted`**: electron-builder collects the app's runtime dependencies from a flat `node_modules`.
- **Workspace packages are consumed as TypeScript sources** (`exports` → `src/index.ts`) and bundled by electron-vite (`externalizeDeps.exclude`); they are never published.
- **better-sqlite3 13** ships N-API prebuilds for macOS, Windows and Linux, so the same binary works under Node (tests) and Electron (app); no `electron-rebuild` step is needed.
- **Main process is ESM** (`"type": "module"`); the preload is a single CommonJS file, as required by the sandbox.
- **Full-text search (FTS5)** is not in the first migration: it lands with the search feature, as a custom migration.

## Consequences

- Upgrade Vite and TypeScript together with electron-vite / typescript-eslint once they support newer majors (ask first: dependency change).
- Renovate-style bumps of Electron must update the exact pin.
