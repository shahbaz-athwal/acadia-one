import { FilterPanelFooter } from "@/components/explore/filters/filter-panel-footer";
import { FiltersTab } from "@/components/explore/filters/filters-tab";
import { ProgressTab } from "@/components/explore/filters/progress-tab";
import type { TabItem } from "@/components/kokonutui/smooth-tab";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { SlidersHorizontalIcon } from "@/components/ui/sliders-horizontal";
import { TrendingUpIcon } from "@/components/ui/trending-up";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function FilterPanel() {
  const { filters, panelTab, setPanelTab } = useExploreFilters();

  const filterCount =
    filters.termCodes.length +
    filters.departmentPrefixes.length +
    filters.professorExternalIds.length +
    filters.days.length +
    filters.academicLevels.length;

  const panelTabs: TabItem[] = [
    {
      id: "filters",
      title: "Filters",
      icon: SlidersHorizontalIcon,
      badge: filterCount,
      content: <FiltersTab />,
    },
    {
      id: "progress",
      title: "Your Progress",
      icon: TrendingUpIcon,
      content: <ProgressTab />,
    },
  ];

  const handleTabChange = (value: string) => {
    if (value === "filters" || value === "progress") {
      setPanelTab(value);
    }
  };

  return (
    <div className="flex h-full flex-col p-2.5">
      <div className="min-h-0 flex-1 overflow-auto">
        <SmoothTab
          activeColor="bg-primary"
          items={panelTabs}
          onChange={handleTabChange}
          value={panelTab}
        />
      </div>
      <FilterPanelFooter />
    </div>
  );
}
