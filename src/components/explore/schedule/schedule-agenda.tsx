import { CalendarDaysIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ScheduleItem,
  useScheduleItems,
} from "@/hooks/use-schedule-items";
import { WEEKDAYS } from "@/lib/schedule-time";

/** Group items by day, sorted within each day by start time. */
function groupByDaySorted(
  items: ScheduleItem[]
): Array<{ day: (typeof WEEKDAYS)[number]; items: ScheduleItem[] }> {
  const map = new Map<number, ScheduleItem[]>();

  for (const item of items) {
    for (const day of item.section.days) {
      const existing = map.get(day);
      if (existing) {
        existing.push(item);
      } else {
        map.set(day, [item]);
      }
    }
  }

  return WEEKDAYS.filter((wd) => map.has(wd.day)).map((wd) => ({
    day: wd,
    items: (map.get(wd.day) ?? []).sort((a, b) =>
      a.section.classStartTime.localeCompare(b.section.classStartTime)
    ),
  }));
}

export function ScheduleAgenda() {
  const { items } = useScheduleItems();
  const grouped = useMemo(() => groupByDaySorted(items ?? []), [items]);

  if (!items || items.length === 0) {
    return (
      <Empty className="h-2/3 flex-none gap-0">
        <EmptyMedia variant="icon">
          <CalendarDaysIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm">No sections in schedule</EmptyTitle>
          <EmptyDescription className="text-balance text-xs">
            Add sections from the course list to build your schedule.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-3">
        {grouped.map(({ day, items: dayItems }) => (
          <div key={day.day}>
            <h3 className="mb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {day.long}
            </h3>
            <div className="flex flex-col gap-1.5">
              {dayItems.map((item) => (
                <div
                  className="flex items-start gap-2 rounded-lg border px-3 py-2"
                  key={`${item.scheduleItemId}-${day.day}`}
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: item.color,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {item.course.code}
                    </div>
                    <div className="truncate text-muted-foreground text-xs">
                      {item.course.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {item.section.classStartTime} –{" "}
                        {item.section.classEndTime}
                      </span>
                      <span>{item.section.professorName}</span>
                      <span>
                        {item.section.isOnline
                          ? "Online"
                          : `${item.section.buildingName} ${item.section.roomNumber}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
