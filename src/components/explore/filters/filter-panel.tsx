import { XIcon } from "lucide-react";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { ProgressTab } from "@/components/explore/filters/progress-tab";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function FilterPanel() {
  const { clearFilters, filters, panelTab, setPanelTab } = useExploreFilters();
  const hasFilters = Object.values(filters).some((f) => f.length > 0);

  const handleTabChange = (value: string) => {
    if (value === "filters" || value === "progress") {
      setPanelTab(value);
    }
  };

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col p-4"
      onValueChange={handleTabChange}
      value={panelTab}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTab value="filters">Filters</TabsTab>
        <TabsTab value="progress">Your progress</TabsTab>
      </TabsList>

      <TabsPanel
        className="min-h-0 flex-1 overflow-y-auto pt-4"
        value="filters"
      >
        <div className="flex min-h-full flex-col gap-6">
          {hasFilters && (
            <div className="flex items-start justify-end">
              <Button
                aria-label="Clear filters"
                onClick={clearFilters}
                size="icon-xs"
                variant="outline"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )}
          <FilterSection label="Term">
            <TermFilter />
          </FilterSection>

          <FilterSection label="Department">
            <DepartmentFilter />
          </FilterSection>

          <FilterSection label="Professor">
            <ProfessorFilter />
          </FilterSection>

          <FilterSection label="Days">
            <DaysFilter />
          </FilterSection>
        </div>
      </TabsPanel>

      <TabsPanel
        className="min-h-0 flex-1 overflow-y-auto pt-4"
        value="progress"
      >
        <ProgressTab />
      </TabsPanel>
    </Tabs>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-muted-foreground text-sm">{label}</span>
      {children}
    </div>
  );
}
