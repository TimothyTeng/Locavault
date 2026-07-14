CREATE TABLE `trade_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`offer_id`) REFERENCES `trade_offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `trade_offers` ADD `completed_at` integer;