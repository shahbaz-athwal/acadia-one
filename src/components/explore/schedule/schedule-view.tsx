import { ScheduleAgenda } from "@/components/explore/schedule/schedule-agenda";
import { ScheduleCalendar } from "@/components/explore/schedule/schedule-calendar";
import { ScheduleHeader } from "@/components/explore/schedule/schedule-header";
import { useScheduleView } from "@/hooks/use-schedule-view";

export function ScheduleView() {
  const { view } = useScheduleView();

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      <ScheduleHeader />
      {view === "calendar" && <ScheduleCalendar />}
      {view === "agenda" && <ScheduleAgenda />}
    </div>
  );
}
