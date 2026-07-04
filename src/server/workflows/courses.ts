import { eq } from "drizzle-orm";

import { type Database, db  } from "@/db";
import { courseMatchingSections, courses } from "@/db/schema";
import { AcadiaExtractor } from "@/server/acadia/extractor";
import type { AcadiaCourse } from "@/server/acadia/schemas/post-search-criteria";

interface FillCoursesDatabaseOptions {
  readonly database?: Database;
  readonly extractor: AcadiaExtractor;
  readonly timestamp?: Date;
}

async function upsertCourse(database: Database, course: AcadiaCourse) {
  await database
    .insert(courses)
    .values({
      academicLevel: course.academicLevel,
      code: course.code,
      credits: course.credits,
      departmentPrefix: course.departmentPrefix,
      description: course.description,
      id: course.id,
      isLab: course.isLab,
      requisites: course.requisites,
      title: course.title,
    })
    .onConflictDoUpdate({
      set: {
        academicLevel: course.academicLevel,
        code: course.code,
        credits: course.credits,
        departmentPrefix: course.departmentPrefix,
        description: course.description,
        isLab: course.isLab,
        requisites: course.requisites,
        title: course.title,
      },
      target: courses.id,
    });
}

async function archiveMatchingSections(database: Database) {
  await database
    .update(courseMatchingSections)
    .set({ isArchived: true })
    .where(eq(courseMatchingSections.isArchived, false));
}

async function insertMatchingSections(
  database: Database,
  acadiaCourses: AcadiaCourse[],
  timestamp: Date
) {
  const matchingSectionRows = acadiaCourses.map((course) => ({
    courseId: course.id,
    isArchived: false,
    isImported: false,
    sectionIds: course.matchingSectionIds,
    timestamp,
  }));

  if (matchingSectionRows.length === 0) {
    return 0;
  }

  await database.insert(courseMatchingSections).values(matchingSectionRows);
  return matchingSectionRows.length;
}

export async function importCourses({
  database = db,
  extractor,
  timestamp = new Date(),
}: FillCoursesDatabaseOptions) {
  const acadiaCourses = await extractor.getAllCourses();

  await Promise.all(
    acadiaCourses.map(async (acadiaCourse) => {
      await upsertCourse(database, acadiaCourse);
    })
  );

  await archiveMatchingSections(database);
  const matchingSections = await insertMatchingSections(
    database,
    acadiaCourses,
    timestamp
  );

  return {
    courses: acadiaCourses.length,
    matchingSections,
  };
}
