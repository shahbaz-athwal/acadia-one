// oxlint-disable typescript/no-unsafe-type-assertion
import { expect, test } from "bun:test";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { errAsync, okAsync } from "neverthrow";

import {
  courses,
  professorRatingPulls,
  professorRatings,
  professors,
} from "@/db/schema";
import type { CourseId, ProfessorId } from "@/db/schema";
import type { RmpRating, RmpRatingsPage } from "@/server/rmp/extractor";

import { migratedClient } from "../../../test/apply-migrations";
import { importRmpRatings } from "./rmp-ratings";
import type { ImportRmpRatingsOptions } from "./rmp-ratings";

const ADA = "professor-ada" as ProfessorId;
const GRACE = "professor-grace" as ProfessorId;

function createTestDatabase() {
  const database = drizzle({ client: migratedClient(), jit: true });

  // `departments` is populated by the migrations themselves, so COMP is already there.
  database
    .insert(courses)
    .values({
      academicLevel: 1,
      code: "COMP-1113",
      credits: 3,
      departmentPrefix: "COMP",
      id: "course-comp-1113" as CourseId,
      isLab: false,
      title: "Intro",
    })
    .run();
  database
    .insert(professors)
    .values([
      { id: ADA, name: "Ada Lovelace", rmpId: "rmp-ada", rmpLegacyId: 1 },
      { id: GRACE, name: "Grace Hopper", rmpId: "rmp-grace", rmpLegacyId: 2 },
      // Unmatched, so it must never be fetched.
      { id: "professor-alan" as ProfessorId, name: "Alan Turing" },
    ])
    .run();

  return database;
}

function rating(legacyId: number, courseCodeRaw: string | null): RmpRating {
  return {
    attendanceRequired: true,
    clarity: 4,
    comment: "A comment.",
    courseCode:
      courseCodeRaw === null || !/\d/u.test(courseCodeRaw)
        ? null
        : courseCodeRaw.replace(/^(?<subject>[A-Za-z]+)/u, "$<subject>-"),
    courseCodeRaw,
    difficulty: 3,
    gradeReceived: "A",
    helpful: 5,
    isForCredit: true,
    postedAt: new Date(legacyId * 1000),
    quality: 4.5,
    rmpId: `rating-${legacyId}`,
    rmpLegacyId: legacyId,
    tags: ["Tough grader"],
    textbookUse: 3,
    thumbsDownTotal: 0,
    thumbsUpTotal: 1,
    wouldTakeAgain: true,
  };
}

type FetchRatings = NonNullable<ImportRmpRatingsOptions["fetchRatings"]>;
type SearchTeachers = NonNullable<ImportRmpRatingsOptions["searchTeachers"]>;

interface FetchCall {
  readonly count: number;
  readonly cursor: string | undefined;
  readonly teacherId: string;
}

interface FakeRmp {
  readonly calls: FetchCall[];
  readonly fetchRatings: FetchRatings;
  readonly searchTeachers: SearchTeachers;
}

/** Serves newest-first pages out of a fixed list, the way RMP does. */
function fakeRmp(
  byTeacher: Record<string, RmpRating[]>,
  reportedOverrides: Record<string, number> = {}
): FakeRmp {
  const calls: FetchCall[] = [];

  return {
    calls,
    fetchRatings: (teacherId, { count, cursor }) => {
      calls.push({ count, cursor, teacherId });

      const all = byTeacher[teacherId] ?? [];
      const offset = cursor === undefined ? 0 : Number.parseInt(cursor, 10);
      const page = all.slice(offset, offset + count);
      const nextOffset = offset + page.length;

      return okAsync({
        endCursor: String(nextOffset),
        hasNextPage: nextOffset < all.length,
        numRatings: reportedOverrides[teacherId] ?? all.length,
        ratings: page,
      } satisfies RmpRatingsPage);
    },
    searchTeachers: () =>
      okAsync(
        Object.entries(byTeacher).map(([id, ratings]) => ({
          department: "Computing",
          firstName: "T",
          id,
          lastName: "T",
          legacyId: 1,
          numRatings: reportedOverrides[id] ?? ratings.length,
        }))
      ),
  };
}

