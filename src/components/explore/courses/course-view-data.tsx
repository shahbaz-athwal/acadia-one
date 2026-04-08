import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
  CheckIcon,
  FlaskConicalIcon,
  GaugeIcon,
  PlusIcon,
  SearchXIcon,
  StarIcon,
} from "lucide-react";
import { type ReactElement, useMemo, useRef } from "react";
import { CourseRequisites } from "@/components/explore/courses/course-requisites";
import {
  buildCourseStatusByCode,
  COURSE_STATUS_META,
} from "@/components/explore/courses/course-status";
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
import { useAuth } from "@/hooks/use-auth";
import { useExploreCourses } from "@/hooks/use-explore-courses";
import { useExploreDetailSheet } from "@/hooks/use-explore-detail-sheet";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { useScheduleItems } from "@/hooks/use-schedule-items";
import { useSchedulePreview } from "@/hooks/use-schedule-preview";
import {
  cn,
  formatDays,
  formatTermLabel,
  getBuildingAbbreviation,
  getInitials,
  isCoinTerm,
  stripProfessorSalutations,
} from "@/lib/utils";
import { filterOptionsQuery, userDataQuery } from "@/queries/explore";
import { api } from "../../../../convex/_generated/api";
import { SCHEDULE_COLORS } from "../../../../convex/lib/constants";

const SHOW_SEAT_COLUMNS = false;

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
        className={cn(abbreviated === "-" && "no-underline")}
        disabled={abbreviated === "-"}
      >
        {abbreviated || "-"}
      </TooltipTrigger>
      <TooltipPopup>{props.buildingName || "-"}</TooltipPopup>
    </Tooltip>
  );
}

interface PendingSection {
  course: {
    code: string;
    title: string;
    credits: number;
  };
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
    professorExternalId: string | undefined;
    professorName: string;
  };
}

type Course = ReturnType<typeof useExploreCourses>["courses"][number];
type Section = Course["sections"][number];

interface SectionActionParams {
  color: string;
  course: Course;
  isAdded: boolean;
  professorDisplayName: string;
  section: Section;
}

function formatAverageScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

