# 0006 — Hexagonal layers and a typed IPC contract

- Status: accepted
- Date: 2026-10-09

## Context

The project is "vibe-coded": LLMs write most of the code. Boundaries must be obvious and mechanically enforced, otherwise they erode.

## Options

1. **Pure domain package + contracts package + main/renderer apps**, boundaries enforced by dependency-cruiser.
2. Single app with folders by convention only.
3. electron-trpc for IPC — uncertain maintenance.

## Decision

pnpm monorepo with `packages/domain` (pure), `packages/contracts` (IPC channels + Zod schemas), `apps/desktop` (main / preload / renderer). The main process is hexagonal: IPC adapters → use cases → ports ← infrastructure. IPC is a hand-written typed contract, validated with Zod in main.

## Consequences

- dependency-cruiser runs in lint and CI.
- Adding an IPC call means touching contracts, an adapter, a use case and a hook — more files, but each trivial and type-checked.
