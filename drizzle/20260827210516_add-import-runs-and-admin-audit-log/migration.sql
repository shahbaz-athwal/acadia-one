CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`target` text,
	`summary` text NOT NULL,
	`before` text,
	`after` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`startedAt` integer NOT NULL,
	`finishedAt` integer,
	`counts` text,
	`errorMessage` text
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_by_created_at` ON `admin_audit_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `import_runs_by_started_at` ON `import_runs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `import_runs_by_status` ON `import_runs` (`status`);