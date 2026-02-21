import { useMutation } from "convex/react";
import { CheckIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { useRef } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getOrCreateSessionId } from "@/hooks/use-auth";
import { useExploreCourses } from "@/hooks/use-explore-courses";
import { useScheduleItems } from "@/hooks/use-schedule-items";
import { useSchedulePreview } from "@/hooks/use-schedule-preview";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import { SCHEDULE_COLORS } from "../../../../convex/lib/constants";

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

export function CourseViewData() {
  const { courses } = useExploreCourses();
  const { allItems } = useScheduleItems();
  const { setPreviewSection } = useSchedulePreview();
  const sessionId = getOrCreateSessionId();

  const pendingRef = useRef<PendingSection | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          color: args.color,
          ...pendingRef.current,
        },
      ]);
    }
  );

  const addedSectionIds = new Set(allItems.map((item) => item.section.id));

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
    <div className="space-y-2 p-4">
      {courses.map((course) => (
        <div
          className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
          key={course.id}
        >
          <div className="font-medium">
            {course.code} — {course.title}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {course.credits} cr · {course.sections.length} section
            {course.sections.length !== 1 && "s"}
          </div>
          <ul className="mt-1 space-y-1 pl-3 text-muted-foreground">
            {course.sections.map((s) => {
              const isAdded = addedSectionIds.has(s.id);
              return (
                <li className="flex items-center gap-1.5" key={s.id}>
                  <span className="min-w-0 flex-1 truncate">
                    {s.sectionCode} · {s.professorName} · days [
                    {s.days.join(",")}]
                  </span>
                  <button
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors",
                      isAdded
                        ? "cursor-default text-muted-foreground/50"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                    disabled={isAdded}
                    onClick={() => {
                      if (isAdded) {
                        return;
                      }
                      const color =
                        SCHEDULE_COLORS[
                          allItems.length % SCHEDULE_COLORS.length
                        ] ?? "#94a3b8";
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
                          professorName: s.professorName,
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
                        setPreviewSection({
                          color:
                            SCHEDULE_COLORS[
                              allItems.length % SCHEDULE_COLORS.length
                            ] ?? "#94a3b8",
                          section: {
                            classStartTime: s.classStartTime,
                            classEndTime: s.classEndTime,
                            days: s.days,
                            sectionCode: s.sectionCode,
                            isOnline: s.isOnline,
                            buildingName: s.buildingName,
                            roomNumber: s.roomNumber,
                            professorName: s.professorName,
                          },
                          course: { code: course.code, title: course.title },
                        });
                      }, 250);
                    }}
                    onMouseLeave={() => {
                      if (previewTimerRef.current !== null) {
                        clearTimeout(previewTimerRef.current);
                        previewTimerRef.current = null;
                      }
                      setPreviewSection(null);
                    }}
                    type="button"
                  >
                    {isAdded ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <PlusIcon className="size-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
