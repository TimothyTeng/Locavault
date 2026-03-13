ALTER TABLE `items` ADD `block_id` text NOT NULL REFERENCES blocks(block_id);--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `x_coord`;--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `y_coord`;