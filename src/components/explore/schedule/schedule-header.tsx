import { CalendarIcon } from "lucide-react";
import { useMemo } from "react";
import { CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { formatTermLabelWithoutYear } from "@/lib/utils";

export function ScheduleHeader() {
  const { termCode, terms, setTermCode } = useScheduleView();
  const termNameByCode = useMemo(
    () => new Map(terms.map((term) => [term.code, term.name])),
    [terms]
  );

  const termTabs = terms
    .filter((term) => !term.code.endsWith("COI"))
    .map((term) => ({
      code: term.code,
      label: formatTermLabelWithoutYear(term.code, termNameByCode),
    }));

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <CardTitle className="flex shrink-0 items-center gap-1.5 font-semibold text-base">
        <CalendarIcon className="size-4" />
        Schedule
      </CardTitle>
      {termTabs.length > 0 && (
        <Tabs
          className="ml-auto w-56 gap-0"
          onValueChange={setTermCode}
          value={termCode}
        >
          <TabsList
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${termTabs.length}, minmax(0, 1fr))`,
            }}
          >
            {termTabs.map((term) => (
              <TabsTab
                className="h-7 min-w-0 px-2 text-xs"
                key={term.code}
                value={term.code}
              >
                <span className="truncate">{term.label}</span>
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
