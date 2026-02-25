import { Slider } from "@/components/ui/slider";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import {
  TIME_RANGE_MAX_MINUTES,
  TIME_RANGE_MINUTES,
  TIME_RANGE_STEP_MINUTES,
} from "@/lib/explore-filter-constants";
import { formatTime } from "@/lib/schedule-time";

export function TimeRangeFilter() {
  const { filters, setTimeRange } = useExploreFilters();

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground text-xs">
        {formatTime(filters.timeStart)} - {formatTime(filters.timeEnd)}
      </div>
      <Slider
        max={TIME_RANGE_MAX_MINUTES}
        min={TIME_RANGE_MINUTES}
        onValueChange={(next) => {
          if (!Array.isArray(next) || next.length !== 2) {
            return;
          }
          setTimeRange([
            next[0] ?? TIME_RANGE_MINUTES,
            next[1] ?? TIME_RANGE_MAX_MINUTES,
          ]);
        }}
        step={TIME_RANGE_STEP_MINUTES}
        value={[filters.timeStart, filters.timeEnd]}
      />
    </div>
  );
}
