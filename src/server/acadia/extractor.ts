import { createAcadiaPortalFetch } from "./fetch-client";
import { PostSearchCriteriaFilteredResponseSchema } from "./schemas/post-search-criteria";
import type { PostSearchCriteriaRequest } from "./schemas/post-search-criteria";

const DEFAULT_SEARCH_CRITERIA = {
  courseIds: null,
  faculty: [],
  keyword: null,
  pageNumber: 1,
  quantityPerPage: 50,
  sectionIds: null,
  subjects: [],
  terms: [],
} satisfies PostSearchCriteriaRequest;

export class AcadiaExtractor {
  private readonly portalFetch: ReturnType<typeof createAcadiaPortalFetch>;

  constructor(cookies: string) {
    this.portalFetch = createAcadiaPortalFetch(cookies);
  }

  async postSearchCriteria(
    searchCriteria?: Partial<PostSearchCriteriaRequest>
  ) {
    const criteria = {
      ...DEFAULT_SEARCH_CRITERIA,
      ...searchCriteria,
    };

    const response = await this.portalFetch<unknown>(
      "/student/Student/Courses/PostSearchCriteria",
      {
        body: criteria,
        method: "POST",
      }
    );

    return PostSearchCriteriaFilteredResponseSchema.parse(response);
  }

  async getAllCourses() {
    const data = await this.postSearchCriteria({ quantityPerPage: 3000 });
    return data.courses;
  }
}
