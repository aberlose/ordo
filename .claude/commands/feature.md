---
description: Implement a feature end to end (spec → mockup check → domain → contract → main → renderer → tests)
argument-hint: <feature name or spec section>
---

Implement: $ARGUMENTS

1. Read the matching section of `docs/product/spec.md` and its lot (MVP / V1 / Later / Never). If it is "Never" or not in the spec, stop and ask.
2. List every ambiguity you see and ask the user before writing code (AskUserQuestion, 2–3 options each, with your recommendation).
3. Check that an approved mockup exists in `docs/design/mockups/` for every screen or state involved. If not, stop and propose running `/mockup`.
4. Write a short plan (files to touch per layer) and show it.
5. Implement in this order, with tests at each step: `packages/domain` → `packages/contracts` → main (use case, repository, IPC adapter) → renderer (hooks, components, stories, i18n fr + en) → e2e.
6. Run `pnpm typecheck && pnpm lint && pnpm test`.
7. Run the `architecture-reviewer` and `ui-reviewer` agents and fix what they report.
8. Update docs / add an ADR if a decision changed. Commit with Conventional Commits.
