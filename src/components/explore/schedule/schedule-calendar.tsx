import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ScheduleItem,
  useScheduleItems,
} from "@/hooks/use-schedule-items";
import { useSchedulePreview } from "@/hooks/use-schedule-preview";
import {
  GRID_START_MINUTES,
  getBlockPosition,
  getTimeSlots,
  HEADER_HEIGHT,
  SLOT_COUNT,
  SLOT_HEIGHT,
  TIME_GUTTER_WIDTH,
  WEEKDAYS,
} from "@/lib/schedule-time";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import { ScheduleBlock } from "./schedule-block";

const DAY_MIN_WIDTH = 85;
const MIN_SLOT_HEIGHT = 14;
const MAX_SLOT_HEIGHT = SLOT_HEIGHT;
const HEADER_ROW_CHROME = 1;

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
  const { items, termCode, sessionId } = useScheduleItems();
  const { previewSection } = useSchedulePreview();
  const timeSlots = useMemo(() => getTimeSlots(), []);
  const gridLineSlots = useMemo(() => timeSlots.slice(0, -1), [timeSlots]);
  const itemsByDay = useMemo(() => groupByDay(items ?? []), [items]);
  const isPreviewingCurrentTerm =
    previewSection !== null && previewSection.section.termCode === termCode;
  const removeScheduleItem = useMutation(
    api.schedule.removeScheduleItem
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.schedule.get, {
      sessionId: args.sessionId,
    });
    if (current === undefined) {
      return;
    }
    localStore.setQuery(
      api.schedule.get,
      { sessionId: args.sessionId },
      current.filter((item) => item.scheduleItemId !== args.scheduleItemId)
    );
  });
  const handleRemoveSection = useCallback(
    (scheduleItemId: ScheduleItem["scheduleItemId"]) => {
      removeScheduleItem({
        sessionId,
        scheduleItemId,
      });
    },
    [removeScheduleItem, sessionId]
  );

  const calendarRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [availableBodyHeight, setAvailableBodyHeight] = useState<number | null>(
    null
  );
  const measuredBodyHeight = useMemo(
    () => availableBodyHeight ?? SLOT_COUNT * SLOT_HEIGHT,
    [availableBodyHeight]
  );
  const { slotHeight, gridHeight } = useMemo(() => {
    const rawSlotHeight = measuredBodyHeight / SLOT_COUNT;
    const clampedSlotHeight = Math.min(
      MAX_SLOT_HEIGHT,
      Math.max(MIN_SLOT_HEIGHT, rawSlotHeight)
    );
    // Prevent tiny overflow from borders/subpixel rounding by never exceeding
    // the measured body height.
    const nextGridHeight = Math.min(
      measuredBodyHeight,
      clampedSlotHeight * SLOT_COUNT
    );
    return {
      slotHeight: nextGridHeight / SLOT_COUNT,
      gridHeight: nextGridHeight,
    };
  }, [measuredBodyHeight]);

  useEffect(() => {
    const root = calendarRef.current;
    if (!root) {
      return;
    }
    const measure = () => {
      const rootHeight = root.clientHeight;
      setAvailableBodyHeight(
        Math.max(0, rootHeight - HEADER_HEIGHT - HEADER_ROW_CHROME)
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!(isPreviewingCurrentTerm && previewSection)) {
      return;
    }

    const previewDays = [...previewSection.section.days].sort((a, b) => a - b);
    const targetDay = previewDays[0];
    if (targetDay === undefined) {
      return;
    }

    const root = calendarRef.current;
    if (!root) {
      return;
    }
    const viewport = root.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) {
      return;
    }

    const dayColumn = root.querySelector<HTMLElement>(
      `[data-schedule-day="${targetDay}"]`
    );
    if (!dayColumn) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const dayRect = dayColumn.getBoundingClientRect();
    const isHiddenLeft = dayRect.left < viewportRect.left;
    const isHiddenRight = dayRect.right > viewportRect.right;
    if (isHiddenLeft || isHiddenRight) {
      dayColumn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isPreviewingCurrentTerm, previewSection]);

  return (
    <div className="flex min-h-0 flex-1" ref={calendarRef}>
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
                top: ((slot.minutes - GRID_START_MINUTES) / 30) * slotHeight,
                height: slotHeight,
              }}
            >
              <span className="-translate-y-1/2">{slot.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day columns (inside ScrollArea with fading edges) ── */}
      <div className="min-h-0 min-w-0 flex-1">
        <ScrollArea hideVerticalScrollbar viewportClassName="overflow-y-hidden">
          <div className="flex">
            {WEEKDAYS.map(({ day, short }) => (
              <div
                className="flex flex-1 shrink-0 flex-col border-r last:border-r-0"
                data-schedule-day={day}
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
                <div
                  className="relative overflow-hidden"
                  style={{ height: gridHeight }}
                >
                  {/* Grid lines */}
                  {gridLineSlots.map((slot) => (
                    <div
                      className={cn(
                        "absolute right-0 left-0 border-b",
                        slot.isHour ? "border-border/60" : "border-border/25"
                      )}
                      key={slot.minutes}
                      style={{
                        top:
                          ((slot.minutes - GRID_START_MINUTES) / 30) *
                            slotHeight +
                          slotHeight,
                      }}
                    />
                  ))}

                  {/* Schedule blocks */}
                  {(itemsByDay.get(day) ?? []).map((item) => (
                    <ScheduleBlock
                      dimmed={isPreviewingCurrentTerm}
                      item={item}
                      key={item.scheduleItemId}
                      onRemove={handleRemoveSection}
                      slotHeight={slotHeight}
                    />
                  ))}

                  {/* Preview ghost block */}
                  {isPreviewingCurrentTerm &&
                    previewSection.section.days.includes(day) && (
                      <PreviewBlock
                        preview={previewSection}
                        slotHeight={slotHeight}
                      />
                    )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function PreviewBlock({
  preview,
  slotHeight,
}: {
  preview: NonNullable<ReturnType<typeof useSchedulePreview>["previewSection"]>;
  slotHeight: number;
}) {
  const { top, height } = getBlockPosition(
    preview.section.classStartTime,
    preview.section.classEndTime,
    slotHeight
  );

  return (
    <div
      className="absolute inset-x-0.5 animate-pulse overflow-hidden rounded-md border border-dashed px-2 py-1.5 text-xs leading-tight"
      style={{
        top,
        height,
        backgroundColor: `${preview.color}15`,
        borderColor: `${preview.color}80`,
        color: preview.color,
      }}
    >
      <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
        <span
          className="truncate font-semibold leading-tight"
          style={{ color: preview.color }}
        >
          {preview.course.code}
        </span>
        <span className="truncate text-[11px] leading-tight opacity-80">
          {preview.section.sectionCode}
        </span>
      </div>
    </div>
  );
}
