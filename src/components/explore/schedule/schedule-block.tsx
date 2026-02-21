import type { ScheduleItem } from "@/hooks/use-schedule-items";
import { getBlockPosition } from "@/lib/schedule-time";
import { cn } from "@/lib/utils";

interface ScheduleBlockProps {
  item: ScheduleItem;
  className?: string;
}

export function ScheduleBlock({ item, className }: ScheduleBlockProps) {
  const { top, height } = getBlockPosition(
    item.section.classStartTime,
    item.section.classEndTime
  );

  const isCompact = height <= 40;

  return (
    <div
      className={cn(
        "absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-xs leading-tight",
        className
      )}
      data-section-id={item.section.id}
      style={{
        top,
        height,
        backgroundColor: `${item.color}20`,
        borderColor: `${item.color}60`,
        color: item.color,
      }}
    >
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className="truncate font-semibold" style={{ color: item.color }}>
          {item.course.code}
        </span>
        {!isCompact && (
          <>
            <span className="truncate text-[10px] opacity-80">
              {item.section.classStartTime} – {item.section.classEndTime}
            </span>
            <span className="truncate text-[10px] opacity-70">
              {item.section.isOnline
                ? "Online"
                : `${item.section.buildingName} ${item.section.roomNumber}`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
