import { z } from "zod";

export const PostSearchCriteriaRequestSchema = z.object({
  keyword: z.string().nullable(),
  terms: z.array(z.string()),
  courseIds: z.null(),
  sectionIds: z.null(),
  subjects: z.array(z.string()),
  faculty: z.array(z.coerce.number()),
  pageNumber: z.number(),
  quantityPerPage: z.number(),
  group: z.string().optional(),
  requirement: z.string().optional(),
  subrequirement: z.string().optional(),
});

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
    Subjects: z.array(
      z.object({
        Value: z.string(),
        Description: z.string(),
        Count: z.number(),
        Selected: z.boolean(),
      })
    ),
    Faculty: z.array(
      z.object({
        Value: z.string(),
        Description: z.string(),
      })
    ),
  })
  .transform((data) => ({
    courses: data.CourseFullModels.map((course) => ({
      matchingSectionIds: course.MatchingSectionIds,
      id: course.Id,
      code: course.SubjectCode + course.Number,
      subjectCode: course.SubjectCode,
      number: course.Number,
      credits: course.MinimumCredits,
      title: course.Title,
      description: course.Description,
      courseRequisites: course.CourseRequisites.map((req) => ({
        code: req.DisplayText.split(" ")[0]?.split("-").join("") || "",
        displayText: req.DisplayText,
        displayTextExtension: req.DisplayTextExtension,
      })),
    })),
    paging: {
      currentPageIndex: data.CurrentPageIndex,
      totalItems: data.TotalItems,
      totalPages: data.TotalPages,
      pageSize: data.PageSize,
    },
    subjects: data.Subjects.map((subject) => ({
      prefix: subject.Value,
      name: subject.Description,
    })),
    faculties: data.Faculty.map((faculty) => ({
      id: faculty.Value,
      name: faculty.Description,
    })),
  }));
