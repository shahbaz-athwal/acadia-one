import { isNull } from "drizzle-orm";

import { db } from "@/db";
import type { Database } from "@/db";
import { courseMatchingSections, courses, departments } from "@/db/schema";
import type { CourseId } from "@/db/schema";
import type { AcadiaCourse } from "@/server/acadia/endpoints/post-search-criteria/schema";
import type { AcadiaExtractor } from "@/server/acadia/extractor";

interface CourseExtractor {
  readonly getAllCourses: AcadiaExtractor["getAllCourses"];
}

interface ImportCoursesOptions {
  readonly database?: Database;
  readonly extractor: CourseExtractor;
  readonly snapshotAt?: Date;
}

function deduplicateCourses(acadiaCourses: AcadiaCourse[]) {
  const coursesById = new Map<CourseId, AcadiaCourse>();

  for (const course of acadiaCourses) {
    coursesById.set(course.id, course);
  }

  return [...coursesById.values()];
}

async function validateDepartments(
  database: Database,
  acadiaCourses: AcadiaCourse[]
) {
  const departmentRows = await database
    .select({ prefix: departments.prefix })
    .from(departments);
  const knownDepartments = new Set(departmentRows.map(({ prefix }) => prefix));
  const missingDepartments = [
    ...new Set(
      acadiaCourses
        .map(({ departmentPrefix }) => departmentPrefix)
        .filter((prefix) => !knownDepartments.has(prefix))
    ),
  ];

  if (missingDepartments.length > 0) {
    throw new Error(
      `Cannot import courses before these departments are seeded: ${missingDepartments.join(
        ", "
      )}.`
    );
  }
}

export async function importCourses({
  database = db,
  extractor,
  snapshotAt = new Date(),
}: ImportCoursesOptions) {
  const coursesResult = await extractor.getAllCourses();

  if (coursesResult.isErr()) {
    throw new Error(
      `Could not import courses: ${coursesResult.error.message}`,
      {
        cause: coursesResult.error,
      }
    );
  }

  const acadiaCourses = deduplicateCourses(coursesResult.value);

  if (acadiaCourses.length === 0) {
    throw new Error(
      "Acadia returned no courses; existing data was not changed."
    );
  }

  await validateDepartments(database, acadiaCourses);

  const archivedMatchingSections = database.transaction((transaction) => {
    const activeMatchingSections = transaction
      .select({ id: courseMatchingSections.id })
      .from(courseMatchingSections)
      .where(isNull(courseMatchingSections.archivedAt))
      .all();

    transaction
      .update(courseMatchingSections)
      .set({ archivedAt: snapshotAt })
      .where(isNull(courseMatchingSections.archivedAt))
      .run();

    for (const course of acadiaCourses) {
      transaction
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
        })
        .run();
    }

    transaction
      .insert(courseMatchingSections)
      .values(
        acadiaCourses.map((course) => ({
          courseId: course.id,
          sectionIds: course.matchingSectionIds,
        }))
      )
      .run();

    return activeMatchingSections.length;
  });

  return {
    archivedMatchingSections,
    courses: acadiaCourses.length,
    matchingSections: acadiaCourses.length,
  };
}
