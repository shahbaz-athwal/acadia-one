import { z } from "zod";

const StudentGradeSchema = z.object({
  FormattedCourseNameDisplay: z.array(z.string()),
  CourseNameSort: z.string(),
  Title: z.string(),
  StartDate: z.string().nullable(),
  EndDate: z.string().nullable(),
  FinalGrade: z.string(),
  FinalGradeExpirationDate: z.string(),
  CreditsCeus: z.string(),
  DatesDisplay: z.string(),
  FinalGradeDisplay: z.array(z.string()),
});

const StudentTermGradeSchema = z.object({
  StudentGrades: z.array(StudentGradeSchema),
  TermName: z.string(),
  TermYear: z.number(),
  CompletedGpa: z.number().nullable(),
  StartDate: z.string(),
  EndDate: z.string(),
});

export const StudentGradesFilteredResponseSchema = z
  .object({
    StudentTermGrades: z.array(StudentTermGradeSchema),
  })
  .transform((data) => ({
    terms: data.StudentTermGrades.map((term) => ({
      termName: term.TermName,
      termYear: term.TermYear,
      startDate: term.StartDate,
      endDate: term.EndDate,
      gpa: term.CompletedGpa,
      courses: term.StudentGrades.map((grade) => ({
        courseCode: grade.CourseNameSort.split("-").slice(0, 2).join(""),
        title: grade.Title,
        credits: grade.CreditsCeus,
        startDate: grade.StartDate,
        endDate: grade.EndDate,
        finalGrade: grade.FinalGrade,
      })),
    })),
  }));

export type StudentGradesTransformed = z.infer<
  typeof StudentGradesFilteredResponseSchema
>;
