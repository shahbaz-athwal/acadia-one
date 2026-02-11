import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import {
  type ScheduleViewMode,
  useScheduleView,
} from "@/hooks/use-schedule-view";

export function ScheduleHeader() {
  const {
    view,
    termName,
    setView,
    goToNextTerm,
    goToPrevTerm,
    canGoNext,
    canGoPrev,
  } = useScheduleView();

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      {/* Term navigation */}
      <div className="flex items-center gap-1">
        <Button
          aria-label="Previous term"
          disabled={!canGoPrev}
          onClick={goToPrevTerm}
          size="icon-xs"
          variant="ghost"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-0 truncate font-medium text-sm">
          {termName || "No term"}
        </span>
        <Button
          aria-label="Next term"
          disabled={!canGoNext}
          onClick={goToNextTerm}
          size="icon-xs"
          variant="ghost"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {/* View toggle */}
      <ToggleGroup
        onValueChange={(value: ScheduleViewMode[]) => {
          if (value.length > 0) {
            setView(value[0]);
          }
        }}
        size="sm"
        value={[view]}
        variant="outline"
      >
        <Toggle aria-label="Calendar view" value="calendar">
          <CalendarDaysIcon />
        </Toggle>
        <Toggle aria-label="Agenda view" value="agenda">
          <ListIcon />
        </Toggle>
      </ToggleGroup>
    </div>
  );
}
