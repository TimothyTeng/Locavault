CREATE TABLE `custom_fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'object' NOT NULL,
	`default_color` text DEFAULT '#64748b' NOT NULL,
	`shapes` text DEFAULT '[]' NOT NULL,
	`created_at` integer
);
