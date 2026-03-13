import { useMemo } from "react";
import {
  COURSE_STATUS_META,
  type CoursePlanningStatus,
  type CourseStatusMeta,
  NOT_COMPLETED_STATUS_META,
} from "@/components/explore/courses/course-status";
import { Badge } from "@/components/ui/badge";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";

const COURSE_TOKEN_REGEX = /\[\[course:([^|\]]+)\|([^\]]+)\]\]/g;

interface LinkedRequisiteCourse {
  code: string;
  title: string | null;
}

interface CourseRequisite {
  text: string;
  annotatedText: string;
  linkedCourses: LinkedRequisiteCourse[];
}

interface CourseRequisitesProps {
  requisites: CourseRequisite[];
  courseStatusByCode: Map<string, CoursePlanningStatus>;
  showStatuses: boolean;
  className?: string;
}

type AnnotatedSegment =
  | { type: "text"; value: string }
  | { type: "course"; code: string; label: string };

function parseAnnotatedText(annotatedText: string): AnnotatedSegment[] {
  const segments: AnnotatedSegment[] = [];
  let lastIndex = 0;

  for (const match of annotatedText.matchAll(COURSE_TOKEN_REGEX)) {
    const fullMatch = match[0];
    const code = match[1];
    const label = match[2];
    const start = match.index ?? -1;

    if (start > lastIndex) {
      segments.push({
        type: "text",
        value: annotatedText.slice(lastIndex, start),
      });
    }

    segments.push({
      type: "course",
      code,
      label,
    });

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < annotatedText.length) {
    segments.push({
      type: "text",
      value: annotatedText.slice(lastIndex),
    });
  }

  return segments.length > 0
    ? segments
    : [{ type: "text", value: annotatedText }];
}

function RequisiteCoursePreview(props: {
  course: LinkedRequisiteCourse;
  status: CoursePlanningStatus | null;
  showStatuses: boolean;
  triggerLabel: string;
}) {
  let statusMeta: CourseStatusMeta | null = null;
  if (props.showStatuses) {
    statusMeta = props.status
      ? COURSE_STATUS_META[props.status]
      : NOT_COMPLETED_STATUS_META;
  }
  const StatusIcon = statusMeta?.icon;

  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={250}
        render={
          <span
            className={cn(
              "inline rounded-sm underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
            )}
          >
            {props.triggerLabel}
          </span>
        }
      />
      <PreviewCardPopup className="w-80 flex-col gap-3 text-wrap p-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight">
              {props.course.code}
            </div>
            {props.course.title ? (
              <div className="mt-1 text-muted-foreground text-xs leading-snug">
                {props.course.title}
              </div>
            ) : null}
          </div>
          {statusMeta && StatusIcon ? (
            <Badge className="shrink-0" variant={statusMeta.variant}>
              <StatusIcon />
              {statusMeta.label}
            </Badge>
          ) : null}
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}

export function CourseRequisites({
  requisites,
  courseStatusByCode,
  showStatuses,
  className,
}: CourseRequisitesProps) {
  const lookupByRequisiteIndex = useMemo(
    () =>
      requisites.map(
        (requisite) =>
          new Map(
            requisite.linkedCourses.map((course) => [course.code, course])
          )
      ),
    [requisites]
  );

  if (requisites.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("mt-1 min-w-0 gap-1.5 text-muted-foreground", className)}
    >
      <div className="font-medium">Requisites:</div>
      <div className="min-w-0 space-y-1">
        {requisites.map((requisite, requisiteIndex) => {
          const lookup = lookupByRequisiteIndex[requisiteIndex];
          const segments = parseAnnotatedText(requisite.annotatedText);

          return (
            <div
              className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              key={requisite.annotatedText}
            >
              {segments.map((segment, segmentIndex) => {
                const key = `${requisiteIndex}-${segmentIndex}`;

                if (segment.type === "text") {
                  return <span key={key}>{segment.value}</span>;
                }

                const linkedCourse = lookup.get(segment.code) ?? {
                  code: segment.code,
                  title: null,
                };

                return (
                  <RequisiteCoursePreview
                    course={linkedCourse}
                    key={key}
                    showStatuses={showStatuses}
                    status={courseStatusByCode.get(segment.code) ?? null}
                    triggerLabel={segment.label}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
