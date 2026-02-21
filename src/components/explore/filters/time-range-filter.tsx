import { Slider } from "@/components/ui/slider";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import {
  formatTime,
  GRID_END_MINUTES,
  GRID_START_MINUTES,
} from "@/lib/schedule-time";

const TIME_STEP_MINUTES = 30;

function resolveSliderRange(
  timeStart: number,
  timeEnd: number
): [number, number] {
  const start =
    timeStart > 0
      ? Math.min(Math.max(timeStart, GRID_START_MINUTES), GRID_END_MINUTES)
      : GRID_START_MINUTES;
  const end =
    timeEnd > 0
      ? Math.min(Math.max(timeEnd, GRID_START_MINUTES), GRID_END_MINUTES)
      : GRID_END_MINUTES;
  return start <= end ? [start, end] : [end, start];
}

export function TimeRangeFilter() {
  const { filters, setTimeRange } = useExploreFilters();
  const [start, end] = resolveSliderRange(filters.timeStart, filters.timeEnd);

  return (
    <div className="space-y-2">
      <Slider
        max={GRID_END_MINUTES}
        min={GRID_START_MINUTES}
        onValueChange={(next) => {
          const values = Array.isArray(next) ? next : [next];
          const [nextStart, nextEnd] = resolveSliderRange(
            values[0] ?? start,
            values[1] ?? end
          );
          const isFullRange =
            nextStart === GRID_START_MINUTES && nextEnd === GRID_END_MINUTES;
          setTimeRange(isFullRange ? 0 : nextStart, isFullRange ? 0 : nextEnd);
        }}
        step={TIME_STEP_MINUTES}
        value={[start, end]}
      />
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{formatTime(start)}</span>
        <span>{formatTime(end)}</span>
      </div>
    </div>
  );
}
