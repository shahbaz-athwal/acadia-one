import { XIcon } from "lucide-react";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { Button } from "@/components/ui/button";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function FilterPanel() {
  const { clearFilters, filters } = useExploreFilters();
  const hasFilters = Object.values(filters).some((f) => f.length > 0);
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-base">Filters</h2>
        {hasFilters && (
          <Button onClick={clearFilters} size="icon-xs" variant="outline">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
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
