import { eq, isNotNull, max } from "drizzle-orm";

import { getDatabase } from "@/db";
import type { Database } from "@/db";
import {
  courses,
  professorRatingPulls,
  professorRatings,
  professors,
} from "@/db/schema";
import type { CourseId, ProfessorId, RatingPullStatus } from "@/db/schema";
import {
  fetchTeacherRatings,
  searchTeachersBySchoolId,
} from "@/server/rmp/extractor";
import type { RmpRating } from "@/server/rmp/extractor";

import type { ImportProgress } from "./progress";

/**
 * `ratings` has no page-size cap — 1000 returns all 184 of the busiest Acadia
 * professor's reviews with `hasNextPage: false` — so a backfill is one request
 * per professor.
 */
const FULL_PAGE_SIZE = 1000;

/**
 * Once a high-water mark exists, a pull only has to reach reviews already held.
 * Acadia professors average 20 reviews in total, so 30 all but guarantees a
 * single small request.
 */
const INCREMENTAL_PAGE_SIZE = 30;

/**
 * No real profile comes close, so exhausting this means a cursor that never
 * terminates. `collectRatings` throws rather than returning what it has.
 */
const MAX_PAGES = 50;

type FetchTeacherRatings = typeof fetchTeacherRatings;
type SearchTeachers = typeof searchTeachersBySchoolId;

export interface ProfessorPullReport {
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly fetched: number;
  readonly highWaterLegacyId: number | null;
  readonly inserted: number;
  readonly linked: number;
  readonly professorId: ProfessorId;
  readonly professorName: string;
  readonly reportedCount: number | null;
  readonly requests: number;
  readonly skipReason: string | null;
  readonly status: RatingPullStatus;
  readonly unlinked: number;
  readonly updated: number;
}

export interface RmpRatingsReport {
  readonly counts: Record<string, number>;
  readonly professors: readonly ProfessorPullReport[];
  /** Set when the one-shot roster request failed and skipping was disabled. */
  readonly rosterWarning: string | null;
}

export interface ImportRmpRatingsOptions {
  readonly database?: Database;
  /** Compute everything, write nothing. */
  readonly dryRun?: boolean;
  /**
   * Refetch every review of every matched professor and rewrite what is already
   * held. Ignores both the reported-count skip and the high-water mark.
   */
  readonly force?: boolean;
  readonly limit?: number;
  readonly onProgress?: (progress: ImportProgress) => void;
  readonly runId?: string;
  /** Injection points for tests; both default to the live RMP client. */
  readonly fetchRatings?: FetchTeacherRatings;
  readonly searchTeachers?: SearchTeachers;
}

interface MatchedProfessor {
  readonly id: ProfessorId;
  readonly name: string;
  readonly rmpId: string;
}

interface CollectedRatings {
  readonly numRatings: number | null;
  readonly ratings: readonly RmpRating[];
  readonly requests: number;
}

interface WriteCounts {
  readonly inserted: number;
  readonly linked: number;
  readonly unlinked: number;
  readonly updated: number;
}

async function loadMatchedProfessors(
  database: Database,
  limit: number | undefined
): Promise<MatchedProfessor[]> {
  const rows = await database
    .select({
      id: professors.id,
      name: professors.name,
      rmpId: professors.rmpId,
    })
    .from(professors)
    .where(isNotNull(professors.rmpId))
    .orderBy(professors.name);

  const matched = rows.flatMap((row) =>
    // `isNotNull` narrows the rows but not the column's type.
    row.rmpId === null ? [] : [{ id: row.id, name: row.name, rmpId: row.rmpId }]
  );

  return limit === undefined ? matched : matched.slice(0, limit);
}

/**
 * Derived from the reviews themselves rather than read back from
 * `professor_rating_pulls`, so it stays correct on a fresh checkout where the
 * pull table is empty but a snapshot or an earlier run left reviews behind.
 */
async function loadHighWaterMarks(database: Database) {
  const rows = await database
    .select({
      highWater: max(professorRatings.rmpLegacyId),
      professorId: professorRatings.professorId,
    })
    .from(professorRatings)
    .groupBy(professorRatings.professorId);

  return new Map(rows.map((row) => [row.professorId, row.highWater]));
}

async function loadReportedCounts(database: Database) {
  const rows = await database
    .select({
      professorId: professorRatingPulls.professorId,
      reportedCount: professorRatingPulls.reportedCount,
      status: professorRatingPulls.status,
    })
    .from(professorRatingPulls);

  return new Map(rows.map((row) => [row.professorId, row]));
}

