CREATE TABLE `blocks` (
	`block_id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`background` text DEFAULT '#000000' NOT NULL,
	`border` text DEFAULT '#000000' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`height` integer DEFAULT 1 NOT NULL,
	`width` integer DEFAULT 1 NOT NULL,
	`x` integer DEFAULT 0 NOT NULL,
	`y` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`description` text,
	`store_id` text NOT NULL,
	`x_coord` integer DEFAULT 0 NOT NULL,
	`y_coord` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`description` text,
	`rows` integer DEFAULT 10 NOT NULL,
	`cols` integer DEFAULT 10 NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer
);
