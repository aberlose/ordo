# Main process — rules

- Composition root: wire repositories into use cases and use cases into IPC adapters here, nowhere else.
- `ipc/`: one handler per channel. Parse input with the contract's Zod schema, call one use case, map errors to the typed result. No business logic, no DB access.
- `application/`: use cases. Every write runs inside a transaction. Depend on ports (interfaces), not on Drizzle.
- `infrastructure/`: Drizzle schema, migrations, repositories, attachment storage, backups. Raw SQL only for FTS5 and triggers.
- Security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, block navigation and `window.open`.
- Never make a network call.
- Schema change = new Drizzle migration, and only after the user approved it.
