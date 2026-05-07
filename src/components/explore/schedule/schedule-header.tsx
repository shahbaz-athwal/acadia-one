import { CalendarIcon, ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import type { TabItem } from "@/components/kokonutui/smooth-tab";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
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
      <Tooltip>
        <TooltipTrigger
          render={
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
          }
        />
        <TooltipPopup>Redirect to Acadia&apos;s course catalog</TooltipPopup>
      </Tooltip>
    </div>
  );
}
