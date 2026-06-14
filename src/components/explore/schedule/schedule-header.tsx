import { CalendarIcon, ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useScheduleItems } from "@/hooks/use-schedule-items";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { formatTermLabelWithoutYear } from "@/lib/utils";

const ACADEMIC_SEARCH_URL = "https://collss.acadiau.ca/student/Student/Courses/Search";

function buildExportUrl(items: ReturnType<typeof useScheduleItems>["items"]) {
  if (!items || items.length === 0) {
    return null;
  }

  const keywordTokens = [
    ...new Set(
      items
        .map((item) => {
          const courseCode = item.course.code.trim();
          const sectionCode = item.section.sectionCode.trim();
          if (!(courseCode && sectionCode)) {
            return null;
          }
          return `${courseCode}-${sectionCode}`;
        })
        .filter((value) => value !== null)
        .sort((a, b) => a.localeCompare(b)),
    ),
  ];

  if (keywordTokens.length === 0) {
    return null;
  }

  const url = new URL(ACADEMIC_SEARCH_URL);
  url.searchParams.set("keyword", keywordTokens.join(" "));
  return url.toString();
}

export function ScheduleHeader() {
  const { termCode, terms, setTermCode } = useScheduleView();
  const { items } = useScheduleItems();
  const termNameByCode = useMemo(
    () => new Map(terms.map((term) => [term.code, term.name])),
    [terms],
  );
  const exportUrl = useMemo(() => buildExportUrl(items), [items]);

  const termTabs = terms
    .filter((t) => !t.code.endsWith("COI"))
    .map((term) => ({
      id: term.code,
      title: formatTermLabelWithoutYear(term.code, termNameByCode),
    }));

  const handleTermChange = (value: string) => {
    if (typeof value === "string") {
      setTermCode(value);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <CardTitle className="flex shrink-0 items-center gap-1.5 font-semibold text-base">
        <CalendarIcon className="size-4" />
        Schedule
      </CardTitle>
      {termTabs.length > 0 && (
        <Tabs className="ml-auto" onValueChange={handleTermChange} value={termCode}>
          <TabsList
            className="grid w-56"
            style={{ gridTemplateColumns: `repeat(${termTabs.length}, minmax(0, 1fr))` }}
          >
            {termTabs.map((tab) => (
              <TabsTrigger
                className="h-7 px-2 text-xs sm:h-7 sm:text-xs"
                key={tab.id}
                value={tab.id}
              >
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex">
              <Button
                disabled={!exportUrl}
                onClick={() => {
                  if (!exportUrl) {
                    return;
                  }
                  window.open(exportUrl, "_blank", "noopener,noreferrer");
                }}
                size="xs"
                variant="outline"
              >
                <ExternalLinkIcon />
                Export
              </Button>
            </span>
          }
        />
        <TooltipPopup side="left">
          {exportUrl
            ? "Redirect to Acadia's course catalog"
            : "Add courses to schedule before exporting"}
        </TooltipPopup>
      </Tooltip>
    </div>
  );
}
