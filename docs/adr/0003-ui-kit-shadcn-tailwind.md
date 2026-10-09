# 0003 — shadcn/ui + Tailwind as the UI kit

- Status: accepted
- Date: 2026-10-09

## Context

The visual result is a priority and will be iterated through mockups. The owner knows Ant Design well.

## Options

1. **shadcn/ui (Radix) + Tailwind** — components are copied into the repo and fully restylable with our tokens; accessible primitives; LLMs know it very well.
2. **Ant Design** — familiar and complete, but its look is strongly opinionated and harder to fine-tune.

## Decision

shadcn/ui + Tailwind CSS (decided by the owner on 2026-10-09).

## Consequences

- Components live in `renderer/shared/ui/` and are ours to maintain.
- Tailwind theme maps to the semantic CSS variables in `renderer/styles/`; no raw colour classes (`bg-blue-500`) in feature code.
