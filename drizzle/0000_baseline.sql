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
	`kind` text DEFAULT 'standard' NOT NULL,
	`fixture` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`item_id` text,
	`name` text NOT NULL,
	`desired_qty` integer DEFAULT 1 NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'packing' NOT NULL,
	`checked_out` integer DEFAULT false NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`store_id` text NOT NULL,
	`delta` integer NOT NULL,
	`note` text,
	`logged_at` integer,
	`logged_by` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`description` text,
	`store_id` text NOT NULL,
	`block_id` text,
	`created_at` integer,
	`is_public` integer DEFAULT true NOT NULL,
	`item_type` text DEFAULT 'other' NOT NULL,
	`sku` text,
	`unit` text,
	`min_quantity` integer,
	`cost` integer,
	`expiry_date` integer,
	`use_rate` integer,
	`use_rate_period` text,
	`checked_out` integer DEFAULT false NOT NULL,
	`for_trade` integer DEFAULT false NOT NULL,
	`trade_note` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`block_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`block_id` text,
	`description` text,
	`sku` text,
	`unit` text,
	`min_quantity` integer,
	`cost` integer,
	`expiry_date` integer,
	`use_rate` integer,
	`use_rate_period` text,
	`created_at` integer,
	`created_by` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`block_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `store_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	`created_by` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_invites_token_unique` ON `store_invites` (`token`);--> statement-breakpoint
CREATE TABLE `store_members` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer,
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
	`created_at` integer,
	`is_public` integer DEFAULT false NOT NULL,
	`canvas_visible` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `template_blocks` (
	`block_id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`background` text DEFAULT '#000000' NOT NULL,
	`border` text DEFAULT '#000000' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`height` integer DEFAULT 1 NOT NULL,
	`width` integer DEFAULT 1 NOT NULL,
	`x` integer DEFAULT 0 NOT NULL,
	`y` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'standard' NOT NULL,
	`fixture` text,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`rows` integer DEFAULT 10 NOT NULL,
	`cols` integer DEFAULT 10 NOT NULL,
	`user_id` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `trade_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_item_id` text,
	`listing_store_id` text,
	`listing_name` text NOT NULL,
	`offered_item_id` text,
	`offered_name` text,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`listing_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`listing_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`offered_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
