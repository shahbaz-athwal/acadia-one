import { useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ScheduleItem,
  useScheduleItems,
} from "@/hooks/use-schedule-items";
import {
  GRID_START_MINUTES,
  getTimeSlots,
  HEADER_HEIGHT,
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
  const gutterRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);

  // Sync the time gutter's vertical scroll with the ScrollArea viewport.
  const syncGutter = useCallback(() => {
    const wrapper = scrollWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const gutter = gutterRef.current;
    if (!gutter) {
      return;
    }
    const viewport = wrapper.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (viewport) {
      gutter.scrollTop = viewport.scrollTop;
    }
  }, []);

  useEffect(() => {
    const wrapper = scrollWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const viewport = wrapper.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) {
      return;
    }
    viewport.addEventListener("scroll", syncGutter);
    return () => viewport.removeEventListener("scroll", syncGutter);
  }, [syncGutter]);

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Time gutter (outside scroll container) ── */}
      <div
        className="shrink-0 overflow-hidden border-r bg-card"
        ref={gutterRef}
        style={{ width: TIME_GUTTER_WIDTH }}
      >
        {/* Spacer matching the day-header row height */}
        <div className="border-b" style={{ height: HEADER_HEIGHT }} />

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
                top: ((slot.minutes - GRID_START_MINUTES) / 30) * SLOT_HEIGHT,
                height: SLOT_HEIGHT,
              }}
            >
              <span className="-translate-y-1/2">{slot.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day columns (inside ScrollArea with fading edges) ── */}
      <div className="min-w-0 flex-1" ref={scrollWrapperRef}>
        <ScrollArea scrollFade>
          <div className="flex">
            {WEEKDAYS.map(({ day, short }) => (
              <div
                className="flex flex-1 shrink-0 flex-col border-r last:border-r-0"
                key={day}
                style={{ minWidth: DAY_MIN_WIDTH }}
              >
                {/* Day header (sticky top) */}
                <div
                  className="sticky top-0 z-10 flex items-center justify-center border-b bg-card font-medium text-muted-foreground text-xs"
                  style={{ height: HEADER_HEIGHT }}
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
                          ((slot.minutes - GRID_START_MINUTES) / 30) *
                            SLOT_HEIGHT +
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
        </ScrollArea>
      </div>
    </div>
  );
}
