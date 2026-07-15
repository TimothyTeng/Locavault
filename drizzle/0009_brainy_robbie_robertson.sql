ALTER TABLE `recipes` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `usage_count` integer DEFAULT 0 NOT NULL;