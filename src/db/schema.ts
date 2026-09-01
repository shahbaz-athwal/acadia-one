import {
  index,
  int,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
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

/**
 * Reviews pulled from Rate My Professors.
 *
 * `courseId` is nullable on purpose, and it is the whole design of this table.
 * Students type the course code by hand on RMP, so the field is full of typos
 * (`PYSC2143`), abbreviations (`MAT1213`), bare numbers (`1223`), and subjects
 * with no number at all (`MATHSTATS`). Only 58% of sampled reviews resolve to a
 * local course. Dropping the other 42% — which is what the previous
 * implementation did — silently throws away most of a professor's feedback to
 * preserve a foreign key. Instead the review is always stored, `courseCodeRaw`
 * keeps what the student actually typed, and linking a course becomes an
 * enrichment that can be improved later rather than an import-time filter.
 *
 * Snapshotted alongside `professors` and `courses`, which is what makes the
 * foreign keys below safe: all three are deleted and reinserted together by one
 * seed, in dependency order. `courseId` is `set null` rather than `cascade` on
 * purpose — dropping a course must not destroy the reviews written about it,
 * which is the same reasoning that makes the column nullable in the first place.
 */
export const professorRatings = sqliteTable(
  "professor_ratings",
  {
    id: text().primaryKey(),
    /**
     * Monotonic with post date, which `postedAt` is not reliably (RMP sends it
     * as `2026-01-13 02:12:26 +0000 UTC`). This is the incremental high-water
     * mark: a pull stops once it reaches an id it already holds.
     */
    rmpLegacyId: int().notNull(),
    professorId: text()
      .$type<ProfessorId>()
      .notNull()
      .references(() => professors.id, { onDelete: "cascade" }),
    courseId: text()
      .$type<CourseId>()
      .references(() => courses.id, { onDelete: "set null" }),
    /** Canonical `SUBJ-1234`, or null when the raw code does not parse. */
    courseCode: text(),
    courseCodeRaw: text(),
    /** Mean of `helpful` and `clarity`; `real` because that mean lands on .5. */
    quality: real().notNull(),
    helpful: int().notNull(),
    clarity: int().notNull(),
    difficulty: int().notNull(),
    comment: text(),
    tags: text({ mode: "json" }).$type<string[]>().notNull(),
    gradeReceived: text(),
    isForCredit: int({ mode: "boolean" }),
    attendanceRequired: int({ mode: "boolean" }),
    wouldTakeAgain: int({ mode: "boolean" }),
    /** Raw 0-5 RMP value, not a boolean. See the extractor's transform. */
    textbookUse: int(),
    thumbsUpTotal: int().notNull(),
    thumbsDownTotal: int().notNull(),
    postedAt: int({ mode: "timestamp" }).notNull(),
    importedAt: int({ mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("professor_ratings_by_rmp_legacy_id").on(table.rmpLegacyId),
    // Ordered so `max(rmpLegacyId) group by professorId` — the high-water mark
    // query the whole incremental path is built on — is served by the index.
    index("professor_ratings_by_professor_id").on(
      table.professorId,
      table.rmpLegacyId
    ),
    index("professor_ratings_by_course_id").on(table.courseId),
    index("professor_ratings_by_posted_at").on(table.postedAt),
  ]
);

export const RATING_PULL_STATUSES = ["succeeded", "skipped", "failed"] as const;

export type RatingPullStatus = (typeof RATING_PULL_STATUSES)[number];

/**
 * One row per professor, rewritten on every attempt: what the last pull did,
 * how long it took, and why it did nothing when it did nothing.
 *
 * It deliberately does not gate the next pull. The high-water mark that decides
 * what to fetch is derived from `professor_ratings` itself, so it stays correct
 * even when this table is empty — which it is on any fresh checkout, since this
 * is machine-local bookkeeping and is never snapshotted. `reportedCount` is the
 * one value read back, and only as an optimisation: RMP's `numRatings` is
 * approximate, so it is compared against the previous `numRatings` rather than
 * against a row count.
 *
 * Unlike `professor_ratings` it declares no foreign key to `professors`. It is
 * not in the snapshot, so a `db:seed` that replaces the roster would leave these
 * rows pointing at nothing, and `applySnapshot` checks `foreign_key_check`
 * across the whole database — a declared reference here would turn a routine
 * re-seed into a hard failure.
 */
export const professorRatingPulls = sqliteTable(
  "professor_rating_pulls",
  {
    professorId: text().$type<ProfessorId>().primaryKey(),
    runId: text(),
    status: text().$type<RatingPullStatus>().notNull(),
    /** Set when `status` is `skipped`; prose, meant to be read in the UI. */
    skipReason: text(),
    startedAt: int({ mode: "timestamp" }).notNull(),
    finishedAt: int({ mode: "timestamp" }).notNull(),
    durationMs: int().notNull(),
    requests: int().notNull(),
    /** RMP's `numRatings` at this pull, for comparison at the next one. */
    reportedCount: int(),
    highWaterLegacyId: int(),
    fetched: int().notNull(),
    inserted: int().notNull(),
    updated: int().notNull(),
    linked: int().notNull(),
    unlinked: int().notNull(),
    errorMessage: text(),
  },
  (table) => [
    index("professor_rating_pulls_by_status").on(table.status),
    index("professor_rating_pulls_by_finished_at").on(table.finishedAt),
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
