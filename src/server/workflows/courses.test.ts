import { Database as SQLiteDatabase } from "bun:sqlite";
// oxlint-disable typescript/no-unsafe-type-assertion
import { expect, test } from "bun:test";

import { asc, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { okAsync } from "neverthrow";

import { courseMatchingSections, courses, departments } from "@/db/schema";
import type { CourseId, SectionId } from "@/db/schema";
import type { AcadiaCourse } from "@/server/acadia/endpoints/post-search-criteria/schema";

import { importCourses } from "./courses";

const EXISTING_COURSE_ID = "course-1" as CourseId;
const NEW_COURSE_ID = "course-2" as CourseId;
const REMOVED_COURSE_ID = "course-old" as CourseId;

function createTestDatabase() {
  const sqlite = new SQLiteDatabase(":memory:");

  sqlite.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE departments (
      prefix text PRIMARY KEY,
      name text NOT NULL,
      facultyUrl text NOT NULL
    );
    CREATE TABLE courses (
      id text PRIMARY KEY,
      code text NOT NULL,
      title text NOT NULL,
      description text,
      departmentPrefix text NOT NULL REFERENCES departments(prefix),
      credits real NOT NULL,
      isLab integer NOT NULL,
      academicLevel integer NOT NULL,
      requisites text
    );
    CREATE TABLE course_matching_sections (
      id text PRIMARY KEY,
      courseId text NOT NULL REFERENCES courses(id),
      sectionIds text NOT NULL,
      importedAt integer,
      archivedAt integer
    );
  `);

  return {
    database: drizzle({ client: sqlite, jit: true }),
    sqlite,
  };
}

const acadiaCourses: AcadiaCourse[] = [
  {
    academicLevel: 1,
    code: "TEST-1000",
    credits: 3,
    departmentPrefix: "TEST",
    description: "Current description",
    id: EXISTING_COURSE_ID,
    isLab: false,
    matchingSectionIds: ["section-1" as SectionId],
    requisites: [],
    title: "Updated course",
  },
  {
    academicLevel: 2,
    code: "TEST-2000L",
    credits: 1,
    departmentPrefix: "TEST",
    description: "A new lab",
    id: NEW_COURSE_ID,
    isLab: true,
    matchingSectionIds: ["section-2" as SectionId, "section-3" as SectionId],
    requisites: [{ codes: ["TEST-1000"], textExtension: "" }],
    title: "New course",
  },
];

test("archives the previous discovery snapshot before queuing current courses", async () => {
  const { database, sqlite } = createTestDatabase();
  const previousArchiveDate = new Date("2026-08-10T12:00:00.000Z");
  const snapshotAt = new Date("2026-08-15T12:00:00.000Z");
  const extractor = {
    getAllCourses() {
      return okAsync(acadiaCourses);
    },
  };

  try {
    database
      .insert(departments)
      .values({ facultyUrl: "/test", name: "Testing", prefix: "TEST" })
      .run();
    database
      .insert(courses)
      .values([
        {
          academicLevel: 1,
          code: "TEST-1000",
          credits: 3,
          departmentPrefix: "TEST",
          description: "Outdated description",
          id: EXISTING_COURSE_ID,
          isLab: false,
          title: "Outdated course",
        },
        {
          academicLevel: 3,
          code: "TEST-3000",
          credits: 3,
          departmentPrefix: "TEST",
          id: REMOVED_COURSE_ID,
          isLab: false,
          title: "No longer in the discovery response",
        },
      ])
      .run();
    database
      .insert(courseMatchingSections)
      .values([
        {
          courseId: EXISTING_COURSE_ID,
          id: "active-old-snapshot",
          sectionIds: ["old-active-section" as SectionId],
        },
        {
          archivedAt: previousArchiveDate,
          courseId: EXISTING_COURSE_ID,
          id: "already-archived",
          sectionIds: ["old-archived-section" as SectionId],
        },
      ])
      .run();

    const result = await importCourses({
      database,
      extractor,
      snapshotAt,
    });

    expect(result).toEqual({
      archivedMatchingSections: 1,
      courses: 2,
      matchingSections: 2,
    });
    expect(
      database
        .select({ id: courses.id, title: courses.title })
        .from(courses)
        .orderBy(asc(courses.id))
        .all()
    ).toEqual([
      { id: EXISTING_COURSE_ID, title: "Updated course" },
      { id: NEW_COURSE_ID, title: "New course" },
      {
        id: REMOVED_COURSE_ID,
        title: "No longer in the discovery response",
      },
    ]);

    const matchingRows = database.select().from(courseMatchingSections).all();
    const matchingRowsById = new Map(matchingRows.map((row) => [row.id, row]));

    expect(matchingRowsById.get("active-old-snapshot")?.archivedAt).toEqual(
      snapshotAt
    );
    expect(matchingRowsById.get("already-archived")?.archivedAt).toEqual(
      previousArchiveDate
    );
    expect(
      database
        .select({
          courseId: courseMatchingSections.courseId,
          sectionIds: courseMatchingSections.sectionIds,
        })
        .from(courseMatchingSections)
        .where(isNull(courseMatchingSections.archivedAt))
        .orderBy(asc(courseMatchingSections.courseId))
        .all()
    ).toEqual([
      {
        courseId: EXISTING_COURSE_ID,
        sectionIds: ["section-1" as SectionId],
      },
      {
        courseId: NEW_COURSE_ID,
        sectionIds: ["section-2" as SectionId, "section-3" as SectionId],
      },
    ]);

    let emptyResponseError: Error | undefined;

    try {
      await importCourses({
        database,
        extractor: { getAllCourses: () => okAsync([]) },
      });
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      emptyResponseError = error;
    }

    expect(emptyResponseError?.message).toContain("Acadia returned no courses");
    expect(
      database
        .select()
        .from(courseMatchingSections)
        .where(isNull(courseMatchingSections.archivedAt))
        .all()
    ).toHaveLength(2);
  } finally {
    sqlite.close();
  }
});