test("imports reviews and links the ones whose course code resolves", async () => {
  const database = createTestDatabase();
  const rmp = fakeRmp({
    "rmp-ada": [
      rating(300, "COMP1113"),
      rating(200, "HISTORY"),
      rating(100, "PYSC2143"),
    ],
    "rmp-grace": [],
  });

  const report = await importRmpRatings({
    database,
    fetchRatings: rmp.fetchRatings,
    searchTeachers: rmp.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    professors: 2,
    professorsPulled: 2,
    professorsFailed: 0,
    ratingsFetched: 3,
    ratingsInserted: 3,
    ratingsLinked: 1,
    ratingsUnlinked: 2,
  });

  const stored = database.select().from(professorRatings).all();

  expect(stored).toHaveLength(3);

  // The whole point of the nullable link: the two unresolvable codes survive.
  expect(stored.filter((row) => row.courseId === null)).toHaveLength(2);
  expect(stored.find((row) => row.rmpLegacyId === 200)).toMatchObject({
    courseCode: null,
    courseCodeRaw: "HISTORY",
    courseId: null,
  });
  expect(stored.find((row) => row.rmpLegacyId === 100)).toMatchObject({
    courseCode: "PYSC-2143",
    courseId: null,
  });
  expect(stored.find((row) => row.rmpLegacyId === 300)?.courseId).toBe(
    "course-comp-1113" as CourseId
  );

  // Never fetched for the professor with no RMP link.
  expect(new Set(rmp.calls.map((call) => call.teacherId))).toEqual(
    new Set(["rmp-ada", "rmp-grace"])
  );
});

test("skips a professor whose reported review count has not moved", async () => {
  const database = createTestDatabase();
  const first = fakeRmp({
    "rmp-ada": [rating(300, "COMP1113")],
    "rmp-grace": [],
  });

  await importRmpRatings({
    database,
    fetchRatings: first.fetchRatings,
    searchTeachers: first.searchTeachers,
  });

  const second = fakeRmp({
    "rmp-ada": [rating(300, "COMP1113")],
    "rmp-grace": [],
  });
  const report = await importRmpRatings({
    database,
    fetchRatings: second.fetchRatings,
    searchTeachers: second.searchTeachers,
  });

  expect(second.calls).toHaveLength(0);
  expect(report.counts).toMatchObject({
    professorsPulled: 0,
    professorsSkipped: 2,
    ratingsFetched: 0,
    requests: 0,
  });
  expect(report.professors[0]?.skipReason).toContain(
    "unchanged since the last pull"
  );
});

test("fetches only past the high-water mark when new reviews appear", async () => {
  const database = createTestDatabase();
  const existing = [rating(300, "COMP1113"), rating(200, "COMP1113")];

  await importRmpRatings({
    database,
    ...fakeRmp({ "rmp-ada": existing, "rmp-grace": [] }),
  });

  const grown = [rating(500, "COMP1113"), rating(400, "COMP1113"), ...existing];
  const second = fakeRmp({ "rmp-ada": grown, "rmp-grace": [] });
  const report = await importRmpRatings({
    database,
    fetchRatings: second.fetchRatings,
    searchTeachers: second.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    ratingsFetched: 2,
    ratingsInserted: 2,
    ratingsUpdated: 0,
  });
  expect(database.select().from(professorRatings).all()).toHaveLength(4);

  // A small page, because a high-water mark existed. Grace was skipped outright.
  expect(second.calls).toEqual([
    { count: 30, cursor: undefined, teacherId: "rmp-ada" },
  ]);
});

test("walks pages until it reaches a review it already has", async () => {
  const database = createTestDatabase();
  const existing = [rating(100, "COMP1113")];

  await importRmpRatings({ database, ...fakeRmp({ "rmp-ada": existing }) });

  // 45 new reviews is more than one incremental page of 30.
  const fresh = Array.from({ length: 45 }, (_, index) =>
    rating(1000 - index, "COMP1113")
  );
  const second = fakeRmp({ "rmp-ada": [...fresh, ...existing] });

  const report = await importRmpRatings({
    database,
    fetchRatings: second.fetchRatings,
    searchTeachers: second.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    ratingsFetched: 45,
    ratingsInserted: 45,
  });
  // Two pages of 30, stopping mid-page on a review already held rather than
  // paging to the end of the profile.
  expect(
    second.calls.filter((call) => call.teacherId === "rmp-ada")
  ).toHaveLength(2);
  expect(report.professors[0]?.requests).toBe(2);
});

test("force refetches everything and rewrites it in place", async () => {
  const database = createTestDatabase();
  const all = [rating(300, "COMP1113"), rating(200, "COMP1113")];

  await importRmpRatings({ database, ...fakeRmp({ "rmp-ada": all }) });

  const second = fakeRmp({ "rmp-ada": all });
  const report = await importRmpRatings({
    database,
    fetchRatings: second.fetchRatings,
    force: true,
    searchTeachers: second.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    ratingsFetched: 2,
    ratingsInserted: 0,
    ratingsUpdated: 2,
  });
  expect(database.select().from(professorRatings).all()).toHaveLength(2);
  expect(second.calls[0]?.count).toBe(1000);
});

