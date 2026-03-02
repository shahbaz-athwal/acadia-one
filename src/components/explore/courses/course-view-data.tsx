import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
  CheckIcon,
  GaugeIcon,
  PlusIcon,
  SearchXIcon,
  StarIcon,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getOrCreateSessionId } from "@/hooks/use-auth";
import { useExploreCourses } from "@/hooks/use-explore-courses";
import { useScheduleItems } from "@/hooks/use-schedule-items";
import { useSchedulePreview } from "@/hooks/use-schedule-preview";
import {
  cn,
  formatCourseCode,
  formatDays,
  formatTermLabelWithoutYear,
  getBuildingAbbreviation,
  getInitials,
  isCoinTerm,
  stripProfessorSalutations,
} from "@/lib/utils";
import { filterOptionsQuery } from "@/queries/explore";
import { api } from "../../../../convex/_generated/api";
import { SCHEDULE_COLORS } from "../../../../convex/lib/constants";

function LocationDisplay(props: {
  isOnline: boolean;
  buildingName: string;
  roomNumber: string;
}) {
  if (props.isOnline) {
    return <span>Online</span>;
  }

  const abbreviated = [
    getBuildingAbbreviation(props.buildingName),
    props.roomNumber.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "underline decoration-dotted underline-offset-2",
          abbreviated === "-" && "no-underline"
        )}
        disabled={abbreviated === "-"}
      >
        {abbreviated || "-"}
      </TooltipTrigger>
      <TooltipPopup>{props.buildingName || "-"}</TooltipPopup>
    </Tooltip>
  );
}

interface PendingSection {
  section: {
    id: string;
    termCode: string;
    sectionCode: string;
    classStartTime: string;
    classEndTime: string;
    days: number[];
    buildingName: string;
    roomNumber: string;
    isOnline: boolean;
    professorName: string;
  };
  course: {
    code: string;
    title: string;
    credits: number;
  };
}

function formatAverageScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

