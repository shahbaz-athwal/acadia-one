import { GraphQLClient, gql } from "graphql-request";
import { z } from "zod";

const RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";

const gqlClient = new GraphQLClient(RMP_GRAPHQL_URL, {
  headers: {
    Authorization: "Basic dGVzdDp0ZXN0",
  },
});

const TEACHER_SEARCH_QUERY = gql`
  query TeacherSearchPaginationQuery($count: Int!, $cursor: String, $query: TeacherSearchQuery!) {
    search: newSearch {
      teachers(query: $query, first: $count, after: $cursor) {
        edges {
          node {
            id
            legacyId
            firstName
            lastName
            department
          }
        }
      }
    }
  }
`;

const TEACHER_RATINGS_PAGE_QUERY = gql`
  query TeacherRatingsPageQuery($id: ID!, $cursor: String) {
    node(id: $id) {
      __typename
      ... on Teacher {
        id
        legacyId
        ratings(first: 30, after: $cursor) {
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

const _TeacherNodeSchema = z.object({
  id: z.string(),
  legacyId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  department: z.string(),
});

const TeacherSearchResponseSchema = z.object({
  search: z.object({
    teachers: z.object({
      edges: z.array(
        z.object({
          node: _TeacherNodeSchema,
        }),
      ),
    }),
  }),
});

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
    id: raw.id || raw.legacyId.toString(),
    rmpLegacyId: raw.legacyId,
    quality: Math.round((raw.helpfulRating + raw.clarityRating) / 2),
    difficulty: raw.difficultyRating,
    isForCredit: raw.isForCredit,
    comment: raw.comment,
    textBookRequired: raw.textbookUse === null ? null : raw.textbookUse === 1,
    attendanceRequired: raw.attendanceMandatory === "mandatory",
    gradeReceived: raw.grade,
    wouldTakeAgain: raw.wouldTakeAgain === null ? null : raw.wouldTakeAgain === 1,
    thumbsUpTotal: raw.thumbsUpTotal,
    thumbsDownTotal: raw.thumbsDownTotal,
    tags: raw.ratingTags ? raw.ratingTags.split("--") : [],
    courseCode: raw.class,
    postedAt: new Date(raw.date),
  }));

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

const TeacherRatingsResponseSchema = z.object({
  node: z.object({
    __typename: z.literal("Teacher"),
    id: z.string(),
    legacyId: z.number(),
    ratings: z.object({
      edges: z.array(
        z.object({
          node: RatingNodeSchema,
        }),
      ),
      pageInfo: PageInfoSchema,
    }),
  }),
});

export type TeacherRating = z.infer<typeof RatingNodeSchema>;
export interface TeacherRatingsPage<TRating = TeacherRating> {
  paging: z.infer<typeof PageInfoSchema>;
  ratings: TRating[];
}

export type TeacherNode = z.infer<typeof _TeacherNodeSchema>;

export async function collectPaginatedRatings<TRating>(
  fetchPage: (cursor?: string) => Promise<TeacherRatingsPage<TRating>>,
) {
  const ratings: TRating[] = [];
  let cursor: string | undefined;

  while (true) {
    const page = await fetchPage(cursor);
    ratings.push(...page.ratings);

    if (!(page.paging.hasNextPage && page.paging.endCursor)) {
      return ratings;
    }

    cursor = page.paging.endCursor;
  }
}

export class RateMyProfScraper {
  private static instance: RateMyProfScraper | null = null;
  private readonly client: GraphQLClient;

  private constructor() {
    this.client = gqlClient;
  }

  static getInstance(): RateMyProfScraper {
    if (!RateMyProfScraper.instance) {
      RateMyProfScraper.instance = new RateMyProfScraper();
    }
    return RateMyProfScraper.instance;
  }

  private async executeQuery(query: string, variables: Record<string, unknown>) {
    const response = await this.client.request(query, variables);
    return response;
  }

  async searchTeachersBySchoolId(schoolId: string) {
    const variables = {
      count: 1000,
      query: {
        text: "",
        schoolID: schoolId,
        fallback: true,
      },
    };
    const response = await this.executeQuery(TEACHER_SEARCH_QUERY, variables);
    const parsed = TeacherSearchResponseSchema.parse(response);
    return parsed.search.teachers.edges.map((edge) => edge.node);
  }

  async getTeacherRatings({ teacherId, cursor }: { teacherId: string; cursor?: string }) {
    const variables = { id: teacherId, cursor };
    const response = await this.executeQuery(TEACHER_RATINGS_PAGE_QUERY, variables);
    const parsed = TeacherRatingsResponseSchema.parse(response);
    return {
      ratings: parsed.node.ratings.edges.map((edge) => edge.node),
      paging: parsed.node.ratings.pageInfo,
    };
  }

  getAllTeacherRatings({ teacherId }: { teacherId: string }) {
    return collectPaginatedRatings((cursor) => this.getTeacherRatings({ teacherId, cursor }));
  }
}

export const scraper = RateMyProfScraper.getInstance();
