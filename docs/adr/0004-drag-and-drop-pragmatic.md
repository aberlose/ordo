# 0004 — Pragmatic drag and drop

- Status: accepted
- Date: 2026-10-09

## Context

Drag and drop between and within columns is the core interaction. It must stay at 60 fps on large, virtualised columns and be keyboard-accessible.

## Options

1. **Pragmatic drag and drop (Atlassian)** — powers Jira and Trello, tiny, framework-agnostic, works with virtualisation.
2. dnd-kit — nicer React API, slower on long lists, sortable presets fight virtualisation.
3. react-beautiful-dnd — deprecated.

## Decision

Pragmatic drag and drop, with its accessibility guidance for keyboard moves.

## Consequences

- We write our own drop indicators and keyboard move actions (exposed in the command palette too).
- Moves compute a fractional rank (ADR 0005).
