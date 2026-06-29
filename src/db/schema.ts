// oxlint-disable sort-keys no-inline-comments
import { index, int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const terms = sqliteTable(
  "terms",
  {
    termCode: text().primaryKey(),
    name: text().notNull(),
    endDate: int({ mode: "timestamp" }).notNull(),
    startDate: int({ mode: "timestamp" }).notNull(),
    isArchived: int({ mode: "boolean" }).notNull(),
  },
  (table) => [index("terms_by_is_archived").on(table.isArchived)]
);

export const departments = sqliteTable("departments", {
  prefix: text().primaryKey(),
  name: text().notNull(),
  facultyUrl: text().notNull(),
});

export type CourseId = string & { __brand: "courseId" };
export type SectionId = string & { __brand: "sectionId" };

export const courses = sqliteTable(
  "courses",
  {
    id: text().$type<CourseId>().primaryKey(),
    code: text().notNull(), // Eg: ABCD-1234, XYZ-4567
    title: text().notNull(),
    description: text(),
    departmentPrefix: text()
      .notNull()
      .references(() => departments.prefix),
    credits: real().notNull(),
    isLab: int({ mode: "boolean" }).notNull(),
    academicLevel: int().notNull(),
    requisites: text({ mode: "json" }).$type<
      {
        codes: string[]; // displayText split by space " "
        displayText: string;
        displayTextExtension: string;
      }[]
    >(),
  },
  (table) => [
    index("courses_by_code").on(table.code),
    index("courses_by_department_prefix").on(table.departmentPrefix),
  ]
);

export const courseMatchingSections = sqliteTable(
  "course_matching_sections",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    courseId: text()
      .$type<CourseId>()
      .notNull()
      .references(() => courses.id),
    sectionIds: text({ mode: "json" }).$type<SectionId[]>().notNull(),
    timestamp: int({ mode: "timestamp" }).notNull(),
    isArchived: int({ mode: "boolean" }).notNull(),
    isImported: int({ mode: "boolean" }).notNull(),
  },
  (table) => [
    index("course_matching_sections_by_course_id").on(table.courseId),
    index("course_matching_sections_by_is_archived").on(table.isArchived),
  ]
);
