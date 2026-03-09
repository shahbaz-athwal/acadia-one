import { getRouteApi } from "@tanstack/react-router";
import { CourseViewData } from "@/components/explore/courses/course-view-data";
import { CourseViewFooter } from "@/components/explore/courses/course-view-footer";
import { CourseViewHeader } from "@/components/explore/courses/course-view-header";
import { ScrollArea } from "@/components/ui/scroll-area";

const routeApi = getRouteApi("/explore");

export function CourseView() {
  const courseListState = routeApi.useSearch({
    select: (state) => ({
      page: state.page,
      q: state.q,
      cc: state.cc,
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
      lvl: state.lvl,
      rsg: state.rsg,
      ts: state.ts,
      te: state.te,
    }),
  });
  const scrollResetKey = JSON.stringify(courseListState);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col">
        <CourseViewHeader />

        <ScrollArea
          className="min-h-0 flex-1"
          key={scrollResetKey}
          persistentScrollbar
          scrollbarGutter
          scrollFade
        >
          <CourseViewData />
        </ScrollArea>

        <CourseViewFooter />
      </div>
    </div>
  );
}
