# packages/domain — rules

Pure TypeScript. This package is the heart of Ordo and must stay trivially testable.

- No imports from Electron, Node built-ins (`fs`, `path`…), React, Drizzle, better-sqlite3 or `contracts`. Standard library only.
- No I/O, no clock, no randomness inside functions: pass `now` and ids in as arguments.
- Functions are pure and small; entities are plain readonly types, not classes with hidden state.
- Every rule has Vitest tests next to it (`*.test.ts`), including edge cases (empty column, first/last position, one-level sub-task rule, priority bounds).
- What lives here: entity types, priority and status rules, fractional rank generation, filter/search predicates, sub-task progress, trash retention rule.
