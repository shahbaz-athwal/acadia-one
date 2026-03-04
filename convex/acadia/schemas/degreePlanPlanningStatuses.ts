import { z } from "zod";

export const CoursePlanningStatus = {
  completed: "completed",
  inProgress: "inProgress",
  dropped: "dropped",
  withdrawn: "withdrawn",
  failed: "failed",
  unknown: "unknown",
} as const;

export type CoursePlanningStatus =
  (typeof CoursePlanningStatus)[keyof typeof CoursePlanningStatus];

export type CoursePlanningStatusById = Record<string, CoursePlanningStatus>;

const PlanningStatusSchema = z.object({
  CourseId: z.string(),
  Class: z.string(),
  Text: z.string(),
});

function toCoursePlanningStatus(
  className: string,
  text: string
): CoursePlanningStatus {
  const normalized = `${className} ${text}`.toLowerCase();

  if (
    normalized.includes("in-progress") ||
    normalized.includes("in progress")
  ) {
    return CoursePlanningStatus.inProgress;
  }

  if (normalized.includes("withdrawn") || normalized.includes("withdraw")) {
    return CoursePlanningStatus.withdrawn;
  }

  if (normalized.includes("dropped") || normalized.includes("drop")) {
    return CoursePlanningStatus.dropped;
  }

  if (normalized.includes("failed") || normalized.includes("fail")) {
    return CoursePlanningStatus.failed;
  }

  if (
    normalized.includes("completed") ||
    normalized.includes("attempted") ||
    normalized.includes("credit")
  ) {
    return CoursePlanningStatus.completed;
  }

  return CoursePlanningStatus.unknown;
}

export const DegreePlanPlanningStatusesFilteredResponseSchema = z
  .object({
    DegreePlan: z.object({
      PlanningStatuses: z.array(PlanningStatusSchema),
    }),
  })
  .transform((data): CoursePlanningStatusById => {
    const statusesByCourseId: CoursePlanningStatusById = {};

    for (const item of data.DegreePlan.PlanningStatuses) {
      statusesByCourseId[item.CourseId] = toCoursePlanningStatus(
        item.Class,
        item.Text
      );
    }

    return statusesByCourseId;
  });

export type DegreePlanPlanningStatusesTransformed = z.infer<
  typeof DegreePlanPlanningStatusesFilteredResponseSchema
>;
