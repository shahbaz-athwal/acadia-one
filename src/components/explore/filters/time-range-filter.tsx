import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import {
  TIME_RANGE_MAX_MINUTES,
  TIME_RANGE_MINUTES,
  TIME_RANGE_STEP_MINUTES,
} from "@/lib/explore-filter-constants";
import { formatTime } from "../../../../shared/schedule-time";

function formatTimeWithHourPadding(minutes: number): string {
  const formatted = formatTime(minutes);
  return formatted.includes(":") ? formatted : formatted.replace(" ", ":00 ");
}

export function TimeRangeFilter() {
  const { filters, setTimeRange } = useExploreFilters();
  const [range, setRange] = useState<[number, number]>([
    filters.timeStart,
    filters.timeEnd,
  ]);

  useEffect(() => {
    setRange([filters.timeStart, filters.timeEnd]);
  }, [filters.timeStart, filters.timeEnd]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground text-xs">
        {formatTimeWithHourPadding(range[0])} -{" "}
        {formatTimeWithHourPadding(range[1])}
      </div>
      <Slider
        max={TIME_RANGE_MAX_MINUTES}
        min={TIME_RANGE_MINUTES}
        onValueChange={(next) => {
          if (!Array.isArray(next) || next.length !== 2) {
            return;
          }
          setRange([
            next[0] ?? TIME_RANGE_MINUTES,
            next[1] ?? TIME_RANGE_MAX_MINUTES,
          ]);
        }}
        onValueCommitted={(next) => {
          if (!Array.isArray(next) || next.length !== 2) {
            return;
          }
          setTimeRange([
            next[0] ?? TIME_RANGE_MINUTES,
            next[1] ?? TIME_RANGE_MAX_MINUTES,
          ]);
        }}
        step={TIME_RANGE_STEP_MINUTES}
        value={range}
      />
    </div>
  );
}
