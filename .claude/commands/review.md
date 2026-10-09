---
description: Review the current changes against Ordo's rules
---

Review the uncommitted changes (or the current branch against `main`):

1. Run `pnpm typecheck && pnpm lint && pnpm test` and report failures.
2. Launch the `architecture-reviewer` and `ui-reviewer` agents in parallel on the diff.
3. Summarise findings by severity with file:line, and propose fixes. Do not apply fixes without asking.
