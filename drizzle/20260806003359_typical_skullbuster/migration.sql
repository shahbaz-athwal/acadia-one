CREATE TABLE `professor_departments` (
	`professorId` text NOT NULL,
	`departmentPrefix` text NOT NULL,
	CONSTRAINT `professor_departments_pk` PRIMARY KEY(`professorId`, `departmentPrefix`),
	CONSTRAINT `fk_professor_departments_professorId_professors_id_fk` FOREIGN KEY (`professorId`) REFERENCES `professors`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_professor_departments_departmentPrefix_departments_prefix_fk` FOREIGN KEY (`departmentPrefix`) REFERENCES `departments`(`prefix`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `professors` (
	`id` text PRIMARY KEY,
	`rmpId` text,
	`rmpLegacyId` integer,
	`name` text NOT NULL,
	`imageUrl` text,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `section_professors` (
	`sectionId` text NOT NULL,
	`professorId` text NOT NULL,
	CONSTRAINT `section_professors_pk` PRIMARY KEY(`sectionId`, `professorId`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text NOT NULL,
	`termCode` text NOT NULL,
	`courseId` text NOT NULL,
	`sectionCode` text NOT NULL,
	`sectionSearchName` text NOT NULL,
	`classStart` integer,
	`classEnd` integer,
	`buildingName` text,
	`roomNumber` text,
	`room` text,
	`showTBD` integer NOT NULL,
	`days` text NOT NULL,
	`isOnline` integer NOT NULL,
	CONSTRAINT `fk_sections_termCode_terms_termCode_fk` FOREIGN KEY (`termCode`) REFERENCES `terms`(`termCode`),
	CONSTRAINT `fk_sections_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_matching_sections` ADD `importedAt` integer;--> statement-breakpoint
ALTER TABLE `course_matching_sections` ADD `archivedAt` integer;--> statement-breakpoint
ALTER TABLE `terms` ADD `archivedAt` integer;--> statement-breakpoint
DROP INDEX IF EXISTS `course_matching_sections_by_course_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `course_matching_sections_by_is_archived`;--> statement-breakpoint
DROP INDEX IF EXISTS `terms_by_is_archived`;--> statement-breakpoint
CREATE INDEX `course_matching_sections_by_archived_at` ON `course_matching_sections` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `courses_by_academic_level` ON `courses` (`academicLevel`);--> statement-breakpoint
CREATE INDEX `professor_departments_by_department_prefix` ON `professor_departments` (`departmentPrefix`,`professorId`);--> statement-breakpoint
CREATE INDEX `section_professors_by_professor_id` ON `section_professors` (`professorId`);--> statement-breakpoint
CREATE INDEX `sections_by_class_times` ON `sections` (`classStart`,`classEnd`);--> statement-breakpoint
CREATE INDEX `sections_by_term_code_and_class_times` ON `sections` (`termCode`,`classStart`,`classEnd`);--> statement-breakpoint
CREATE INDEX `terms_by_archived_at` ON `terms` (`archivedAt`);--> statement-breakpoint
ALTER TABLE `course_matching_sections` DROP COLUMN `timestamp`;--> statement-breakpoint
ALTER TABLE `course_matching_sections` DROP COLUMN `isArchived`;--> statement-breakpoint
ALTER TABLE `course_matching_sections` DROP COLUMN `isImported`;--> statement-breakpoint
ALTER TABLE `terms` DROP COLUMN `isArchived`;