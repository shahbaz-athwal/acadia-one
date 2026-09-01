// oxlint-disable typescript/no-unsafe-type-assertion
import { afterEach, expect, test } from "bun:test";

import { fetchTeacherRatings } from "./extractor";

const originalFetch = globalThis.fetch;

/**
 * `typeof fetch` carries statics (`preconnect`) a bare handler cannot supply,
 * hence the cast. ofetch awaits whatever this returns, so handing back the
 * `Response` itself rather than a promise is enough.
 */
function stubJsonResponse(body: unknown) {
  const handler = () => Response.json(body);

  globalThis.fetch = handler as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** A real node sampled from the live API, minus the parts under test. */
function ratingNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "UmF0aW5nLTQyNDg1NjE2",
    legacyId: 42_485_616,
    date: "2026-01-13 02:12:26 +0000 UTC",
    class: "COMM1213",
    helpfulRating: 2,
    clarityRating: 3,
    difficultyRating: 5,
    comment: "Tough grader.",
    attendanceMandatory: "mandatory",
    wouldTakeAgain: 1,
    grade: "A",
    textbookUse: 3,
    isForCredit: true,
    thumbsUpTotal: 4,
    thumbsDownTotal: 1,
    ratingTags: "Tough grader--Participation matters",
    ...overrides,
  };
}

function stubRatingsResponse(nodes: Record<string, unknown>[]) {
  stubJsonResponse({
    data: {
      node: {
        __typename: "Teacher",
        id: "VGVhY2hlci00MDE5Nw==",
        legacyId: 40_197,
        numRatings: nodes.length,
        ratings: {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
  });
}

async function fetchOne(overrides: Record<string, unknown> = {}) {
  stubRatingsResponse([ratingNode(overrides)]);

  const result = await fetchTeacherRatings("teacher", { count: 10 });

  if (result.isErr()) {
    throw new Error(result.error.message);
  }

  const [rating] = result.value.ratings;

  if (rating === undefined) {
    throw new Error("expected a rating");
  }

  return rating;
}

test("maps a rating node onto the stored shape", async () => {
  const rating = await fetchOne();

  expect(rating).toMatchObject({
    attendanceRequired: true,
    clarity: 3,
    comment: "Tough grader.",
    courseCode: "COMM-1213",
    courseCodeRaw: "COMM1213",
    difficulty: 5,
    gradeReceived: "A",
    helpful: 2,
    isForCredit: true,
    rmpId: "UmF0aW5nLTQyNDg1NjE2",
    rmpLegacyId: 42_485_616,
    tags: ["Tough grader", "Participation matters"],
    textbookUse: 3,
    thumbsDownTotal: 1,
    thumbsUpTotal: 4,
    wouldTakeAgain: true,
  });
  expect(rating.postedAt.toISOString()).toBe("2026-01-13T02:12:26.000Z");
});

/** Rounding the mean of two integers would collapse a real half-point. */
test("keeps quality at half-point precision", async () => {
  const rating = await fetchOne({ clarityRating: 3, helpfulRating: 2 });

  expect(rating.quality).toBe(2.5);
});

test("reads all three spellings of the attendance answer", async () => {
  for (const [value, expected] of [
    ["mandatory", true],
    ["Y", true],
    ["non mandatory", false],
    ["N", false],
  ] as const) {
    // oxlint-disable-next-line no-await-in-loop
    const rating = await fetchOne({ attendanceMandatory: value });

    expect(rating.attendanceRequired).toBe(expected);
  }
});

/**
 * The previous implementation read `attendanceMandatory === "mandatory"`, which
 * turned "the student did not answer" into "attendance was optional".
 */
test("treats an unanswered attendance question as unknown", async () => {
  const rating = await fetchOne({ attendanceMandatory: "" });

  expect(rating.attendanceRequired).toBeNull();
});

test("normalises the sentinels RMP uses for an unanswered question", async () => {
  const rating = await fetchOne({
    comment: "   ",
    grade: "",
    textbookUse: -1,
    wouldTakeAgain: null,
  });

  expect(rating.comment).toBeNull();
  expect(rating.gradeReceived).toBeNull();
  expect(rating.textbookUse).toBeNull();
  expect(rating.wouldTakeAgain).toBeNull();
});

test("keeps a review whose course code does not parse", async () => {
  const rating = await fetchOne({ class: "HISTORY" });

  expect(rating.courseCode).toBeNull();
  expect(rating.courseCodeRaw).toBe("HISTORY");
});

test("falls back to legacyId when the node id is null", async () => {
  const rating = await fetchOne({ id: null });

  expect(rating.rmpId).toBe("42485616");
});

test("drops empty tags rather than storing a blank one", async () => {
  const rating = await fetchOne({ ratingTags: "" });

  expect(rating.tags).toEqual([]);
});

test("reports a removed profile as an empty page instead of an error", async () => {
  stubJsonResponse({ data: { node: null } });

  const result = await fetchTeacherRatings("gone", { count: 10 });

  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toEqual({
    endCursor: null,
    hasNextPage: false,
    numRatings: null,
    ratings: [],
  });
});
