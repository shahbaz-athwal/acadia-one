import { z } from "zod";

// oxlint-disable sort-keys typescript/no-unsafe-type-assertion
import type { CourseId, ProfessorId, SectionId } from "@/db/schema";

import type { AcadiaEndpoint } from "../../fetch-client";

const CourseIdSchema = z.string().transform((id) => id as CourseId);
const ProfessorIdSchema = z
  .string()
  .trim()
  .min(1)
  .transform((id) => id as ProfessorId);
const SectionIdSchema = z.string().transform((id) => id as SectionId);

function getAcademicLevel(courseNumber: string) {
  const parsed = Number.parseInt(courseNumber.trim().charAt(0), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface PostSearchCriteriaRequest {
  readonly keyword: string | null;
  readonly terms: string[];
  readonly courseIds: null;
  readonly sectionIds: null;
  readonly subjects: string[];
  readonly faculty: number[];
  readonly pageNumber: number;
  readonly quantityPerPage: number;
  readonly group?: string;
  readonly requirement?: string;
  readonly subrequirement?: string;
}

export const PostSearchCriteriaResponseSchema = z
  .object({
    CourseFullModels: z.array(
      z.object({
        MatchingSectionIds: z.array(SectionIdSchema),
        Id: CourseIdSchema,
        SubjectCode: z.string(),
        Number: z.string(),
        MinimumCredits: z.number(),
        Title: z.string(),
        Description: z.string(),
        CourseRequisites: z.array(
          z.object({
            DisplayText: z.string(),
            DisplayTextExtension: z.string(),
          })
        ),
      })
    ),
    TotalItems: z.number(),
    TotalPages: z.number(),
    PageSize: z.number(),
    CurrentPageIndex: z.number(),
    Faculty: z
      .array(
        z.object({
          Description: z.string().trim(),
          Value: ProfessorIdSchema,
        })
      )
      .default([]),
  })
  .transform((data) => ({
    courses: data.CourseFullModels.map((course) => ({
      matchingSectionIds: course.MatchingSectionIds,
      id: course.Id,
      code: `${course.SubjectCode}-${course.Number}`,
      departmentPrefix: course.SubjectCode,
      credits: course.MinimumCredits,
      isLab: course.Number.trim().toUpperCase().endsWith("L"),
      academicLevel: getAcademicLevel(course.Number),
      title: course.Title,
      description: course.Description,
      requisites: course.CourseRequisites.map((requisite) => ({
        codes: requisite.DisplayText.split(" "),
        textExtension: requisite.DisplayTextExtension,
      })),
    })),
    professors: data.Faculty.map((professor) => ({
      id: professor.Value,
      name: professor.Description,
    })),
    paging: {
      currentPageIndex: data.CurrentPageIndex,
      totalItems: data.TotalItems,
      totalPages: data.TotalPages,
      pageSize: data.PageSize,
    },
  }));

export type PostSearchCriteriaResponse = z.infer<
  typeof PostSearchCriteriaResponseSchema
>;

export type AcadiaCourse = PostSearchCriteriaResponse["courses"][number];
export type AcadiaProfessor = PostSearchCriteriaResponse["professors"][number];

export const PostSearchCriteriaEndpoint = {
  createBody: (criteria: PostSearchCriteriaRequest) => criteria,
  operation: "courses.search",
  path: "/student/Student/Courses/PostSearchCriteria",
  responseSchema: PostSearchCriteriaResponseSchema,
} satisfies AcadiaEndpoint<
  PostSearchCriteriaRequest,
  typeof PostSearchCriteriaResponseSchema
>;
