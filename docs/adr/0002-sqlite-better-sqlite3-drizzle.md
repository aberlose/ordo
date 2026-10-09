# 0002 — SQLite with better-sqlite3 and Drizzle

- Status: accepted
- Date: 2026-10-09

## Context

Single user, single machine, offline, up to ~10,000 tasks per board, full-text search, transactional moves. The owner knows relational databases (PostgreSQL, SQL Server) and Hibernate.

## Options

1. **SQLite + better-sqlite3 + Drizzle** — fastest Node SQLite driver, synchronous sub-millisecond queries, FTS5 built in; Drizzle gives typed SQL-like queries and versioned migrations.
2. SQLite + Prisma — heavy engine to ship inside Electron.
3. `node:sqlite` — promising but still young.
4. JSON files / IndexedDB — no real transactions, no SQL, weak search.

## Decision

SQLite in WAL mode via better-sqlite3, accessed through Drizzle ORM, migrations with drizzle-kit. Runs only in the main process.

## Consequences

- better-sqlite3 is a native module: it must be rebuilt for Electron's ABI (electron-builder `install-app-deps`) and CI must build on each OS.
- FTS5 virtual table and triggers are written as raw SQL in migrations.
- A pre-migration copy of the DB file is taken at startup.
