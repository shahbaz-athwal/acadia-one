import { CourseViewData } from "@/components/explore/courses/course-view-data";
import { CourseViewFooter } from "@/components/explore/courses/course-view-footer";
import { CourseViewHeader } from "@/components/explore/courses/course-view-header";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CourseView() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col">
        <CourseViewHeader />

        <ScrollArea className="min-h-0 flex-1" hideVerticalScrollbar scrollFade>
          <CourseViewData />
        </ScrollArea>

        <CourseViewFooter />
      </div>
    </div>
  );
}
