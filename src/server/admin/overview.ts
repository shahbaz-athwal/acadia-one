import {
  and,
  count,
  desc,
  eq,
  getTableName,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { Database } from "@/db";
import {
  adminAuditLog,
  courseMatchingSections,
  courses,
  departments,
  importRuns,
  professorDepartments,
  professorRatingPulls,
  professorRatings,
  professors,
  sectionProfessors,
  sections,
  terms,
} from "@/db/schema";

interface AdminTableCount {
  readonly label: string;
  readonly rows: number;
  readonly table: string;
}

const COUNTED_TABLES: { label: string; table: SQLiteTable }[] = [
  { label: "Departments", table: departments },
  { label: "Courses", table: courses },
  { label: "Course matching sections", table: courseMatchingSections },
  { label: "Terms", table: terms },
  { label: "Sections", table: sections },
  { label: "Professors", table: professors },
  { label: "Professor departments", table: professorDepartments },
  { label: "Section professors", table: sectionProfessors },
  { label: "Professor ratings", table: professorRatings },
  { label: "RMP rating pulls", table: professorRatingPulls },
  { label: "Import runs", table: importRuns },
  { label: "Admin audit log", table: adminAuditLog },
];

export async function getTableCounts(database: Database) {
  const results: AdminTableCount[] = [];

  for (const entry of COUNTED_TABLES) {
    // Sequential on purpose: these are trivial reads against a single SQLite
    // connection, which serialises them regardless.
    // oxlint-disable-next-line no-await-in-loop
    const [row] = await database.select({ value: count() }).from(entry.table);

    results.push({
      label: entry.label,
      rows: row?.value ?? 0,
      table: getTableName(entry.table),
    });
  }

  return results;
}

function readPragmas(database: Database) {
  const client = database.$client;
  const foreignKeys = client
    .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
    .get();
  const pageCount = client
    .query<{ page_count: number }, []>("PRAGMA page_count")
    .get();
  const pageSize = client
    .query<{ page_size: number }, []>("PRAGMA page_size")
    .get();
  const violations = client
    .query<Record<string, unknown>, []>("PRAGMA foreign_key_check")
    .all();

  return {
    databaseBytes: (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 0),
    foreignKeyViolations: violations.length,
    foreignKeysEnabled: foreignKeys?.foreign_keys === 1,
  };
}

export async function getHealthSignals(database: Database) {
  const [pending] = await database
    .select({ value: count() })
    .from(courseMatchingSections)
    .where(
      and(
        isNull(courseMatchingSections.archivedAt),
        isNull(courseMatchingSections.importedAt)
      )
    );

  const [lastImport] = await database
    .select({ importedAt: courseMatchingSections.importedAt })
    .from(courseMatchingSections)
    .where(sql`${courseMatchingSections.importedAt} IS NOT NULL`)
    .orderBy(desc(courseMatchingSections.importedAt))
    .limit(1);

  const [coursesWithoutSections] = await database
    .select({ value: count() })
    .from(courses)
    .where(
      notExists(
        database
          .select({ one: sql`1` })
          .from(sections)
          .where(sql`${sections.courseId} = ${courses.id}`)
      )
    );

  const [professorsWithoutRmpId] = await database
    .select({ value: count() })
    .from(professors)
    .where(isNull(professors.rmpId));

  // `section_professors` declares no foreign keys at all, so nothing stops a
  // row from outliving the section or professor it points at.
  const [orphanedSectionProfessors] = await database
    .select({ value: count() })
    .from(sectionProfessors)
    .where(
      sql`${sectionProfessors.sectionId} NOT IN (SELECT ${sections.id} FROM ${sections})
        OR ${sectionProfessors.professorId} NOT IN (SELECT ${professors.id} FROM ${professors})`
    );

  // A review whose course code did not resolve is kept deliberately, so this is
  // the size of the enrichment backlog rather than a fault.
  const [ratingsWithoutCourse] = await database
    .select({ value: count() })
    .from(professorRatings)
    .where(isNull(professorRatings.courseId));

  const [failedRatingPulls] = await database
    .select({ value: count() })
    .from(professorRatingPulls)
    .where(eq(professorRatingPulls.status, "failed"));

  const [lastRatingPull] = await database
    .select({ finishedAt: professorRatingPulls.finishedAt })
    .from(professorRatingPulls)
    .orderBy(desc(professorRatingPulls.finishedAt))
    .limit(1);

  return {
    ...readPragmas(database),
    coursesWithoutSections: coursesWithoutSections?.value ?? 0,
    failedRatingPulls: failedRatingPulls?.value ?? 0,
    lastRatingPullAt: lastRatingPull?.finishedAt ?? null,
    ratingsWithoutCourse: ratingsWithoutCourse?.value ?? 0,
    lastCourseImportAt: lastImport?.importedAt ?? null,
    orphanedSectionProfessors: orphanedSectionProfessors?.value ?? 0,
    pendingSectionImports: pending?.value ?? 0,
    professorsWithoutRmpId: professorsWithoutRmpId?.value ?? 0,
  };
}
