CREATE TABLE `terms` (
	`termCode` text PRIMARY KEY,
	`name` text NOT NULL,
	`endDate` integer NOT NULL,
	`startDate` integer NOT NULL,
	`isArchived` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `terms_by_is_archived` ON `terms` (`isArchived`);--> statement-breakpoint
INSERT INTO `terms` (`termCode`, `name`, `endDate`, `startDate`, `isArchived`) VALUES
	('2026SU', '2026 Summer', 1788836400, 1777604400, 0),
	('2026FA', '2026 Fall', 1797739200, 1788922800, 0),
	('2027WI', '2027 Winter', 1808276400, 1799640000, 0),
	('2025COI', '2025/26 Continuous Intake', 1819681200, 1788231600, 0);
--> statement-breakpoint
DROP TABLE `users_table`;