async function loadCourseIdsByCode(database: Database) {
  const rows = await database
    .select({ code: courses.code, id: courses.id })
    .from(courses);

  return new Map(rows.map((row) => [row.code, row.id]));
}

async function loadReportedRatingCounts(searchTeachers: SearchTeachers) {
  const result = await searchTeachers();

  if (result.isErr()) {
    return {
      byRmpId: new Map<string, number>(),
      warning: result.error.message,
    };
  }

  return {
    byRmpId: new Map(
      result.value.map((teacher) => [teacher.id, teacher.numRatings])
    ),
    warning: null,
  };
}

/**
 * Walks pages newest-first and stops at the first review already held. `force`
 * disables that so the whole profile is refetched and rewritten.
 */
async function collectRatings(
  fetchRatings: FetchTeacherRatings,
  teacherId: string,
  highWaterLegacyId: number | null,
  force: boolean
): Promise<CollectedRatings> {
  const incremental = !force && highWaterLegacyId !== null;
  const count = incremental ? INCREMENTAL_PAGE_SIZE : FULL_PAGE_SIZE;
  const collected: RmpRating[] = [];
  let cursor: string | undefined;
  let requests = 0;
  let numRatings: number | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Sequential on purpose: a backfill is 244 requests and should not burst.
    // oxlint-disable-next-line no-await-in-loop
    const result = await fetchRatings(teacherId, { count, cursor });

    requests += 1;

    if (result.isErr()) {
      throw new Error(result.error.message, { cause: result.error });
    }

    ({ numRatings } = result.value);

    for (const rating of result.value.ratings) {
      if (
        incremental &&
        highWaterLegacyId !== null &&
        rating.rmpLegacyId <= highWaterLegacyId
      ) {
        return { numRatings, ratings: collected, requests };
      }

      collected.push(rating);
    }

    const { endCursor, hasNextPage } = result.value;

    if (!hasNextPage || endCursor === null) {
      return { numRatings, ratings: collected, requests };
    }

    cursor = endCursor;
  }

  /**
   * Unreachable for any real profile — 50 pages is far more than RMP holds for
   * anyone — but returning a partial list here would be worse than failing. The
   * high-water mark is the newest id held, so writing the newest few thousand
   * reviews while never reaching the older ones would leave a gap that no later
   * run could ever notice, let alone fill.
   */
  throw new Error(
    `Rate My Professors kept paginating past ${MAX_PAGES} pages for teacher ${teacherId}.`
  );
}

function toRatingRow(
  rating: RmpRating,
  professorId: ProfessorId,
  courseId: CourseId | null,
  importedAt: Date
): typeof professorRatings.$inferInsert {
  return {
    attendanceRequired: rating.attendanceRequired,
    clarity: rating.clarity,
    comment: rating.comment,
    courseCode: rating.courseCode,
    courseCodeRaw: rating.courseCodeRaw,
    courseId,
    difficulty: rating.difficulty,
    gradeReceived: rating.gradeReceived,
    helpful: rating.helpful,
    id: rating.rmpId,
    importedAt,
    isForCredit: rating.isForCredit,
    postedAt: rating.postedAt,
    professorId,
    quality: rating.quality,
    rmpLegacyId: rating.rmpLegacyId,
    tags: rating.tags,
    textbookUse: rating.textbookUse,
    thumbsDownTotal: rating.thumbsDownTotal,
    thumbsUpTotal: rating.thumbsUpTotal,
    wouldTakeAgain: rating.wouldTakeAgain,
  };
}

/**
 * Thumbs counts move and comments can be edited, so a review seen again is
 * rewritten rather than ignored. `id`, `rmpLegacyId`, and `professorId` are the
 * identity of the row and are deliberately not in the update set.
 */
function updateSetFor(row: typeof professorRatings.$inferInsert) {
  const {
    id: _id,
    rmpLegacyId: _legacy,
    professorId: _professor,
    ...mutable
  } = row;

  return mutable;
}

