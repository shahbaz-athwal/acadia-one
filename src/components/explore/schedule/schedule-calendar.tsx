import { useMemo } from "react";
import {
  type ScheduleItem,
  useScheduleItems,
} from "@/hooks/use-schedule-items";
import {
  getTimeSlots,
  SLOT_COUNT,
  SLOT_HEIGHT,
  TIME_GUTTER_WIDTH,
  WEEKDAYS,
} from "@/lib/schedule-time";
import { cn } from "@/lib/utils";
import { ScheduleBlock } from "./schedule-block";

const DAY_MIN_WIDTH = 120;

/** Group schedule items by day number for efficient lookup. */
function groupByDay(items: ScheduleItem[]): Map<number, ScheduleItem[]> {
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
  return map;
}

export function ScheduleCalendar() {
  const { items } = useScheduleItems();
  const timeSlots = useMemo(() => getTimeSlots(), []);
  const itemsByDay = useMemo(() => groupByDay(items ?? []), [items]);

  const gridHeight = SLOT_COUNT * SLOT_HEIGHT;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-auto">
      {/* ── Time gutter (sticky left) ── */}
      <div
        className="sticky left-0 z-20 shrink-0 border-r bg-card"
        style={{ width: TIME_GUTTER_WIDTH }}
      >
        {/* Corner cell: aligns with the sticky day header row */}
        <div
          className="sticky top-0 z-30 border-b bg-card"
          style={{ height: SLOT_HEIGHT }}
        />

        {/* Time labels */}
        <div className="relative" style={{ height: gridHeight }}>
          {timeSlots.map((slot) => (
            <div
              className={cn(
                "absolute right-0 left-0 flex items-start justify-end pr-2 text-[10px] text-muted-foreground",
                !slot.isHour && "opacity-0"
              )}
              key={slot.minutes}
              style={{
                top: ((slot.minutes - 8 * 60) / 30) * SLOT_HEIGHT,
                height: SLOT_HEIGHT,
              }}
            >
              <span className="-translate-y-1/2">{slot.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day columns ── */}
      <div className="flex min-w-0 flex-1">
        {WEEKDAYS.map(({ day, short }) => (
          <div
            className="flex flex-1 shrink-0 flex-col border-r last:border-r-0"
            key={day}
            style={{ minWidth: DAY_MIN_WIDTH }}
          >
            {/* Day header (sticky top) */}
            <div
              className="sticky top-0 z-10 flex items-center justify-center border-b bg-card font-medium text-muted-foreground text-xs"
              style={{ height: SLOT_HEIGHT }}
            >
              {short}
            </div>

            {/* Day body: time grid + positioned blocks */}
            <div className="relative" style={{ height: gridHeight }}>
              {/* Grid lines */}
              {timeSlots.map((slot) => (
                <div
                  className={cn(
                    "absolute right-0 left-0 border-b",
                    slot.isHour ? "border-border/60" : "border-border/25"
                  )}
                  key={slot.minutes}
                  style={{
                    top:
                      ((slot.minutes - 8 * 60) / 30) * SLOT_HEIGHT +
                      SLOT_HEIGHT,
                  }}
                />
              ))}

              {/* Schedule blocks */}
              {(itemsByDay.get(day) ?? []).map((item) => (
                <ScheduleBlock item={item} key={item.scheduleItemId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
