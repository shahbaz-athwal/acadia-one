import { defineAcadiaEndpoint } from "../../endpoint";
import { PostSearchCriteriaResponseSchema } from "./schema";
import type { PostSearchCriteriaRequest } from "./schema";

export const PostSearchCriteriaEndpoint = defineAcadiaEndpoint({
  createBody: (criteria: PostSearchCriteriaRequest) => criteria,
  method: "POST",
  operation: "courses.search",
  path: "/student/Student/Courses/PostSearchCriteria",
  responseSchema: PostSearchCriteriaResponseSchema,
});
