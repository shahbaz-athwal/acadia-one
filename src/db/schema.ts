// oxlint-disable sort-keys no-inline-comments
import {
  index,
  int,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const terms = sqliteTable(
  "terms",
  {
    termCode: text().primaryKey(),
    name: text().notNull(),
    endDate: int({ mode: "timestamp" }).notNull(),
    startDate: int({ mode: "timestamp" }).notNull(),
    archivedAt: int({ mode: "timestamp" }),
  },
  (table) => [index("terms_by_archived_at").on(table.archivedAt)]
);

export const departments = sqliteTable("departments", {
  prefix: text().primaryKey(),
  name: text().notNull(),
  facultyUrl: text().notNull(),
});

export type CourseId = string & { __brand: "courseId" };
export type ProfessorId = string & { __brand: "professorId" };
export type SectionId = string & { __brand: "sectionId" };

export interface ProfessorDetails {
  designation?: string | null;
  officeLocation?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  researchAreas?: string[] | null;
  sourceUrl?: string | null;
}

export const professors = sqliteTable("professors", {
  id: text().$type<ProfessorId>().primaryKey(),
  rmpId: text(),
  rmpLegacyId: int(),
  name: text().notNull(),
  imageUrl: text(),
  details: text({ mode: "json" }).$type<ProfessorDetails>(),
});

export const professorDepartments = sqliteTable(
  "professor_departments",
  {
    professorId: text()
      .$type<ProfessorId>()
      .notNull()
      .references(() => professors.id, { onDelete: "cascade" }),
    departmentPrefix: text()
      .notNull()
      .references(() => departments.prefix, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.professorId, table.departmentPrefix] }),
    index("professor_departments_by_department_prefix").on(
      table.departmentPrefix,
      table.professorId
    ),
  ]
);

export const courses = sqliteTable(
  "courses",
  {
    id: text().$type<CourseId>().primaryKey(),
    code: text().notNull(), // Eg: ABCD-1234, XYZ-4567
    title: text().notNull(),
    // Add normalized course-code and title search fields when course search is implemented.
    description: text(),
    departmentPrefix: text()
      .notNull()
      .references(() => departments.prefix),
    credits: real().notNull(),
    isLab: int({ mode: "boolean" }).notNull(),
    academicLevel: int().notNull(),
    requisites: text({ mode: "json" }).$type<
      {
        codes: string[];
        textExtension: string;
      }[]
    >(),
  },
  (table) => [
    index("courses_by_academic_level").on(table.academicLevel),
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
    importedAt: int({ mode: "timestamp" }),
    archivedAt: int({ mode: "timestamp" }),
  },
  (table) => [
    index("course_matching_sections_by_archived_at").on(table.archivedAt),
  ]
);

export const sections = sqliteTable(
  "sections",
  {
    id: text().$type<SectionId>().notNull(),
    termCode: text()
      .notNull()
      .references(() => terms.termCode),
    courseId: text()
      .$type<CourseId>()
      .notNull()
      .references(() => courses.id),
    sectionCode: text().notNull(),
    sectionSearchName: text().notNull(),
    classStart: int(), // in minutes
    classEnd: int(), // in minutes
    buildingName: text(),
    roomNumber: text(),
    room: text(),
    showTBD: int({ mode: "boolean" }).notNull(),
    days: text({ mode: "json" }).$type<number[]>().notNull(),
    isOnline: int({ mode: "boolean" }).notNull(),
  },
  (table) => [
    index("sections_by_class_times").on(table.classStart, table.classEnd),
    index("sections_by_term_code_and_class_times").on(
      table.termCode,
      table.classStart,
      table.classEnd
    ),
  ]
);

export const sectionProfessors = sqliteTable(
  "section_professors",
  {
    sectionId: text().$type<SectionId>().notNull(),
    professorId: text().$type<ProfessorId>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sectionId, table.professorId] }),
    index("section_professors_by_professor_id").on(table.professorId),
  ]
);

export const IMPORT_RUN_KINDS = [
  "courses",
  "professors",
  "sectionDetails",
] as const;

export type ImportRunKind = (typeof IMPORT_RUN_KINDS)[number];
export type ImportRunStatus = "running" | "succeeded" | "failed";
export type ImportRunTrigger = "admin-dashboard" | "script";

/**
 * The import workflows only return counts to their caller, so a partial or
 * failed run used to leave no trace. Every run writes a row here before it
 * starts and updates it when it settles.
 */
export const importRuns = sqliteTable(
  "import_runs",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: text().$type<ImportRunKind>().notNull(),
    status: text().$type<ImportRunStatus>().notNull(),
    trigger: text().$type<ImportRunTrigger>().notNull(),
    startedAt: int({ mode: "timestamp" }).notNull(),
    finishedAt: int({ mode: "timestamp" }),
    counts: text({ mode: "json" }).$type<Record<string, number>>(),
    errorMessage: text(),
  },
  (table) => [
    index("import_runs_by_started_at").on(table.startedAt),
    index("import_runs_by_status").on(table.status),
  ]
);

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export type AdminAuditDetails = Readonly<Record<string, AuditJsonValue>>;

/**
 * Admin writes are destructive and irreversible-looking from the outside (the
 * section import deletes and reinserts every section of a course), so each one
 * records what it touched with a before/after snapshot.
 */
export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    action: text().notNull(),
    target: text(),
    summary: text().notNull(),
    before: text({ mode: "json" }).$type<AdminAuditDetails>(),
    after: text({ mode: "json" }).$type<AdminAuditDetails>(),
    createdAt: int({ mode: "timestamp" }).notNull(),
  },
  (table) => [index("admin_audit_log_by_created_at").on(table.createdAt)]
);
