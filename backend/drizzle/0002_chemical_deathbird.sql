ALTER TABLE `programs` ADD `task_tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `scope` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `impacts` text DEFAULT '[]' NOT NULL;