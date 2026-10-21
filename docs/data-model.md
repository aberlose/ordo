# Data model

All data lives in one SQLite file in the app's user data folder (`app.getPath('userData')`).
Schema changes go through Drizzle migrations only, and only after the user has approved them (see AGENTS.md, "Ask before acting").

## Rules

- **IDs are UUIDv7** (text): time-sortable, stable across export/import and any future sync.
- **Order uses fractional keys** (`rank`, text, e.g. via `fractional-indexing`): moving a card writes one row, whatever the column size. Never renumber.
- **Status = column.** `task.column_id` carries the status; `board_column.category` (`todo`, `in_progress`, `done`) gives it business meaning.
- **Description stored twice:** editor JSON (`description_json`, for rendering) and plain text (`description_text`, for search).
- **Search uses FTS5**, kept in sync by triggers.
- **Soft delete** (`deleted_at`) backs both the trash (purged after 30 days) and undo; purging a task also deletes its attachment rows and files.
- **Dates:** `start_date` / `due_date` are calendar days (`YYYY-MM-DD`), no time, no timezone. Timestamps (`*_at`) are Unix epoch milliseconds.
- **Sub-tasks:** one level only — a task whose `parent_id` is set cannot itself be a parent (enforced in the domain).
- **Tags are scoped to a board**: names are unique per board ignoring case and accents (checked in the use case with `isSameTagName`; the `UNIQUE (board_id, name)` index only catches exact duplicates). Deleting a tag is permanent: its `task_tag` links go with it.
- **Attachments** are copied into `userData/attachments/` as `<id>.<ext>` (the original name is only in `file_name`); the DB stores only the relative path. Deleting one is permanent (row and file). Files with no row (a crash between copy and insert) are removed at startup (3 s after the window shows) once they are 10 minutes old. Indexed by `task_id` (migration `0002`). Images of the notes are attachments: the image node stores `attachmentId` and a width in %.
- **Notes:** `description_json` is the editor's ProseMirror JSON (`NULL` when empty; at most 2 MB serialised and 64 levels deep); `description_text` is always derived from it in the main process (`descriptionText`), never sent by the renderer.
- **Priority:** 1 = Very low … 5 = Very high, default 3 (Medium).

## Schema (MVP)

```sql
CREATE TABLE board (
  id TEXT PRIMARY KEY,            -- UUIDv7
  name TEXT NOT NULL,
  icon TEXT, color TEXT,
  rank TEXT NOT NULL,             -- order in the sidebar
  archived_at INTEGER, deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE board_column (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id),
  name TEXT NOT NULL,
  icon TEXT, color TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('todo','in_progress','done')),
  display_limit INTEGER,          -- tasks shown before "Show more"; NULL = no limit
  rank TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE task (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id),
  column_id TEXT NOT NULL REFERENCES board_column(id),  -- = status
  parent_id TEXT REFERENCES task(id),                    -- sub-task, one level only
  key INTEGER NOT NULL,           -- human-readable number per board (ORDO-42)
  title TEXT NOT NULL,
  description_json TEXT,          -- editor document
  description_text TEXT,          -- plain text for search
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  start_date TEXT, due_date TEXT, -- YYYY-MM-DD
  rank TEXT NOT NULL,
  completed_at INTEGER,
  archived_at INTEGER, deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX task_column_rank ON task(column_id, rank) WHERE deleted_at IS NULL;
CREATE INDEX task_parent ON task(parent_id);
CREATE INDEX task_due ON task(board_id, due_date);

CREATE TABLE tag (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id),
  name TEXT NOT NULL, color TEXT NOT NULL,
  UNIQUE (board_id, name)
);
CREATE TABLE task_tag (
  task_id TEXT REFERENCES task(id), tag_id TEXT REFERENCES tag(id),
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE attachment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id),
  file_name TEXT NOT NULL,        -- original name
  stored_path TEXT NOT NULL,      -- relative to userData/attachments
  mime_type TEXT, size_bytes INTEGER,
  created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE task_fts USING fts5(
  title, description_text, tags,
  content='', tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- language, theme, …
```

## Planned (V1)

- `saved_filter` — named filter per board
- `task_link` — typed links between tasks (blocks / blocked by / relates to)
