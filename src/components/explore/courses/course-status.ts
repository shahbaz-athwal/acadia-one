import {
  CheckIcon,
  CircleAlertIcon,
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
  textClassName: string;
  variant: BadgeVariant;
}

export const COURSE_STATUS_META: Record<
  CoursePlanningStatus,
  CourseStatusMeta
> = {
  completed: {
    icon: CheckIcon,
    label: "Completed",
    textClassName: "text-success-foreground",
    variant: "success",
  },
  inProgress: {
    icon: Clock3Icon,
    label: "In progress",
    textClassName: "text-info-foreground",
    variant: "info",
  },
  dropped: {
    icon: CircleOffIcon,
    label: "Dropped",
    textClassName: "text-warning-foreground",
    variant: "warning",
  },
  withdrawn: {
    icon: CircleAlertIcon,
    label: "Withdrawn",
    textClassName: "text-warning-foreground",
    variant: "warning",
  },
  failed: {
    icon: XCircleIcon,
    label: "Failed",
    textClassName: "text-destructive-foreground",
    variant: "error",
  },
};

export const NOT_COMPLETED_STATUS_META: CourseStatusMeta = {
  icon: CircleOffIcon,
  label: "Not completed",
  textClassName: "text-muted-foreground",
  variant: "outline",
};

export function buildCourseStatusByCode(
  userData: Doc<"acadiaUserData"> | null | undefined
): Map<string, CoursePlanningStatus> {
  return new Map(Object.entries(userData?.coursePlanningStatuses ?? {}));
}
