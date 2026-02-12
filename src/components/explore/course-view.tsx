import { CourseViewData } from "@/components/explore/course-view-data";
import { CourseViewFooter } from "@/components/explore/course-view-footer";
import { CourseViewHeader } from "@/components/explore/course-view-header";
import { Frame, FramePanel } from "@/components/ui/frame";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function CourseView({ className }: { className?: string }) {
  return (
    <Frame className={cn("h-full min-h-0 overflow-hidden py-0", className)}>
      <FramePanel className="flex h-full min-h-0 flex-col p-0">
        <CourseViewHeader />
        <ScrollArea className="min-h-0 flex-1">
          <CourseViewData />
        </ScrollArea>
        <CourseViewFooter />
      </FramePanel>
    </Frame>
  );
}