function persistRatings(
  database: Database,
  professorId: ProfessorId,
  ratings: readonly RmpRating[],
  courseIdByCode: ReadonlyMap<string, CourseId>,
  importedAt: Date,
  dryRun: boolean
): WriteCounts {
  const existingIds = new Set(
    database
      .select({ id: professorRatings.id })
      .from(professorRatings)
      .where(eq(professorRatings.professorId, professorId))
      .all()
      .map((row) => row.id)
  );

  const rows = ratings.map((rating) =>
    toRatingRow(
      rating,
      professorId,
      rating.courseCode === null
        ? null
        : (courseIdByCode.get(rating.courseCode) ?? null),
      importedAt
    )
  );

  const counts = {
    inserted: rows.filter((row) => !existingIds.has(row.id)).length,
    linked: rows.filter((row) => row.courseId !== null).length,
    unlinked: rows.filter((row) => row.courseId === null).length,
    updated: rows.filter((row) => existingIds.has(row.id)).length,
  };

  if (dryRun || rows.length === 0) {
    return counts;
  }

  database.transaction((transaction) => {
    for (const row of rows) {
      transaction
        .insert(professorRatings)
        .values(row)
        .onConflictDoUpdate({
          set: updateSetFor(row),
          target: professorRatings.id,
        })
        .run();
    }
  });

  return counts;
}

interface PullContext {
  readonly courseIdByCode: ReadonlyMap<string, CourseId>;
  readonly database: Database;
  readonly dryRun: boolean;
  readonly fetchRatings: FetchTeacherRatings;
  readonly force: boolean;
  readonly highWaterMarks: ReadonlyMap<string, number | null>;
  readonly previousPulls: ReadonlyMap<
    string,
    { reportedCount: number | null; status: RatingPullStatus }
  >;
  readonly reportedByRmpId: ReadonlyMap<string, number>;
  readonly runId: string | null;
}

/**
 * RMP's `numRatings` is approximate — it ran one behind the nodes actually
 * returned for 5 of 40 sampled professors — so it is never compared against how
 * many reviews are held locally. Comparing it against the value seen at the last
 * pull is like for like, and an unmoved count means nothing was posted.
 */
function skipReasonFor(
  professor: MatchedProfessor,
  context: PullContext
): string | null {
  if (context.force) {
    return null;
  }

  const previous = context.previousPulls.get(professor.id);
  const reported = context.reportedByRmpId.get(professor.rmpId);

  if (
    previous === undefined ||
    previous.status === "failed" ||
    previous.reportedCount === null ||
    reported === undefined ||
    reported !== previous.reportedCount
  ) {
    return null;
  }

  return `RMP still reports ${reported} reviews, unchanged since the last pull.`;
}

function emptyCounts(): WriteCounts {
  return { inserted: 0, linked: 0, unlinked: 0, updated: 0 };
}

async function pullProfessor(
  professor: MatchedProfessor,
  context: PullContext
): Promise<ProfessorPullReport> {
  const startedAt = Date.now();
  const base = {
    professorId: professor.id,
    professorName: professor.name,
  };
  const highWaterLegacyId = context.highWaterMarks.get(professor.id) ?? null;
  const skipReason = skipReasonFor(professor, context);

  if (skipReason !== null) {
    return {
      ...base,
      ...emptyCounts(),
      durationMs: Date.now() - startedAt,
      errorMessage: null,
      fetched: 0,
      highWaterLegacyId,
      reportedCount: context.reportedByRmpId.get(professor.rmpId) ?? null,
      requests: 0,
      skipReason,
      status: "skipped",
    };
  }

  const collected = await collectRatings(
    context.fetchRatings,
    professor.rmpId,
    highWaterLegacyId,
    context.force
  );
  const written = persistRatings(
    context.database,
    professor.id,
    collected.ratings,
    context.courseIdByCode,
    new Date(),
    context.dryRun
  );
  const newestSeen = collected.ratings.at(0)?.rmpLegacyId ?? null;

  return {
    ...base,
    ...written,
    durationMs: Date.now() - startedAt,
    errorMessage: null,
    fetched: collected.ratings.length,
    highWaterLegacyId:
      newestSeen === null
        ? highWaterLegacyId
        : Math.max(highWaterLegacyId ?? newestSeen, newestSeen),
    reportedCount:
      collected.numRatings ??
      context.reportedByRmpId.get(professor.rmpId) ??
      null,
    requests: collected.requests,
    skipReason: null,
    status: "succeeded",
  };
}

function recordPull(
  database: Database,
  report: ProfessorPullReport,
  runId: string | null,
  startedAt: Date,
  finishedAt: Date
) {
  const row = {
    durationMs: report.durationMs,
    errorMessage: report.errorMessage,
    fetched: report.fetched,
    finishedAt,
    highWaterLegacyId: report.highWaterLegacyId,
    inserted: report.inserted,
    linked: report.linked,
    professorId: report.professorId,
    reportedCount: report.reportedCount,
    requests: report.requests,
    runId,
    skipReason: report.skipReason,
    startedAt,
    status: report.status,
    unlinked: report.unlinked,
    updated: report.updated,
  };

  const { professorId: _professorId, ...mutable } = row;

  database
    .insert(professorRatingPulls)
    .values(row)
    .onConflictDoUpdate({
      set: mutable,
      target: professorRatingPulls.professorId,
    })
    .run();
}

