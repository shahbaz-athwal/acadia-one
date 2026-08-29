import { z } from "zod";

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
