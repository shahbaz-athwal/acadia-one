import { CourseViewData } from "@/components/explore/courses/course-view-data";
import { CourseViewFooter } from "@/components/explore/courses/course-view-footer";
import { CourseViewHeader } from "@/components/explore/courses/course-view-header";
import { Card, CardPanel } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function CourseView({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full min-h-0 overflow-hidden py-0", className)}>
      <CardPanel className="flex h-full min-h-0 flex-col p-0">
        <CourseViewHeader />

        <ScrollArea className="min-h-0 flex-1" scrollFade>
          <CourseViewData />
        </ScrollArea>

        <CourseViewFooter />
      </CardPanel>
    </Card>
  );
}
