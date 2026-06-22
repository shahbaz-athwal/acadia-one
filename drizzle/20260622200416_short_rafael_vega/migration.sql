CREATE TABLE `users_table` (
	`age` integer NOT NULL,
	`email` text NOT NULL UNIQUE,
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL
);
