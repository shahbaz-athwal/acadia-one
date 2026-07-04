// oxlint-disable sort-keys
import { z } from "zod";

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

export const PostSearchCriteriaFilteredResponseSchema = z
  .object({
    CourseFullModels: z.array(
      z.object({
        MatchingSectionIds: z.array(z.string()),
        Id: z.string(),
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
    paging: {
      currentPageIndex: data.CurrentPageIndex,
      totalItems: data.TotalItems,
      totalPages: data.TotalPages,
      pageSize: data.PageSize,
    },
  }));

export type PostSearchCriteriaResponse = z.infer<
  typeof PostSearchCriteriaFilteredResponseSchema
>;

export type AcadiaCourse = PostSearchCriteriaResponse["courses"][number];
