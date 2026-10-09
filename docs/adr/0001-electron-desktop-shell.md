# 0001 — Electron as the desktop shell

- Status: accepted
- Date: 2026-10-09

## Context

Ordo must install on macOS and Windows, run fully offline, and reuse the owner's front-end expertise (TypeScript, React, Vite, TanStack Query). Visual quality is a top priority.

## Options

1. **Electron** — all TypeScript, very mature ecosystem, Chromium rendering identical on both OSes. Heavier binary (~100 MB) and memory.
2. **Tauri 2** — small binary, low memory. Back end in Rust; WebKit on macOS vs WebView2 on Windows means rendering differences.
3. **Kotlin Compose Desktop** — matches the owner's back-end stack, but a much thinner UI ecosystem for a polished look.

## Decision

Electron, built with electron-vite and packaged with electron-builder. Chosen by the owner: one language end to end, identical rendering on both platforms, and the richest ecosystem for the UI.

## Consequences

- Memory and startup must be watched actively (budgets in `docs/architecture.md`).
- Security hardening is mandatory (context isolation, sandbox, CSP).
- Builds are unsigned for now; first launch requires user confirmation.
