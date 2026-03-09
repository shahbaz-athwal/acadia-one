import {
  CheckIcon,
  CircleAlertIcon,
  CircleHelpIcon,
  CircleOffIcon,
  Clock3Icon,
  type LucideIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";
import type { Doc } from "../../../../convex/_generated/dataModel";

export type CoursePlanningStatus = NonNullable<
  Doc<"acadiaUserData">["coursePlanningStatuses"]
>[string];

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export interface CourseStatusMeta {
  icon: LucideIcon;
  label: string;
  variant: BadgeVariant;
}

export const COURSE_STATUS_META: Record<
  CoursePlanningStatus,
  CourseStatusMeta
> = {
  completed: {
    icon: CheckIcon,
    label: "Completed",
    variant: "success",
  },
  inProgress: {
    icon: Clock3Icon,
    label: "In progress",
    variant: "info",
  },
  dropped: {
    icon: CircleOffIcon,
    label: "Dropped",
    variant: "warning",
  },
  withdrawn: {
    icon: CircleAlertIcon,
    label: "Withdrawn",
    variant: "warning",
  },
  failed: {
    icon: XCircleIcon,
    label: "Failed",
    variant: "error",
  },
  unknown: {
    icon: CircleHelpIcon,
    label: "Unknown",
    variant: "outline",
  },
};

export const NOT_COMPLETED_STATUS_META: CourseStatusMeta = {
  icon: CircleOffIcon,
  label: "Not completed",
  variant: "outline",
};

export function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function buildCourseStatusByCode(
  userData: Doc<"acadiaUserData"> | null | undefined
): Map<string, CoursePlanningStatus> {
  const statusesByCode = new Map<string, CoursePlanningStatus>();
  const statusByCourseId = userData?.coursePlanningStatuses;
  const requirements = userData?.programEvaluation.requirements;

  if (!(statusByCourseId && requirements)) {
    return statusesByCode;
  }

  for (const requirement of requirements) {
    for (const subrequirement of requirement.subrequirements) {
      for (const group of subrequirement.groups) {
        for (const course of group.courses) {
          const status =
            statusByCourseId[course.id] ??
            statusByCourseId[normalizeCourseCode(course.code)];
          if (!status) {
            continue;
          }
          statusesByCode.set(normalizeCourseCode(course.code), status);
        }
      }
    }
  }

  return statusesByCode;
}
