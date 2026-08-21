CREATE TABLE `change_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`type` text NOT NULL,
	`field` text,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`reward_min` real,
	`reward_max` real,
	`reward_currency` text,
	`reward_raw` text,
	`chains` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`last_changed_at` integer NOT NULL,
	`raw` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programs_platform_external_id_idx` ON `programs` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `source_status` (
	`platform` text PRIMARY KEY NOT NULL,
	`last_polled_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`last_program_count` integer,
	`poll_interval_ms` integer NOT NULL
);
