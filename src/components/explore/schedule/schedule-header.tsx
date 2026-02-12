import { CalendarDaysIcon, ListIcon } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import {
  type ScheduleViewMode,
  useScheduleView,
} from "@/hooks/use-schedule-view";

export function ScheduleHeader() {
  const { view, termCode, terms, setView, setTermCode } = useScheduleView();

  return (
    <div className="flex flex-col pb-2">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <CardTitle className="font-semibold text-base">Schedule</CardTitle>
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
      {/* Term switcher */}
      {terms.length > 0 && (
        <div className="px-3">
          <ToggleGroup
            onValueChange={(value: string[]) => {
              if (value.length > 0) {
                setTermCode(value[0]);
              }
            }}
            size="sm"
            value={[termCode]}
            variant="outline"
          >
            {terms.map((term) => (
              <Toggle
                className="h-6! font-normal! text-xs!"
                key={term.code}
                value={term.code}
              >
                {term.name}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}
