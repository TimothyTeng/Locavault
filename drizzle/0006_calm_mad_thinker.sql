ALTER TABLE `purchase_order_items` ADD `item_type` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `package_size` text;