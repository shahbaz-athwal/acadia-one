import type { CourseId, SectionId } from "@/db/schema";

import { defineAcadiaEndpoint } from "../../endpoint";
import { SectionDetailsResponseSchema } from "./schema";

interface SectionDetailsRequest {
  readonly courseId: CourseId;
  readonly sectionIds: SectionId[];
}

export const SectionDetailsEndpoint = defineAcadiaEndpoint({
  createBody: (request: SectionDetailsRequest) => request,
  method: "POST",
  operation: "sections.get",
  path: "/student/Student/Courses/Sections",
  responseSchema: SectionDetailsResponseSchema,
});
