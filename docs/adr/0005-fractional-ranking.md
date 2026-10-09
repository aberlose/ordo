# 0005 — Fractional ranking for order

- Status: accepted
- Date: 2026-10-09

## Context

Boards, columns and tasks are user-ordered. Moves must be cheap, undoable and safe.

## Options

1. **Fractional index strings** (`rank` text column) — insert between two keys without touching neighbours.
2. Integer positions — every move renumbers the column (N writes).
3. Linked list — awkward queries, fragile.

## Decision

Fractional keys generated in `packages/domain` (based on the `fractional-indexing` algorithm), stored in a `rank` TEXT column, sorted with binary collation.

## Consequences

- A move writes exactly one row.
- Keys grow slowly with repeated inserts at the same spot; a rare rebalance can be done in a maintenance use case if ever needed.