function rollUp(reports: readonly ProfessorPullReport[]) {
  const counts = {
    professors: reports.length,
    professorsPulled: 0,
    professorsSkipped: 0,
    professorsFailed: 0,
    requests: 0,
    ratingsFetched: 0,
    ratingsInserted: 0,
    ratingsUpdated: 0,
    ratingsLinked: 0,
    ratingsUnlinked: 0,
    /** Summed across professors, so not wall clock; the run row has that. */
    pullDurationMs: 0,
  };

  for (const report of reports) {
    counts.professorsPulled += report.status === "succeeded" ? 1 : 0;
    counts.professorsSkipped += report.status === "skipped" ? 1 : 0;
    counts.professorsFailed += report.status === "failed" ? 1 : 0;
    counts.requests += report.requests;
    counts.ratingsFetched += report.fetched;
    counts.ratingsInserted += report.inserted;
    counts.ratingsUpdated += report.updated;
    counts.ratingsLinked += report.linked;
    counts.ratingsUnlinked += report.unlinked;
    counts.pullDurationMs += report.durationMs;
  }

  return counts;
}

function failureReport(
  professor: MatchedProfessor,
  highWaterLegacyId: number | null,
  error: unknown,
  durationMs: number
): ProfessorPullReport {
  return {
    ...emptyCounts(),
    durationMs,
    errorMessage: error instanceof Error ? error.message : String(error),
    fetched: 0,
    highWaterLegacyId,
    professorId: professor.id,
    professorName: professor.name,
    reportedCount: null,
    requests: 0,
    skipReason: null,
    status: "failed",
  };
}

async function buildContext(
  options: ImportRmpRatingsOptions,
  database: Database
) {
  const {
    dryRun = false,
    fetchRatings = fetchTeacherRatings,
    force = false,
    runId,
    searchTeachers = searchTeachersBySchoolId,
  } = options;

  // One request covers all 568 Acadia teachers, so the cheap "has anything been
  // posted?" check costs a single round trip for the whole run. A failure here
  // is not fatal: it only means nothing gets skipped.
  const reported = await loadReportedRatingCounts(searchTeachers);

  const context: PullContext = {
    courseIdByCode: await loadCourseIdsByCode(database),
    database,
    dryRun,
    fetchRatings,
    force,
    highWaterMarks: await loadHighWaterMarks(database),
    previousPulls: await loadReportedCounts(database),
    reportedByRmpId: reported.byRmpId,
    runId: runId ?? null,
  };

  return { context, rosterWarning: reported.warning };
}

/**
 * Imports Rate My Professors reviews for every professor already linked to an
 * RMP profile.
 *
 * One professor failing never aborts the run: the failure is recorded against
 * that professor and the loop continues, so a partial run still leaves a row per
 * professor saying what happened. The run as a whole only throws when every
 * professor failed, which is the one case where "succeeded" would be a lie.
 */
export async function importRmpRatings(
  options: ImportRmpRatingsOptions = {}
): Promise<RmpRatingsReport> {
  const database = options.database ?? getDatabase();
  const { context, rosterWarning } = await buildContext(options, database);
  const matched = await loadMatchedProfessors(database, options.limit);
  const reports: ProfessorPullReport[] = [];

  for (const professor of matched) {
    const startedAt = new Date();
    let report: ProfessorPullReport;

    try {
      // Sequential on purpose; see `collectRatings`.
      // oxlint-disable-next-line no-await-in-loop
      report = await pullProfessor(professor, context);
    } catch (error) {
      report = failureReport(
        professor,
        context.highWaterMarks.get(professor.id) ?? null,
        error,
        Date.now() - startedAt.getTime()
      );
    }

    reports.push(report);

    if (!context.dryRun) {
      recordPull(database, report, context.runId, startedAt, new Date());
    }

    options.onProgress?.({
      completed: reports.length,
      total: matched.length,
      unit: "professors",
    });
  }

  const counts = rollUp(reports);

  if (matched.length > 0 && counts.professorsFailed === matched.length) {
    throw new Error(
      `All ${matched.length} professors failed. First error: ${reports[0]?.errorMessage ?? "unknown"}`
    );
  }

  return { counts, professors: reports, rosterWarning };
}
