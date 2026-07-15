CREATE TABLE `name_type_consensus` (
	`name` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`user_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
