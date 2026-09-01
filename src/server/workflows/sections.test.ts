import { Database as SQLiteDatabase } from "bun:sqlite";
// oxlint-disable typescript/no-unsafe-type-assertion
import { expect, test } from "bun:test";

import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { okAsync } from "neverthrow";

import {
  courseMatchingSections,
  courses,
  departments,
  professors,
  sectionProfessors,
  sections,
  terms,
} from "@/db/schema";
import type { CourseId, ProfessorId, SectionId } from "@/db/schema";
import type { AcadiaSection } from "@/server/acadia/endpoints/section-details/schema";

import { importSectionDetails } from "./sections";

const COURSE_ID = "course-1" as CourseId;
const SECTION_ONE_ID = "section-1" as SectionId;
const SECTION_TWO_ID = "section-2" as SectionId;
const PROFESSOR_ONE_ID = "professor-1" as ProfessorId;
const PROFESSOR_TWO_ID = "professor-2" as ProfessorId;

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
    CREATE TABLE terms (
      termCode text PRIMARY KEY,
      name text NOT NULL,
      endDate integer NOT NULL,
      startDate integer NOT NULL,
      archivedAt integer
    );
    CREATE TABLE professors (
      id text PRIMARY KEY,
      rmpId text,
      rmpLegacyId integer,
      name text NOT NULL,
      imageUrl text,
      details text
    );
    CREATE TABLE sections (
      id text NOT NULL,
      termCode text NOT NULL REFERENCES terms(termCode),
      courseId text NOT NULL REFERENCES courses(id),
      sectionCode text NOT NULL,
      sectionSearchName text NOT NULL,
      classStart integer,
      classEnd integer,
      buildingName text,
      roomNumber text,
      room text,
      showTBD integer NOT NULL,
      days text NOT NULL,
      isOnline integer NOT NULL
    );
    CREATE TABLE section_professors (
      sectionId text NOT NULL,
      professorId text NOT NULL,
      PRIMARY KEY (sectionId, professorId)
    );
  `);

  return {
    database: drizzle({ client: sqlite, jit: true }),
    sqlite,
  };
}

const acadiaSections: AcadiaSection[] = [
  {
    courseId: COURSE_ID,
    courseName: "Introduction to Testing",
    enrollment: {
      available: 5,
      capacity: 30,
      enrolled: 25,
      waitlisted: 0,
    },
    id: SECTION_ONE_ID,
    instructors: [
      { id: PROFESSOR_ONE_ID, name: "Professor One" },
      { id: PROFESSOR_TWO_ID, name: "Professor Two" },
    ],
    location: "Campus",
    meetingTimes: [
      {
        buildingName: "Carnegie Hall",
        days: [1, 3],
        daysOfWeek: "Monday, Wednesday",
        endTime: "10:45 AM",
        instructionalMethod: "Lecture",
        isOnline: false,
        room: "CAR-101",
        roomNumber: "101",
        showTBD: false,
        startTime: "9:30 a.m.",
      },
      {
        buildingName: "Carnegie Hall",
        days: [5],
        daysOfWeek: "Friday",
        endTime: "14:15:00",
        instructionalMethod: "Lab",
        isOnline: false,
        room: "CAR-102",
        roomNumber: "102",
        showTBD: false,
        startTime: "13:00:00",
      },
    ],
    sectionCode: "01",
    sectionSearchName: "TEST-1000-01",
    term: {
      endDate: "2027-04-20T00:00:00.000Z",
      name: "Winter 2027",
      startDate: "2027-01-05T00:00:00.000Z",
      termCode: "2027WI",
    },
  },
  {
    courseId: COURSE_ID,
    courseName: "Introduction to Testing",
    enrollment: {
      available: 30,
      capacity: 30,
      enrolled: 0,
      waitlisted: 0,
    },
    id: SECTION_TWO_ID,
    instructors: [{ id: PROFESSOR_ONE_ID, name: "Professor One" }],
    location: "Online",
    meetingTimes: [
      {
        buildingName: "",
        days: [],
        daysOfWeek: "",
        endTime: null,
        instructionalMethod: "Online",
        isOnline: true,
        room: null,
        roomNumber: "",
        showTBD: true,
        startTime: null,
      },
    ],
    sectionCode: "02",
    sectionSearchName: "TEST-1000-02",
    term: {
      endDate: "2027-04-20T00:00:00.000Z",
      name: "Winter 2027",
      startDate: "2027-01-05T00:00:00.000Z",
      termCode: "2027WI",
    },
  },
];

test("imports pending section details and leaves completed batches alone", async () => {
  const { database, sqlite } = createTestDatabase();
  const importedAt = new Date("2026-08-15T12:00:00.000Z");
  const previouslyImportedAt = new Date("2026-08-14T12:00:00.000Z");
  const archivedAt = new Date("2026-08-13T12:00:00.000Z");
  const calls: { courseId: CourseId; sectionIds: SectionId[] }[] = [];
  const extractor = {
    getSectionDetails(courseId: CourseId, sectionIds: SectionId[]) {
      calls.push({ courseId, sectionIds });
      return okAsync(acadiaSections);
    },
  };

  try {
    database
      .insert(departments)
      .values({ facultyUrl: "/test", name: "Testing", prefix: "TEST" })
      .run();
    database
      .insert(courses)
      .values({
        academicLevel: 1,
        code: "TEST-1000",
        credits: 3,
        departmentPrefix: "TEST",
        id: COURSE_ID,
        isLab: false,
        title: "Introduction to Testing",
      })
      .run();
    database
      .insert(terms)
      .values({
        endDate: new Date("2026-12-20T00:00:00.000Z"),
        name: "Fall 2026",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        termCode: "2026FA",
      })
      .run();
    database
      .insert(professors)
      .values({
        id: PROFESSOR_ONE_ID,
        name: "Old Professor Name",
        rmpId: "preserved-rmp-id",
      })
      .run();
    database
      .insert(sections)
      .values({
        courseId: COURSE_ID,
        days: [2],
        id: "old-section" as SectionId,
        isOnline: false,
        sectionCode: "OLD",
        sectionSearchName: "TEST-1000-OLD",
        showTBD: false,
        termCode: "2026FA",
      })
      .run();
    database
      .insert(sectionProfessors)
      .values({
        professorId: PROFESSOR_ONE_ID,
        sectionId: "old-section" as SectionId,
      })
      .run();
    database
      .insert(courseMatchingSections)
      .values([
        {
          courseId: COURSE_ID,
          id: "pending-1",
          sectionIds: [SECTION_ONE_ID],
        },
        {
          courseId: COURSE_ID,
          id: "pending-2",
          sectionIds: [SECTION_ONE_ID, SECTION_TWO_ID],
        },
        {
          archivedAt,
          courseId: COURSE_ID,
          id: "archived",
          sectionIds: ["archived-section" as SectionId],
        },
        {
          courseId: COURSE_ID,
          id: "completed",
          importedAt: previouslyImportedAt,
          sectionIds: ["completed-section" as SectionId],
        },
      ])
      .run();

    const result = await importSectionDetails({
      database,
      extractor,
      importedAt,
    });

    expect(result).toEqual({
      courses: 1,
      matchingSections: 2,
      professors: 2,
      sectionProfessors: 3,
      sections: 3,
      terms: 1,
    });
    expect(calls).toEqual([
      {
        courseId: COURSE_ID,
        sectionIds: [SECTION_ONE_ID, SECTION_TWO_ID],
      },
    ]);

    const storedSections = database
      .select()
      .from(sections)
      .orderBy(asc(sections.id), asc(sections.classStart))
      .all();
    expect(storedSections).toHaveLength(3);
    expect(storedSections[0]).toMatchObject({
      classEnd: 645,
      classStart: 570,
      id: SECTION_ONE_ID,
      room: "CAR-101",
    });
    expect(storedSections[1]).toMatchObject({
      classEnd: 855,
      classStart: 780,
      id: SECTION_ONE_ID,
      room: "CAR-102",
    });
    expect(storedSections[2]).toMatchObject({
      classEnd: null,
      classStart: null,
      id: SECTION_TWO_ID,
      isOnline: true,
    });

    expect(database.select().from(sectionProfessors).all()).toHaveLength(3);
    expect(
      database
        .select({ name: professors.name, rmpId: professors.rmpId })
        .from(professors)
        .orderBy(asc(professors.id))
        .all()
    ).toEqual([
      { name: "Professor One", rmpId: "preserved-rmp-id" },
      { name: "Professor Two", rmpId: null },
    ]);

    const importsById = new Map(
      database
        .select({
          archivedAt: courseMatchingSections.archivedAt,
          id: courseMatchingSections.id,
          importedAt: courseMatchingSections.importedAt,
        })
        .from(courseMatchingSections)
        .all()
        .map((row) => [row.id, row])
    );
    expect(importsById.get("pending-1")?.importedAt).toEqual(importedAt);
    expect(importsById.get("pending-2")?.importedAt).toEqual(importedAt);
    expect(importsById.get("archived")).toMatchObject({
      archivedAt,
      importedAt: null,
    });
    expect(importsById.get("completed")?.importedAt).toEqual(
      previouslyImportedAt
    );

    expect(await importSectionDetails({ database, extractor })).toEqual({
      courses: 0,
      matchingSections: 0,
      professors: 0,
      sectionProfessors: 0,
      sections: 0,
      terms: 0,
    });
    expect(calls).toHaveLength(1);
  } finally {
    sqlite.close();
  }
});

test("leaves the archive state of an existing term alone", async () => {
  const { database, sqlite } = createTestDatabase();
  const archivedAt = new Date("2026-08-13T12:00:00.000Z");
  const progress: { completed: number; total: number; unit: string }[] = [];
  const extractor = {
    getSectionDetails: () => okAsync(acadiaSections),
  };

  try {
    database
      .insert(departments)
      .values({ facultyUrl: "/test", name: "Testing", prefix: "TEST" })
      .run();
    database
      .insert(courses)
      .values({
        academicLevel: 1,
        code: "TEST-1000",
        credits: 3,
        departmentPrefix: "TEST",
        id: COURSE_ID,
        isLab: false,
        title: "Introduction to Testing",
      })
      .run();
    // The term the fixture sections belong to, already archived by an admin and
    // carrying stale details the import should refresh.
    database
      .insert(terms)
      .values({
        archivedAt,
        endDate: new Date("2027-04-01T00:00:00.000Z"),
        name: "Stale name",
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        termCode: "2027WI",
      })
      .run();
    database
      .insert(courseMatchingSections)
      .values({
        courseId: COURSE_ID,
        id: "pending-1",
        sectionIds: [SECTION_ONE_ID, SECTION_TWO_ID],
      })
      .run();

    await importSectionDetails({
      database,
      extractor,
      onProgress: (value) => {
        progress.push(value);
      },
    });

    const [storedTerm] = database
      .select()
      .from(terms)
      .where(eq(terms.termCode, "2027WI"))
      .all();

    expect(storedTerm?.archivedAt).toEqual(archivedAt);
    expect(storedTerm?.name).toBe("Winter 2027");
    expect(storedTerm?.endDate).toEqual(new Date("2027-04-20T00:00:00.000Z"));
    expect(progress).toEqual([{ completed: 1, total: 1, unit: "courses" }]);
  } finally {
    sqlite.close();
  }
});
