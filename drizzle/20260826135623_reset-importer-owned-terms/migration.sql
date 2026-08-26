-- Terms are discovered by the section import, which reads termCode, name, startDate
-- and endDate from the Acadia portal and upserts them. The four rows hand-seeded in
-- 20260627203832 predate that workflow and conflict with it: 2025COI in particular
-- carried dates a year ahead of the term it names. Drop the seeded rows so the
-- importer is the only writer of term data.
--
-- Sections and their professor links are dropped with them: sections.termCode is a
-- foreign key into terms, and section_professors has no foreign keys of its own, so
-- neither is cleaned up automatically. Both are import-derived and are rebuilt from
-- the portal. On a database that has not run a section import these are no-ops.
DELETE FROM `section_professors`;--> statement-breakpoint
DELETE FROM `sections`;--> statement-breakpoint
DELETE FROM `terms`;--> statement-breakpoint
-- importSectionDetails only visits course_matching_sections rows where importedAt is
-- null, so clearing the mark on the active rows is what lets the next import rebuild
-- the terms and sections deleted above. Archived rows keep their mark.
UPDATE `course_matching_sections`
SET `importedAt` = NULL
WHERE `archivedAt` IS NULL;
