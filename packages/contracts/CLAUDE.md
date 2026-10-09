# packages/contracts — rules

The IPC contract shared by renderer, preload and main.

- One file per area: `boards.ts`, `columns.ts`, `tasks.ts`, `tags.ts`, `search.ts`, `settings.ts`, `attachments.ts`.
- Each channel = name + Zod input schema + Zod output schema. Types are `z.infer`-ed, never written by hand.
- Results are `{ ok: true, data } | { ok: false, error: { code, message } }`.
- May import `zod` and `packages/domain` types only.
- Changing an existing channel is a contract change: ask before doing it.
