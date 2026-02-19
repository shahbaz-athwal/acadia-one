import { XIcon } from "lucide-react";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { Button } from "@/components/ui/button";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function FiltersTab() {
  const { filters, setFilters } = useExploreFilters();
  const hasFilters =
    filters.termCodes.length > 0 ||
    filters.departmentPrefixes.length > 0 ||
    filters.professorExternalIds.length > 0 ||
    filters.days.length > 0;

  return (
    <div className="flex min-h-full flex-col gap-6">
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

      {hasFilters && (
        <div className="mt-auto pt-2">
          <Button
            className="w-full"
            onClick={() =>
              setFilters({
                termCodes: [],
                departmentPrefixes: [],
                professorExternalIds: [],
                days: [],
              })
            }
            size="sm"
            variant="secondary"
          >
            <XIcon className="size-4" />
            Clear filters
          </Button>
        </div>
      )}
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
