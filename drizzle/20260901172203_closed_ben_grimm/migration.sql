CREATE TABLE `professor_rating_pulls` (
	`professorId` text PRIMARY KEY,
	`runId` text,
	`status` text NOT NULL,
	`skipReason` text,
	`startedAt` integer NOT NULL,
	`finishedAt` integer NOT NULL,
	`durationMs` integer NOT NULL,
	`requests` integer NOT NULL,
	`reportedCount` integer,
	`highWaterLegacyId` integer,
	`fetched` integer NOT NULL,
	`inserted` integer NOT NULL,
	`updated` integer NOT NULL,
	`linked` integer NOT NULL,
	`unlinked` integer NOT NULL,
	`errorMessage` text
);
--> statement-breakpoint
CREATE TABLE `professor_ratings` (
	`id` text PRIMARY KEY,
	`rmpLegacyId` integer NOT NULL,
	`professorId` text NOT NULL,
	`courseId` text,
	`courseCode` text,
	`courseCodeRaw` text,
	`quality` real NOT NULL,
	`helpful` integer NOT NULL,
	`clarity` integer NOT NULL,
	`difficulty` integer NOT NULL,
	`comment` text,
	`tags` text NOT NULL,
	`gradeReceived` text,
	`isForCredit` integer,
	`attendanceRequired` integer,
	`wouldTakeAgain` integer,
	`textbookUse` integer,
	`thumbsUpTotal` integer NOT NULL,
	`thumbsDownTotal` integer NOT NULL,
	`postedAt` integer NOT NULL,
	`importedAt` integer NOT NULL,
	CONSTRAINT `fk_professor_ratings_professorId_professors_id_fk` FOREIGN KEY (`professorId`) REFERENCES `professors`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_professor_ratings_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `professor_rating_pulls_by_status` ON `professor_rating_pulls` (`status`);--> statement-breakpoint
CREATE INDEX `professor_rating_pulls_by_finished_at` ON `professor_rating_pulls` (`finishedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `professor_ratings_by_rmp_legacy_id` ON `professor_ratings` (`rmpLegacyId`);--> statement-breakpoint
CREATE INDEX `professor_ratings_by_professor_id` ON `professor_ratings` (`professorId`,`rmpLegacyId`);--> statement-breakpoint
CREATE INDEX `professor_ratings_by_course_id` ON `professor_ratings` (`courseId`);--> statement-breakpoint
CREATE INDEX `professor_ratings_by_posted_at` ON `professor_ratings` (`postedAt`);