export function CourseViewData() {
  const { courses } = useExploreCourses();
  const {
    data: { terms },
  } = useSuspenseQuery(filterOptionsQuery());
  const { allItems, termCode, setTermCode } = useScheduleItems();
  const { setPreviewSection } = useSchedulePreview();
  const sessionId = getOrCreateSessionId();

  const pendingRef = useRef<PendingSection | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPreview = () => {
    if (previewTimerRef.current !== null) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewSection(null);
  };

  const addSection = useMutation(api.schedule.addSection).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.schedule.get, {
        sessionId: args.sessionId,
      });
      if (current === undefined || !pendingRef.current) {
        return;
      }

      localStore.setQuery(api.schedule.get, { sessionId: args.sessionId }, [
        ...current,
        {
          scheduleItemId: `__optimistic_${Date.now()}` as never,
          sectionDbId: args.sectionId,
          color: args.color,
          ...pendingRef.current,
        },
      ]);
    }
  );

  const addedSectionIds = new Set(allItems.map((item) => item.section.id));
  const termNameByCode = useMemo(
    () => new Map(terms.map((term) => [term.code, term.name])),
    [terms]
  );

  if (courses.length === 0) {
    return (
      <Empty className="h-2/3 flex-none gap-0">
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm">No courses found</EmptyTitle>
          <EmptyDescription className="text-xs">
            Try adjusting your filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // pr-4 only if scrollbar is visible
    <TooltipProvider delay={100}>
      <div className="space-y-2 p-2">
        {courses.map((course) => (
          <Frame className="overflow-hidden rounded-xl p-0" key={course.id}>
            <div className="px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2 font-medium">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {formatCourseCode(course.code)} {course.title}
                  </span>
                  <Badge
                    className="shrink-0"
                    variant={course.isLab ? "warning" : "success"}
                  >
                    {course.isLab ? "Lab" : `${course.credits} cr`}
                  </Badge>
                </div>
                {!course.isLab && (
                  <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        <StarIcon className="size-3.5" fill="currentColor" />
                        {formatAverageScore(course.avgQuality)}
                      </TooltipTrigger>
                      <TooltipPopup>Average quality</TooltipPopup>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        <GaugeIcon className="size-3.5" />
                        {formatAverageScore(course.avgDifficulty)}
                      </TooltipTrigger>
                      <TooltipPopup>Average difficulty</TooltipPopup>
                    </Tooltip>
                  </div>
                )}
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {course.sections.length} section
                {course.sections.length !== 1 && "s"}
              </div>
            </div>

            {course.sections.length > 0 && (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Times</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead>Instructors</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {course.sections.map((s) => {
                    const isAdded = addedSectionIds.has(s.id);
                    const professorDisplayName = stripProfessorSalutations(
                      s.professorName
                    );
                    const color =
                      SCHEDULE_COLORS[
                        allItems.length % SCHEDULE_COLORS.length
                      ] ?? "#94a3b8";
                    const actionButton = (
                      <Button
                        className={cn(isAdded && "cursor-default")}
                        disabled={isAdded}
                        onClick={() => {
                          clearPreview();
                          if (isAdded) {
                            return;
                          }
                          pendingRef.current = {
                            section: {
                              id: s.id,
                              termCode: s.termCode,
                              sectionCode: s.sectionCode,
                              classStartTime: s.classStartTime,
                              classEndTime: s.classEndTime,
                              days: s.days,
                              buildingName: s.buildingName,
                              roomNumber: s.roomNumber,
                              isOnline: s.isOnline,
                              professorName: professorDisplayName,
                            },
                            course: {
                              code: course.code,
                              title: course.title,
                              credits: course.credits,
                            },
                          };
                          addSection({ sessionId, sectionId: s._id, color });
                        }}
                        onMouseEnter={() => {
                          if (isAdded) {
                            return;
                          }
                          previewTimerRef.current = setTimeout(() => {
                            if (s.termCode !== termCode) {
                              setTermCode(s.termCode);
                            }
                            setPreviewSection({
                              color,
                              section: {
                                termCode: s.termCode,
                                classStartTime: s.classStartTime,
                                classEndTime: s.classEndTime,
                                days: s.days,
                                sectionCode: s.sectionCode,
                                isOnline: s.isOnline,
                                buildingName: s.buildingName,
                                roomNumber: s.roomNumber,
                                professorName: professorDisplayName,
                              },
                              course: {
                                code: course.code,
                                title: course.title,
                              },
                            });
                          }, 250);
                        }}
                        onMouseLeave={() => {
                          clearPreview();
                        }}
                        size={isAdded ? "xs" : "icon-xs"}
                        variant={isAdded ? "secondary" : "default"}
                      >
                        {isAdded ? (
                          <>
                            <CheckIcon className="size-3.5" />
                            Added
                          </>
                        ) : (
                          <PlusIcon className="size-4" />
                        )}
                      </Button>
                    );

                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.sectionCode}</span>
                            <Badge variant="info">
                              {formatTermLabelWithoutYear(
                                s.termCode,
                                termNameByCode
                              )}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">--</TableCell>

                        <TableCell>
                          {isCoinTerm(s.termCode, termNameByCode) ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div>
                                {s.classStartTime} - {s.classEndTime}
                              </div>
                              <div className="text-muted-foreground">
                                {formatDays(s.days)}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="whitespace-normal">
                          <LocationDisplay
                            buildingName={s.buildingName}
                            isOnline={s.isOnline}
                            roomNumber={s.roomNumber}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarImage
                                alt={professorDisplayName}
                                src={s.professorImageUrl}
                              />
                              <AvatarFallback>
                                {getInitials(professorDisplayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate">
                                {professorDisplayName}
                              </div>
                              {typeof s.professorAvgQuality === "number" && (
                                <div className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
                                  <StarIcon
                                    className="size-3"
                                    fill="currentColor"
                                  />
                                  <span>
                                    {s.professorAvgQuality.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          {isAdded ? (
                            actionButton
                          ) : (
                            <Tooltip>
                              <TooltipTrigger render={actionButton} />
                              <TooltipPopup>Add to schedule</TooltipPopup>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Frame>
        ))}
      </div>
    </TooltipProvider>
  );
}
