import { z } from "zod";
import { parseCanonicalCourseCode } from "../../lib/courseCode";

export const CoursePlanningStatus = {
  completed: "completed",
  inProgress: "inProgress",
  dropped: "dropped",
  withdrawn: "withdrawn",
  failed: "failed",
} as const;

export type CoursePlanningStatus =
  (typeof CoursePlanningStatus)[keyof typeof CoursePlanningStatus];

export type CoursePlanningStatusByCode = Record<string, CoursePlanningStatus>;

const AcademicHistorySchema = z.object({
  GradeDisplay: z.string().nullable(),
  IsCompletedCredit: z.boolean(),
  IsWithdrawn: z.boolean(),
  IsDropped: z.boolean(),
});

const PlannedCourseSchema = z.object({
  CourseName: z.string(),
  IsCompleted: z.boolean(),
  IsInProgress: z.boolean(),
  IsWithdrawn: z.boolean(),
  IsDropped: z.boolean(),
  IsPlanned: z.boolean(),
  IsWaitlisted: z.boolean(),
  IsPreregistered: z.boolean(),
  AcademicHistory: AcademicHistorySchema.nullable(),
});

function resolveCoursePlanningStatus(
  course: z.infer<typeof PlannedCourseSchema>
) {
  const gradeDisplay =
    course.AcademicHistory?.GradeDisplay?.trim().toUpperCase();

  if (
    gradeDisplay === "W" ||
    course.IsWithdrawn ||
    course.AcademicHistory?.IsWithdrawn
  ) {
    return CoursePlanningStatus.withdrawn;
  }

  if (course.IsDropped || course.AcademicHistory?.IsDropped) {
    return CoursePlanningStatus.dropped;
  }

  if (course.IsInProgress) {
    return CoursePlanningStatus.inProgress;
  }

  if (gradeDisplay === "F" || gradeDisplay === "WF") {
    return CoursePlanningStatus.failed;
  }

  if (course.IsCompleted || course.AcademicHistory?.IsCompletedCredit) {
    return CoursePlanningStatus.completed;
  }

  return null;
}

export const DegreePlanPlanningStatusesFilteredResponseSchema = z
  .object({
    DegreePlan: z.object({
      Terms: z.array(
        z.object({
          Sequence: z.number(),
          PlannedCourses: z.array(PlannedCourseSchema),
        })
      ),
    }),
  })
  .transform((data): CoursePlanningStatusByCode => {
    const statusesByCourseCode: CoursePlanningStatusByCode = {};
    const sortedTerms = [...data.DegreePlan.Terms].sort(
      (a, b) => a.Sequence - b.Sequence
    );

    for (const term of sortedTerms) {
      for (const course of term.PlannedCourses) {
        const status = resolveCoursePlanningStatus(course);
        if (!status) {
          continue;
        }

        const courseCode = parseCanonicalCourseCode(course.CourseName);
        if (!courseCode) {
          continue;
        }

        statusesByCourseCode[courseCode] = status;
      }
    }

    return statusesByCourseCode;
  });

export type DegreePlanPlanningStatusesTransformed = z.infer<
  typeof DegreePlanPlanningStatusesFilteredResponseSchema
>;
