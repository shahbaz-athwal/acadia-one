import { ScheduleCalendar } from "@/components/explore/schedule/schedule-calendar";
import { ScheduleHeader } from "@/components/explore/schedule/schedule-header";

export function ScheduleView() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-hidden">
      <ScheduleHeader />
      <ScheduleCalendar />
    </div>
  );
}
