import { CalendarIcon } from "lucide-react";
import { useMemo } from "react";
import type { TabItem } from "@/components/kokonutui/smooth-tab";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { CardTitle } from "@/components/ui/card";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { formatTermLabelWithoutYear } from "@/lib/utils";

export function ScheduleHeader() {
  const { termCode, terms, setTermCode } = useScheduleView();
  const termNameByCode = useMemo(
    () => new Map(terms.map((term) => [term.code, term.name])),
    [terms]
  );

  const termTabs: TabItem[] = terms
    .filter((t) => !t.code.endsWith("COI"))
    .map((term) => ({
      id: term.code,
      title: formatTermLabelWithoutYear(term.code, termNameByCode),
    }));

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <CardTitle className="flex shrink-0 items-center gap-1.5 font-semibold text-base">
        <CalendarIcon className="size-4" />
        Schedule
      </CardTitle>
      {termTabs.length > 0 && (
        <SmoothTab
          activeColor="bg-primary"
          className="mx-0 mt-0 ml-auto w-56"
          compact
          defaultTabId={termTabs[0].id}
          items={termTabs}
          onChange={setTermCode}
          value={termCode}
        />
      )}
    </div>
  );
}