function ProfessorInfo(props: {
  imageUrl: string | undefined;
  displayName: string;
  avgQuality: number | null | undefined;
}) {
  return (
    <>
      <Avatar className="size-7">
        <AvatarImage alt={props.displayName} src={props.imageUrl} />
        <AvatarFallback>{getInitials(props.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate">{props.displayName}</div>
        {typeof props.avgQuality === "number" ? (
          <div className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
            <StarIcon className="size-3" fill="currentColor" />
            <span>{props.avgQuality.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ProfessorCell(props: {
  section: Section;
  professorDisplayName: string;
  openProfessor: (externalId: string) => void;
  prefetchProfessor: (externalId: string) => void;
}) {
  const { section, professorDisplayName, openProfessor, prefetchProfessor } =
    props;
  const { professorExternalId } = section;

  if (!professorExternalId) {
    return (
      <div className="flex items-center gap-2">
        <ProfessorInfo
          avgQuality={section.professorAvgQuality}
          displayName={professorDisplayName}
          imageUrl={section.professorImageUrl}
        />
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            className="flex cursor-pointer items-center gap-2 text-left transition-colors hover:text-foreground"
            onClick={() => openProfessor(professorExternalId)}
            onFocus={() => prefetchProfessor(professorExternalId)}
            onMouseEnter={() => prefetchProfessor(professorExternalId)}
            type="button"
          >
            <ProfessorInfo
              avgQuality={section.professorAvgQuality}
              displayName={professorDisplayName}
              imageUrl={section.professorImageUrl}
            />
          </button>
        }
      />
      <TooltipPopup>View Full Profile</TooltipPopup>
    </Tooltip>
  );
}

function SectionTimesCell(props: {
  section: Section;
  isContinuousIntake: boolean;
}) {
  if (props.isContinuousIntake) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-0.5">
      <div>
        {props.section.classStartTime} - {props.section.classEndTime}
      </div>
      <div className="text-muted-foreground">
        {formatDays(props.section.days)}
      </div>
    </div>
  );
}

function SectionRow(props: {
  section: Section;
  course: Course;
  addedSectionIds: Set<string>;
  termNameByCode: Map<string, string>;
  scheduleItemCount: number;
  openProfessor: (externalId: string) => void;
  prefetchProfessor: (externalId: string) => void;
  handleAddSection: (params: SectionActionParams) => void;
  handleSectionPreview: (params: SectionActionParams) => void;
  clearPreview: () => void;
  renderActionCell: (params: {
    isContinuousIntake: boolean;
    isAdded: boolean;
    actionButton: ReactElement;
  }) => ReactElement;
}) {
  const {
    section,
    course,
    addedSectionIds,
    termNameByCode,
    scheduleItemCount,
    openProfessor,
    prefetchProfessor,
    handleAddSection,
    handleSectionPreview,
    clearPreview,
    renderActionCell,
  } = props;
  const isAdded = addedSectionIds.has(section.id);
  const isContinuousIntake = isCoinTerm(section.termCode, termNameByCode);
  const professorDisplayName = stripProfessorSalutations(section.professorName);
  const color =
    SCHEDULE_COLORS[scheduleItemCount % SCHEDULE_COLORS.length] ?? "#94a3b8";
  const sectionAction = {
    section,
    course,
    professorDisplayName,
    color,
    isAdded,
  };
  const actionButton = (
    <Button
      className={cn(isAdded && "cursor-default")}
      disabled={isAdded}
      onClick={() => {
        handleAddSection(sectionAction);
      }}
      onMouseEnter={() => {
        handleSectionPreview(sectionAction);
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
    <TableRow key={section.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{section.sectionCode}</span>
          <Badge variant="info">
            {formatTermLabel(section.termCode, termNameByCode)}
          </Badge>
        </div>
      </TableCell>

      {SHOW_SEAT_COLUMNS ? (
        <TableCell className="font-medium">--</TableCell>
      ) : null}

      <TableCell>
        <SectionTimesCell
          isContinuousIntake={isContinuousIntake}
          section={section}
        />
      </TableCell>

      <TableCell className="whitespace-normal">
        <LocationDisplay
          buildingName={section.buildingName}
          isOnline={section.isOnline}
          roomNumber={section.roomNumber}
        />
      </TableCell>

      <TableCell>
        <ProfessorCell
          openProfessor={openProfessor}
          prefetchProfessor={prefetchProfessor}
          professorDisplayName={professorDisplayName}
          section={section}
        />
      </TableCell>

      <TableCell className="text-right">
        {renderActionCell({
          isContinuousIntake,
          isAdded,
          actionButton,
        })}
      </TableCell>
    </TableRow>
  );
}

export function CourseViewData() {
  const { isAuthenticated, sessionId, tokenHash } = useAuth();
  const { courses } = useExploreCourses();
  const { openCourse, openProfessor, prefetchCourse, prefetchProfessor } =
    useExploreDetailSheet();
  const { selectedCourseCode } = useExploreFilters();
  const {
    data: { terms },
  } = useSuspenseQuery(filterOptionsQuery());
  const { data: userData } = useSuspenseQuery(
    userDataQuery(sessionId, tokenHash)
  );
  const { allItems, termCode, setTermCode } = useScheduleItems();
  const { setPreviewSection } = useSchedulePreview();

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
  const courseStatusByCode = useMemo(
    () => buildCourseStatusByCode(userData),
    [userData]
  );
  const showRequisiteStatuses = isAuthenticated && !!userData;

  const buildPendingSection = (
    section: Section,
    course: Course,
    professorDisplayName: string
  ): PendingSection => ({
    section: {
      id: section.id,
      termCode: section.termCode,
      sectionCode: section.sectionCode,
      classStartTime: section.classStartTime,
      classEndTime: section.classEndTime,
      days: section.days,
      buildingName: section.buildingName,
      roomNumber: section.roomNumber,
      isOnline: section.isOnline,
      professorExternalId: section.professorExternalId,
      professorName: professorDisplayName,
    },
    course: {
      code: course.code,
      title: course.title,
      credits: course.credits,
    },
  });

  const handleAddSection = (params: SectionActionParams) => {
    const { section, course, professorDisplayName, color, isAdded } = params;
    clearPreview();
    if (isAdded) {
      return;
    }
    pendingRef.current = buildPendingSection(
      section,
      course,
      professorDisplayName
    );
    addSection({ sessionId, sectionId: section._id, color });
  };

  const handleSectionPreview = (params: SectionActionParams) => {
    const { section, course, professorDisplayName, color, isAdded } = params;
    if (isAdded) {
      return;
    }
    previewTimerRef.current = setTimeout(() => {
      if (section.termCode !== termCode) {
        setTermCode(section.termCode);
      }
      setPreviewSection({
        color,
        section: {
          termCode: section.termCode,
          classStartTime: section.classStartTime,
          classEndTime: section.classEndTime,
          days: section.days,
          sectionCode: section.sectionCode,
          isOnline: section.isOnline,
          buildingName: section.buildingName,
          roomNumber: section.roomNumber,
          professorName: professorDisplayName,
        },
        course: {
          code: course.code,
          title: course.title,
        },
      });
    }, 250);
  };

  const renderActionCell = (params: {
    isContinuousIntake: boolean;
    isAdded: boolean;
    actionButton: ReactElement;
  }) => {
    const { isContinuousIntake, isAdded, actionButton } = params;
    if (isContinuousIntake) {
      return <span className="text-muted-foreground">-</span>;
    }
    if (isAdded) {
      return actionButton;
    }
    return (
      <Tooltip>
        <TooltipTrigger render={actionButton} />
        <TooltipPopup>Add to schedule</TooltipPopup>
      </Tooltip>
    );
  };

  if (courses.length === 0) {
    return (
      <Empty className="h-2/3 flex-none gap-0">
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm">No courses found</EmptyTitle>
          <EmptyDescription className="text-xs">
            {selectedCourseCode
              ? "Try clearing the course filter or adjusting your other filters."
              : "Try adjusting your filters."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // pr-4 only if scrollbar is visible
    <TooltipProvider delay={100}>
      <div className="space-y-2 p-2">
        {courses.map((course) => {
          const courseStatus = courseStatusByCode.get(course.code);
          const courseStatusMeta = courseStatus
            ? COURSE_STATUS_META[courseStatus]
            : null;
          const CourseStatusIcon = courseStatusMeta?.icon;

          return (
            <Frame className="overflow-hidden rounded-xl p-0" key={course.id}>
              <div className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      className="truncate text-left transition-colors hover:text-foreground hover:underline"
                      onClick={() => openCourse(course.code)}
                      onFocus={() => prefetchCourse(course.code)}
                      onMouseEnter={() => prefetchCourse(course.code)}
                      type="button"
                    >
                      {course.code} {course.title}
                    </button>
                    {courseStatusMeta && CourseStatusIcon ? (
                      <Badge
                        className="shrink-0"
                        variant={courseStatusMeta.variant}
                      >
                        <CourseStatusIcon />
                        {courseStatusMeta.label}
                      </Badge>
                    ) : null}
                    {course.isLab ? (
                      <Badge className="shrink-0" variant="warning">
                        <FlaskConicalIcon />
                        Lab
                      </Badge>
                    ) : null}
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
                <CourseRequisites
                  courseStatusByCode={courseStatusByCode}
                  requisites={course.requisites}
                  showStatuses={showRequisiteStatuses}
                />
                {course.sections.length <= 0 && (
                  <div className="mt-2 text-muted-foreground">
                    {course.sections.length} section
                    {course.sections.length !== 1 && "s"}
                  </div>
                )}
              </div>
              {course.sections.length > 0 && (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      {SHOW_SEAT_COLUMNS ? <TableHead>Seats</TableHead> : null}
                      <TableHead>Times</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Instructors</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {course.sections.map((section) => (
                      <SectionRow
                        addedSectionIds={addedSectionIds}
                        clearPreview={clearPreview}
                        course={course}
                        handleAddSection={handleAddSection}
                        handleSectionPreview={handleSectionPreview}
                        key={section.id}
                        openProfessor={openProfessor}
                        prefetchProfessor={prefetchProfessor}
                        renderActionCell={renderActionCell}
                        scheduleItemCount={allItems.length}
                        section={section}
                        termNameByCode={termNameByCode}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Frame>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
