import { ScheduleAgenda } from "@/components/explore/schedule/schedule-agenda";
import { ScheduleCalendar } from "@/components/explore/schedule/schedule-calendar";
import { ScheduleHeader } from "@/components/explore/schedule/schedule-header";
import { Card } from "@/components/ui/card";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { cn } from "@/lib/utils";

export function ScheduleView({ className }: { className?: string }) {
  const { view } = useScheduleView();

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-0 overflow-hidden py-0",
        className
      )}
    >
      <ScheduleHeader />
      {view === "calendar" && <ScheduleCalendar />}
      {view === "agenda" && <ScheduleAgenda />}
    </Card>
  );
}
