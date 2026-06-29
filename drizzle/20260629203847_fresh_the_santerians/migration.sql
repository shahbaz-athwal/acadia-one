CREATE TABLE `course_matching_sections` (
	`id` text PRIMARY KEY,
	`courseId` text NOT NULL,
	`sectionIds` text NOT NULL,
	`timestamp` integer NOT NULL,
	`isArchived` integer NOT NULL,
	`isImported` integer NOT NULL,
	CONSTRAINT `fk_course_matching_sections_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`departmentPrefix` text NOT NULL,
	`credits` real NOT NULL,
	`isLab` integer NOT NULL,
	`academicLevel` integer NOT NULL,
	`requisites` text,
	CONSTRAINT `fk_courses_departmentPrefix_departments_prefix_fk` FOREIGN KEY (`departmentPrefix`) REFERENCES `departments`(`prefix`)
);
--> statement-breakpoint
CREATE INDEX `course_matching_sections_by_course_id` ON `course_matching_sections` (`courseId`);--> statement-breakpoint
CREATE INDEX `course_matching_sections_by_is_archived` ON `course_matching_sections` (`isArchived`);