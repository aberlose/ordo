-- Full-text search on tasks (title, notes text, tag names), kept in sync by triggers.
-- A regular FTS5 table that keeps its own copy of the text. Soft-deleted tasks stay in the index;
-- queries filter them out.
--
-- `task_id` is indexed (weight 0 in bm25, never searched by user queries, which are restricted to
-- the other columns) so that a trigger finds a task's row through the index instead of scanning
-- the table. Coupling with the ids (`infrastructure/ids.ts`, UUIDv7 today): a trigger quotes the
-- WHOLE id as an FTS5 phrase (`"` doubled, so any id is valid FTS5 syntax), the tokenizer splits it
-- on `-` into a phrase of tokens, and `task_id = id` then keeps only the exact row (a phrase could
-- also match inside a longer id). An id with no letter or digit has no token, so the phrase finds
-- nothing: `coalesce` then falls back to a scan, for that id only (never the case for UUIDs).
CREATE VIRTUAL TABLE `task_fts` USING fts5(
  task_id, title, description_text, tags,
  tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3'
);
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_insert` AFTER INSERT ON `task` BEGIN
  INSERT INTO task_fts (task_id, title, description_text, tags) VALUES (
    NEW.id, NEW.title, coalesce(NEW.description_text, ''),
    (SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
      WHERE tt.task_id = NEW.id)
  );
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_update` AFTER UPDATE OF title, description_text ON `task`
WHEN OLD.title IS NOT NEW.title OR OLD.description_text IS NOT NEW.description_text BEGIN
  UPDATE task_fts SET title = NEW.title, description_text = coalesce(NEW.description_text, '')
  WHERE rowid = coalesce(
    (SELECT rowid FROM task_fts
      WHERE task_fts MATCH 'task_id : "' || replace(NEW.id, '"', '""') || '"' AND task_id = NEW.id),
    (SELECT rowid FROM task_fts WHERE task_id = NEW.id));
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_delete` AFTER DELETE ON `task` BEGIN
  DELETE FROM task_fts
  WHERE rowid = coalesce(
    (SELECT rowid FROM task_fts
      WHERE task_fts MATCH 'task_id : "' || replace(OLD.id, '"', '""') || '"' AND task_id = OLD.id),
    (SELECT rowid FROM task_fts WHERE task_id = OLD.id));
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_tag_insert` AFTER INSERT ON `task_tag` BEGIN
  UPDATE task_fts SET tags = (
    SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = NEW.task_id
  )
  WHERE rowid = coalesce(
    (SELECT rowid FROM task_fts
      WHERE task_fts MATCH 'task_id : "' || replace(NEW.task_id, '"', '""') || '"' AND task_id = NEW.task_id),
    (SELECT rowid FROM task_fts WHERE task_id = NEW.task_id));
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_tag_delete` AFTER DELETE ON `task_tag` BEGIN
  UPDATE task_fts SET tags = (
    SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = OLD.task_id
  )
  WHERE rowid = coalesce(
    (SELECT rowid FROM task_fts
      WHERE task_fts MATCH 'task_id : "' || replace(OLD.task_id, '"', '""') || '"' AND task_id = OLD.task_id),
    (SELECT rowid FROM task_fts WHERE task_id = OLD.task_id));
END;
--> statement-breakpoint
-- Renaming a tag is rare: one pass over the index (reading `task_id` only) is fine, and measured
-- faster than one indexed lookup per tagged task (2,500 tagged tasks of 10,000: ~30 ms vs ~110 ms
-- or more). Deleting a tag removes its `task_tag` links first (the foreign key has no cascade),
-- which the link triggers handle.
CREATE TRIGGER `task_fts_tag_rename` AFTER UPDATE OF name ON `tag` WHEN OLD.name IS NOT NEW.name BEGIN
  UPDATE task_fts SET tags = (
    SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = task_fts.task_id
  )
  WHERE task_id IN (SELECT task_id FROM task_tag WHERE tag_id = NEW.id);
END;
--> statement-breakpoint
INSERT INTO task_fts (task_id, title, description_text, tags)
SELECT t.id, t.title, coalesce(t.description_text, ''),
  (SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = t.id)
FROM task t;
