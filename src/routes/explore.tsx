import { createFileRoute } from "@tanstack/react-router";
import { CourseView } from "@/components/explore/course-view";
import { FilterPanel } from "@/components/explore/filter-panel";
import { ScheduleView } from "@/components/explore/schedule-view";

export const Route = createFileRoute("/explore")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="h-dvh overflow-hidden p-4">
      <section className="flex h-full min-h-0 gap-4 overflow-hidden">
        <FilterPanel className="w-[25%] min-w-0" />
        <CourseView className="w-[45%] min-w-0" />
        <ScheduleView className="w-[30%] min-w-0" />
      </section>
    </main>
  );
}
