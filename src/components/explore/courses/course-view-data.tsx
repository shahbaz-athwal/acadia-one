import { useMutation } from "convex/react";
import { CheckIcon, PlusIcon, SearchXIcon } from "lucide-react";
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

export function CourseViewData() {
  const { courses } = useExploreCourses();
  const { allItems } = useScheduleItems();
  const { setPreviewSection } = useSchedulePreview();
  const addSection = useMutation(api.schedule.addSection);
  const sessionId = getOrCreateSessionId();

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
                      addSection({ sessionId, sectionId: s._id });
                    }}
                    onMouseEnter={() => {
                      if (isAdded) {
                        return;
                      }
                      setPreviewSection({
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
                    }}
                    onMouseLeave={() => setPreviewSection(null)}
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
