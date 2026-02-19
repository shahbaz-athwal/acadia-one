import { CalendarDaysIcon, CalendarIcon, ListIcon } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import type { TabItem } from "@/components/kokonutui/smooth-tab";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import {
  type ScheduleViewMode,
  useScheduleView,
} from "@/hooks/use-schedule-view";

export function ScheduleHeader() {
  const { view, termCode, terms, setView, setTermCode } = useScheduleView();

  const termTabs: TabItem[] = terms
    .filter((t) => !t.code.endsWith("COI"))
    .map((term) => ({
      id: term.code,
      title: term.name,
    }));

  return (
    <div className="flex flex-col gap-1 pb-2">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <CardTitle className="flex items-center gap-1.5 font-semibold text-base">
          <CalendarIcon className="size-4" />
          Schedule
        </CardTitle>
        <ToggleGroup
          onValueChange={(value: string[]) => {
            if (value.length > 0) {
              setView(value[0] as ScheduleViewMode);
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
      {termTabs.length > 0 && (
        <div className="px-3">
          <SmoothTab
            activeColor="bg-primary"
            compact
            items={termTabs}
            onChange={setTermCode}
            value={termCode}
          />
        </div>
      )}
    </div>
  );
}
