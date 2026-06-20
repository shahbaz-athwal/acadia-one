import { FilterPanelFooter } from "@/components/explore/filters/filter-panel-footer";
import { FiltersTab } from "@/components/explore/filters/filters-tab";
import { ProgressTab } from "@/components/explore/filters/progress-tab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { cn } from "@/lib/utils";
import { SEARCH_DEFAULTS } from "@/routes/explore";

export function FilterPanel() {
  const { filters, panelTab, setPanelTab } = useExploreFilters();

  const filterCount =
    filters.termCodes.length +
    filters.departmentPrefixes.length +
    filters.professorExternalIds.length +
    filters.days.length +
    filters.academicLevels.length +
    (filters.timeStart !== SEARCH_DEFAULTS.ts || filters.timeEnd !== SEARCH_DEFAULTS.te ? 1 : 0);

  const handleTabChange = (value: string | number | null) => {
    if (value === "filters" || value === "progress") {
      setPanelTab(value);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs className="min-h-0 flex-1" onValueChange={handleTabChange} value={panelTab}>
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2" variant="thin">
          <TabsTrigger value="filters">
            Filters
            {filterCount !== 0 && (
              <span
                className={cn(
                  "ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none",
                  panelTab === "filters"
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary/15 text-primary",
                )}
              >
                {filterCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <TabsContent className="min-h-0" value="filters">
          <ScrollArea hideVerticalScrollbar className="h-full" scrollFade>
            <FiltersTab />
          </ScrollArea>
        </TabsContent>
        <TabsContent className="min-h-0" value="progress">
          <ScrollArea hideVerticalScrollbar className="h-full" scrollFade>
            <ProgressTab />
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <FilterPanelFooter />
    </div>
  );
}
