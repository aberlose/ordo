-- Full-text search on tasks (title, notes text, tag names), kept in sync by triggers.
-- A regular FTS5 table that keeps its own copy of the text. `task_id` is indexed (weight 0 in
-- bm25, never searched by user queries, which are restricted to the other columns) so that a
-- trigger finds a task's row through the index instead of scanning the table: the lookup matches
-- the id's last 12 characters as a phrase, then checks the whole id. Soft-deleted tasks stay in
-- the index; queries filter them out.
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
  WHERE rowid = (SELECT rowid FROM task_fts
    WHERE task_fts MATCH 'task_id : "' || substr(NEW.id, -12) || '"' AND task_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_delete` AFTER DELETE ON `task` BEGIN
  DELETE FROM task_fts
  WHERE rowid = (SELECT rowid FROM task_fts
    WHERE task_fts MATCH 'task_id : "' || substr(OLD.id, -12) || '"' AND task_id = OLD.id);
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_tag_insert` AFTER INSERT ON `task_tag` BEGIN
  UPDATE task_fts SET tags = (
    SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = NEW.task_id
  )
  WHERE rowid = (SELECT rowid FROM task_fts
    WHERE task_fts MATCH 'task_id : "' || substr(NEW.task_id, -12) || '"' AND task_id = NEW.task_id);
END;
--> statement-breakpoint
CREATE TRIGGER `task_fts_task_tag_delete` AFTER DELETE ON `task_tag` BEGIN
  UPDATE task_fts SET tags = (
    SELECT coalesce(group_concat(tg.name, ' '), '') FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
    WHERE tt.task_id = OLD.task_id
  )
  WHERE rowid = (SELECT rowid FROM task_fts
    WHERE task_fts MATCH 'task_id : "' || substr(OLD.task_id, -12) || '"' AND task_id = OLD.task_id);
END;
--> statement-breakpoint
-- Renaming a tag is rare: one pass over the index is fine. Deleting a tag removes its `task_tag`
-- links first (the foreign key has no cascade), which the trigger above handles.
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
