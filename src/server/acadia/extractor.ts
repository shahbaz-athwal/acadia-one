import type { CourseId, SectionId } from "@/db/schema";

import { PostSearchCriteriaEndpoint } from "./endpoints/post-search-criteria/endpoint";
import type { PostSearchCriteriaRequest } from "./endpoints/post-search-criteria/schema";
import { SectionDetailsEndpoint } from "./endpoints/section-details/endpoint";
import { AcadiaClient } from "./fetch-client";

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
  private readonly client: AcadiaClient;

  constructor(cookies: string) {
    this.client = new AcadiaClient(cookies);
  }

  postSearchCriteria(searchCriteria?: Partial<PostSearchCriteriaRequest>) {
    const criteria = {
      ...DEFAULT_SEARCH_CRITERIA,
      ...searchCriteria,
    };

    return this.client.execute(PostSearchCriteriaEndpoint, criteria);
  }

  getAllCourses() {
    return this.postSearchCriteria({ quantityPerPage: 3000 }).map(
      (data) => data.courses
    );
  }

  getProfessorsByDepartment(departmentPrefix: string) {
    return this.postSearchCriteria({
      quantityPerPage: 1,
      subjects: [departmentPrefix],
    }).map((data) => data.professors);
  }

  getSectionDetails(courseId: CourseId, sectionIds: SectionId[]) {
    return this.client.execute(SectionDetailsEndpoint, {
      courseId,
      sectionIds,
    });
  }
}
