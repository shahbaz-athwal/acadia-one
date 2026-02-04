"use client";

import { Clock, X } from "lucide-react";
import { useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WheelPicker, WheelPickerWrapper } from "@/components/wheel-picker";
import {
  TIME_MINUTES_MAX,
  TIME_MINUTES_MIN,
  useExploreQueryState,
} from "@/features/explore/query-state";
import {
  buildTimeOptions,
  formatMinutes,
  normalizeTimeRange,
} from "@/features/explore/time";
import { cn } from "@/lib/utils";

function TimeRangeFilter() {
  const { state, setFilters } = useExploreQueryState();
  const value = state.filters.time;

  const timeOptions = useMemo(() => buildTimeOptions(), []);
  const timeValue = value ?? {
    start: TIME_MINUTES_MIN,
    end: TIME_MINUTES_MAX,
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "w-full justify-between"
        )}
        type="button"
      >
        <span
          className={cn(
            "truncate text-left",
            !value && "text-muted-foreground"
          )}
        >
          {value
            ? `${formatMinutes(value.start)} – ${formatMinutes(value.end)}`
            : "Any time"}
        </span>
        <Clock className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-muted-foreground text-xs">Start</div>
            <WheelPickerWrapper className="w-full">
              <WheelPicker<number>
                onValueChange={(nextStart) => {
                  const next = normalizeTimeRange(
                    { start: nextStart, end: timeValue.end },
                    "start"
                  );
                  setFilters((prev) => ({ ...prev, time: next }));
                }}
                options={timeOptions}
                value={timeValue.start}
              />
            </WheelPickerWrapper>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-muted-foreground text-xs">End</div>
            <WheelPickerWrapper className="w-full">
              <WheelPicker<number>
                onValueChange={(nextEnd) => {
                  const next = normalizeTimeRange(
                    { start: timeValue.start, end: nextEnd },
                    "end"
                  );
                  setFilters((prev) => ({ ...prev, time: next }));
                }}
                options={timeOptions}
                value={timeValue.end}
              />
            </WheelPickerWrapper>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <Button
            className="-my-1 text-xs"
            disabled={!value}
            onClick={() => {
              setFilters((prev) => ({ ...prev, time: null }));
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { TimeRangeFilter };