test("keeps going when one professor fails and records why", async () => {
  const database = createTestDatabase();
  const working = fakeRmp({ "rmp-grace": [rating(300, "COMP1113")] });

  const report = await importRmpRatings({
    database,
    fetchRatings: (teacherId, options) =>
      teacherId === "rmp-ada"
        ? errAsync({
            message: "Rate My Professors returned GraphQL errors.",
            operation: "fetchTeacherRatings",
            source: "rmp" as const,
            type: "graphql_failure" as const,
          })
        : working.fetchRatings(teacherId, options),
    searchTeachers: working.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    professorsFailed: 1,
    professorsPulled: 1,
    ratingsInserted: 1,
  });

  const pulls = database.select().from(professorRatingPulls).all();
  const ada = pulls.find((pull) => pull.professorId === ADA);

  expect(ada?.status).toBe("failed");
  expect(ada?.errorMessage).toContain("GraphQL errors");
  expect(pulls.find((pull) => pull.professorId === GRACE)?.status).toBe(
    "succeeded"
  );
});

test("throws only when every professor failed", async () => {
  const database = createTestDatabase();

  let thrown: unknown;

  try {
    await importRmpRatings({
      database,
      fetchRatings: () =>
        errAsync({
          message: "Unable to reach Rate My Professors: down",
          operation: "fetchTeacherRatings",
          source: "rmp" as const,
          type: "network_failure" as const,
        }),
      searchTeachers: fakeRmp({}).searchTeachers,
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toContain("All 2 professors failed");

  // The partial record still stands: both professors have a failed pull row.
  const pulls = database.select().from(professorRatingPulls).all();

  expect(pulls.filter((pull) => pull.status === "failed")).toHaveLength(2);
});

test("still imports when the roster lookup fails, skipping nothing", async () => {
  const database = createTestDatabase();
  const rmp = fakeRmp({
    "rmp-ada": [rating(300, "COMP1113")],
    "rmp-grace": [],
  });

  const report = await importRmpRatings({
    database,
    fetchRatings: rmp.fetchRatings,
    searchTeachers: () =>
      errAsync({
        message: "Rate My Professors returned an unexpected response shape.",
        operation: "searchTeachersBySchoolId",
        source: "rmp" as const,
        type: "response_validation_failure" as const,
      }),
  });

  expect(report.rosterWarning).toContain("unexpected response shape");
  expect(report.counts).toMatchObject({
    professorsSkipped: 0,
    ratingsInserted: 1,
  });
});

test("writes nothing on a dry run but still reports what it would do", async () => {
  const database = createTestDatabase();

  const report = await importRmpRatings({
    database,
    dryRun: true,
    ...fakeRmp({ "rmp-ada": [rating(300, "COMP1113")] }),
  });

  expect(report.counts).toMatchObject({ ratingsInserted: 1, ratingsLinked: 1 });
  expect(database.select().from(professorRatings).all()).toHaveLength(0);
  expect(database.select().from(professorRatingPulls).all()).toHaveLength(0);
});

test("records per-professor observability for the last pull", async () => {
  const database = createTestDatabase();

  await importRmpRatings({
    database,
    runId: "run-1",
    ...fakeRmp({
      "rmp-ada": [rating(300, "COMP1113"), rating(200, "HISTORY")],
    }),
  });

  const [pull] = database.select().from(professorRatingPulls).all();

  expect(pull).toMatchObject({
    fetched: 2,
    highWaterLegacyId: 300,
    inserted: 2,
    linked: 1,
    professorId: ADA,
    reportedCount: 2,
    requests: 1,
    runId: "run-1",
    status: "succeeded",
    unlinked: 1,
    updated: 0,
  });
  expect(pull?.durationMs).toBeGreaterThanOrEqual(0);
});

/**
 * A partial list here would insert the newest reviews and move the high-water
 * mark past reviews that were never fetched, leaving a gap no later run could
 * detect. Failing the professor keeps the gap from ever being written.
 */
test("fails a professor rather than writing a partial history", async () => {
  const database = createTestDatabase();
  const working = fakeRmp({ "rmp-grace": [rating(300, "COMP1113")] });

  const report = await importRmpRatings({
    database,
    // Always another page, never a review already held: the guard's exact case.
    fetchRatings: (teacherId, options) =>
      teacherId === "rmp-ada"
        ? okAsync({
            endCursor: "next",
            hasNextPage: true,
            numRatings: 100_000,
            ratings: [rating(1, "COMP1113")],
          } satisfies RmpRatingsPage)
        : working.fetchRatings(teacherId, options),
    searchTeachers: working.searchTeachers,
  });

  expect(report.counts).toMatchObject({
    professorsFailed: 1,
    professorsPulled: 1,
    ratingsInserted: 1,
  });

  const ada = report.professors.find((entry) => entry.professorId === ADA);

  expect(ada?.errorMessage).toContain("kept paginating past");
  // Nothing of Ada's was written, so no gap was recorded.
  expect(
    database
      .select()
      .from(professorRatings)
      .all()
      .map((row) => row.professorId)
  ).toEqual([GRACE]);
});
