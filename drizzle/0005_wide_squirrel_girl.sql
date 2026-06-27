CREATE TABLE `scheduled_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`user_id` text NOT NULL,
	`recipe_ref` text NOT NULL,
	`recipe_name` text NOT NULL,
	`date_key` text NOT NULL,
	`meal_type` text DEFAULT 'dinner' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
