import { SlidersHorizontalIcon, TrendingUpIcon } from "lucide-react";
import { FilterPanelFooter } from "@/components/explore/filters/filter-panel-footer";
import { FiltersTab } from "@/components/explore/filters/filters-tab";
import { ProgressTab } from "@/components/explore/filters/progress-tab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { SEARCH_DEFAULTS } from "@/routes/explore";

export function FilterPanel() {
  const { filters, panelTab, setPanelTab } = useExploreFilters();

  const filterCount =
    filters.termCodes.length +
    filters.departmentPrefixes.length +
    filters.professorExternalIds.length +
    filters.days.length +
    filters.academicLevels.length +
    (filters.timeStart !== SEARCH_DEFAULTS.ts ||
    filters.timeEnd !== SEARCH_DEFAULTS.te
      ? 1
      : 0);

  const handleTabChange = (value: string) => {
    if (value === "filters" || value === "progress") {
      setPanelTab(value);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs
        className="flex min-h-0 flex-1 flex-col gap-2"
        onValueChange={handleTabChange}
        value={panelTab}
      >
        <TabsList className="mx-3 mt-2 grid w-[90%] grid-cols-2 self-center">
          <TabsTab value="filters">
            <SlidersHorizontalIcon className="size-4" />
            Filters
            {filterCount > 0 && (
              <span className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-[10px] text-primary leading-none">
                {filterCount}
              </span>
            )}
          </TabsTab>
          <TabsTab value="progress">
            <TrendingUpIcon className="size-4" />
            Your Progress
          </TabsTab>
        </TabsList>

        <TabsPanel className="min-h-0 flex-1" value="filters">
          <ScrollArea className="h-full" scrollFade>
            <FiltersTab />
          </ScrollArea>
        </TabsPanel>

        <TabsPanel className="min-h-0 flex-1" value="progress">
          <ScrollArea className="h-full" scrollFade>
            <ProgressTab />
          </ScrollArea>
        </TabsPanel>
      </Tabs>
      <FilterPanelFooter />
    </div>
  );
}
