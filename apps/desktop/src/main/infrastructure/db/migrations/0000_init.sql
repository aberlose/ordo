CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`file_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `board` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`rank` text NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `board_column` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text NOT NULL,
	`category` text NOT NULL,
	`display_limit` integer,
	`rank` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "board_column_category" CHECK("board_column"."category" in ('todo','in_progress','done'))
);
--> statement-breakpoint
CREATE INDEX `board_column_board_rank` ON `board_column` (`board_id`,`rank`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_board_name` ON `tag` (`board_id`,`name`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`column_id` text NOT NULL,
	`parent_id` text,
	`key` integer NOT NULL,
	`title` text NOT NULL,
	`description_json` text,
	`description_text` text,
	`priority` integer DEFAULT 3 NOT NULL,
	`start_date` text,
	`due_date` text,
	`rank` text NOT NULL,
	`completed_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`column_id`) REFERENCES `board_column`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_priority" CHECK("task"."priority" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `task_column_rank` ON `task` (`column_id`,`rank`) WHERE "task"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `task_parent` ON `task` (`parent_id`);--> statement-breakpoint
CREATE INDEX `task_due` ON `task` (`board_id`,`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_board_key` ON `task` (`board_id`,`key`);--> statement-breakpoint
CREATE TABLE `task_tag` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
