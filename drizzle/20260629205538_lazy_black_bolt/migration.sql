CREATE INDEX `courses_by_code` ON `courses` (`code`);--> statement-breakpoint
CREATE INDEX `courses_by_department_prefix` ON `courses` (`departmentPrefix`);