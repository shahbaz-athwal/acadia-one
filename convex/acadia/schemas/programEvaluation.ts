import { z } from "zod";
import { buildCanonicalCourseCode } from "../../../shared/courseCode";

const ProgramEvaluationCourseSchema = z.object({
  Id: z.string(),
  SubjectCode: z.string(),
  Number: z.string(),
  Title: z.string(),
  CourseName: z.string(),
});

const ProgramEvaluationGroupSchema = z.object({
  Id: z.string(),
  DisplayText: z.string(),
  Directive: z.string(),
  Courses: z.array(ProgramEvaluationCourseSchema),
});

const ProgramEvaluationSubrequirementSchema = z.object({
  Id: z.string(),
  Code: z.string(),
  DisplayText: z.string(),
  Directive: z.string(),
  Groups: z.array(ProgramEvaluationGroupSchema),
});

const ProgramEvaluationRequirementSchema = z.object({
  Id: z.string(),
  Code: z.string(),
  Description: z.string(),
  Directive: z.string(),
  Subrequirements: z.array(ProgramEvaluationSubrequirementSchema),
});

const ProgramEvaluationProgramSchema = z.object({
  Code: z.string(),
  AcademicLevelCode: z.string(),
  Title: z.string(),
  Requirements: z.array(ProgramEvaluationRequirementSchema),
});

export const ProgramEvaluationFilteredResponseSchema = z
  .object({
    StudentId: z.string(),
    Program: ProgramEvaluationProgramSchema,
  })
  .transform((data) => ({
    studentId: data.StudentId,
    program: {
      code: data.Program.Code,
      academicLevelCode: data.Program.AcademicLevelCode,
      title: data.Program.Title,
      requirements: data.Program.Requirements.map((req) => ({
        id: req.Id,
        code: req.Code,
        description: req.Description,
        directive: req.Directive,
        subrequirements: req.Subrequirements.map((sub) => ({
          id: sub.Id,
          code: sub.Code,
          displayText: sub.DisplayText,
          directive: sub.Directive,
          groups: sub.Groups.map((group) => ({
            id: group.Id,
            displayText: group.DisplayText,
            directive: group.Directive,
            courses: group.Courses.map((course) => ({
              id: course.Id,
              code: buildCanonicalCourseCode(course.SubjectCode, course.Number),
              number: course.Number,
              title: course.Title,
              courseName: course.CourseName,
            })),
          })),
        })),
      })),
    },
  }));

export type ProgramEvaluationTransformed = z.infer<
  typeof ProgramEvaluationFilteredResponseSchema
>;
