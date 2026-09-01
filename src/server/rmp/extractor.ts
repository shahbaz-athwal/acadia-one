import { z } from "zod";

import { parseCanonicalCourseCode } from "./course-code";
import { executeRmpQuery, RMP_ACADIA_SCHOOL_ID } from "./gql-client";

const TEACHER_SEARCH_QUERY = `
  query TeacherSearch($count: Int!, $query: TeacherSearchQuery!) {
    search: newSearch {
      teachers(query: $query, first: $count) {
        edges {
          node {
            id
            legacyId
            firstName
            lastName
            department
            numRatings
          }
        }
      }
    }
  }
`;

const RmpTeacherSchema = z.object({
  id: z.string(),
  legacyId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  department: z.string(),
  /**
   * RMP's own count of reviews on the profile. Approximate — it ran one behind
   * the number of nodes actually returned for 5 of 40 sampled professors — so it
   * is only ever compared against a previously recorded `numRatings`, never
   * against how many reviews we hold.
   */
  numRatings: z.number(),
});

export type RmpTeacher = z.infer<typeof RmpTeacherSchema>;

const TeacherSearchResponseSchema = z.object({
  search: z.object({
    teachers: z.object({
      edges: z.array(z.object({ node: RmpTeacherSchema })),
    }),
  }),
});

/**
 * RMP's search backend rejects anything above 1000 (`Size` fails an `lte`
 * validation and the whole query 500s). Acadia has ~570 teachers, so one page
 * covers the school and there is nothing to paginate.
 */
const TEACHER_PAGE_SIZE = 1000;

export function searchTeachersBySchoolId(
  schoolId: string = RMP_ACADIA_SCHOOL_ID
) {
  return executeRmpQuery(
    "searchTeachersBySchoolId",
    TEACHER_SEARCH_QUERY,
    {
      count: TEACHER_PAGE_SIZE,
      query: { text: "", schoolID: schoolId, fallback: true },
    },
    TeacherSearchResponseSchema
  ).map((data) => data.search.teachers.edges.map((edge) => edge.node));
}

const TEACHER_RATINGS_QUERY = `
  query TeacherRatings($id: ID!, $count: Int!, $cursor: String) {
    node(id: $id) {
      __typename
      ... on Teacher {
        id
        legacyId
        numRatings
        ratings(first: $count, after: $cursor) {
          edges {
            node {
              id
              legacyId
              date
              class
              helpfulRating
              clarityRating
              difficultyRating
              comment
              attendanceMandatory
              wouldTakeAgain
              grade
              textbookUse
              isForCredit
              thumbsUpTotal
              thumbsDownTotal
              ratingTags
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

/**
 * RMP writes "not answered" as a sentinel inside the value rather than as null,
 * and the sentinel differs per field. `textbookUse` uses -1; `grade` and
 * `attendanceMandatory` use the empty string.
 */
const NOT_ANSWERED_TEXTBOOK_USE = -1;

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

/**
 * Three spellings of the same answer, from different eras of the RMP form. Any
 * other value — including the empty string — means the student did not answer,
 * which is not the same as "attendance was optional".
 */
function parseAttendanceRequired(value: string | null): boolean | null {
  switch (value?.trim().toLowerCase() ?? "") {
    case "mandatory":
    case "y": {
      return true;
    }
    case "non mandatory":
    case "n": {
      return false;
    }
    default: {
      return null;
    }
  }
}

/** 1 and 0 are the only answers; null and anything else mean "not answered". */
function parseTriState(value: number | null): boolean | null {
  if (value === 1) {
    return true;
  }

  return value === 0 ? false : null;
}

function parsePostedAt(value: string): Date {
  // `2026-01-13 02:12:26 +0000 UTC` — not ISO 8601, and only parses because V8
  // is lenient, so the result is checked rather than trusted.
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Unparseable rating date: ${value}`);
  }

  return date;
}

const QUALITY_COMPONENTS = 2;

