CREATE TABLE `dev_room_config` (
	`room_id` text PRIMARY KEY NOT NULL,
	`require_approval` integer DEFAULT false NOT NULL,
	`closed` integer DEFAULT false NOT NULL
);
