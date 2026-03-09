import { getRouteApi } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { CourseViewData } from "@/components/explore/courses/course-view-data";
import { CourseViewFooter } from "@/components/explore/courses/course-view-footer";
import { CourseViewHeader } from "@/components/explore/courses/course-view-header";
import { ScrollArea } from "@/components/ui/scroll-area";

const routeApi = getRouteApi("/explore");

export function CourseView() {
  const { page } = routeApi.useSearch({
    select: (state) => ({
      page: state.page,
    }),
  });
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [page]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col">
        <CourseViewHeader />

        <ScrollArea
          className="min-h-0 flex-1"
          key={page}
          persistentScrollbar
          scrollbarGutter
          scrollFade
          viewportRef={viewportRef}
        >
          <CourseViewData />
        </ScrollArea>

        <CourseViewFooter />
      </div>
    </div>
  );
}