const RatingNodeSchema = z
  .object({
    id: z.string().nullable(),
    legacyId: z.number(),
    date: z.string(),
    class: z.string().nullable(),
    helpfulRating: z.number(),
    clarityRating: z.number(),
    difficultyRating: z.number(),
    comment: z.string().nullable(),
    attendanceMandatory: z.string().nullable(),
    wouldTakeAgain: z.number().nullable(),
    grade: z.string().nullable(),
    textbookUse: z.number().nullable(),
    isForCredit: z.boolean().nullable(),
    thumbsUpTotal: z.number(),
    thumbsDownTotal: z.number(),
    ratingTags: z.string(),
  })
  .transform((raw) => ({
    // `id` has been non-null on every rating sampled, but the field is nullable
    // in RMP's schema and `legacyId` is not, so it can always stand in.
    rmpId: raw.id ?? String(raw.legacyId),
    rmpLegacyId: raw.legacyId,
    /**
     * RMP shows one "quality" number, the mean of the two component scores.
     * Deliberately not rounded: the components are integers, so the mean lands
     * on a half and rounding would throw away a real distinction for nothing.
     */
    quality: (raw.helpfulRating + raw.clarityRating) / QUALITY_COMPONENTS,
    helpful: raw.helpfulRating,
    clarity: raw.clarityRating,
    difficulty: raw.difficultyRating,
    isForCredit: raw.isForCredit,
    comment: blankToNull(raw.comment),
    /**
     * Kept as the raw integer. It looks boolean but is not: the sampled values
     * are null, -1, and 0 through 5, which is two eras of the RMP form sharing a
     * column. Collapsing that to a boolean would be inventing an answer.
     */
    textbookUse:
      raw.textbookUse === NOT_ANSWERED_TEXTBOOK_USE ? null : raw.textbookUse,
    attendanceRequired: parseAttendanceRequired(raw.attendanceMandatory),
    gradeReceived: blankToNull(raw.grade),
    wouldTakeAgain: parseTriState(raw.wouldTakeAgain),
    thumbsUpTotal: raw.thumbsUpTotal,
    thumbsDownTotal: raw.thumbsDownTotal,
    tags: raw.ratingTags.split("--").filter((tag) => tag.trim().length > 0),
    courseCodeRaw: blankToNull(raw.class),
    courseCode: parseCanonicalCourseCode(raw.class),
    postedAt: parsePostedAt(raw.date),
  }));

export type RmpRating = z.infer<typeof RatingNodeSchema>;

const TeacherRatingsResponseSchema = z.object({
  node: z
    .object({
      __typename: z.literal("Teacher"),
      id: z.string(),
      legacyId: z.number(),
      numRatings: z.number(),
      ratings: z.object({
        edges: z.array(z.object({ node: RatingNodeSchema })),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          endCursor: z.string().nullable(),
        }),
      }),
    })
    // A profile RMP has removed resolves to a null node rather than an error.
    .nullable(),
});

export interface RmpRatingsPage {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  /** Null when RMP no longer has a profile under this id. */
  readonly numRatings: number | null;
  /** Newest first. RMP orders by recency and `legacyId` follows date. */
  readonly ratings: readonly RmpRating[];
}

/**
 * There is no page-size cap on `ratings` — `first: 1000` returns all 184 of the
 * busiest Acadia professor's reviews with `hasNextPage: false` — so a backfill
 * is one request per professor. The cursor exists for the incremental case,
 * where a small page is usually enough to reach reviews already held.
 */
export function fetchTeacherRatings(
  teacherId: string,
  { count, cursor }: { count: number; cursor?: string }
) {
  return executeRmpQuery(
    "fetchTeacherRatings",
    TEACHER_RATINGS_QUERY,
    { count, cursor: cursor ?? null, id: teacherId },
    TeacherRatingsResponseSchema
  ).map((data): RmpRatingsPage => {
    if (data.node === null) {
      return {
        endCursor: null,
        hasNextPage: false,
        numRatings: null,
        ratings: [],
      };
    }

    return {
      endCursor: data.node.ratings.pageInfo.endCursor,
      hasNextPage: data.node.ratings.pageInfo.hasNextPage,
      numRatings: data.node.numRatings,
      ratings: data.node.ratings.edges.map((edge) => edge.node),
    };
  });
}
