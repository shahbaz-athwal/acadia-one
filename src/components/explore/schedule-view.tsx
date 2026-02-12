import { Card } from "@/components/ui/card";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { cn } from "@/lib/utils";
import { ScheduleAgenda } from "./schedule/schedule-agenda";
import { ScheduleCalendar } from "./schedule/schedule-calendar";
import { ScheduleHeader } from "./schedule/schedule-header";

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
