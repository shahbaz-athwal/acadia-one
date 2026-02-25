import { XIcon } from "lucide-react";
import { AcademicLevelFilter } from "@/components/explore/filters/academic-level-filter";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { TimeRangeFilter } from "@/components/explore/filters/time-range-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { SEARCH_DEFAULTS } from "@/routes/explore";

export function FiltersTab() {
  const { filters, setFilters } = useExploreFilters();
  const hasFilters =
    filters.termCodes.length > 0 ||
    filters.departmentPrefixes.length > 0 ||
    filters.professorExternalIds.length > 0 ||
    filters.days.length > 0 ||
    filters.academicLevels.length > 0 ||
    filters.timeStart !== SEARCH_DEFAULTS.ts ||
    filters.timeEnd !== SEARCH_DEFAULTS.te;

  return (
    <div className="flex h-full flex-col p-2">
      <ScrollArea className="-mr-4 w-full" scrollFade>
        <div className="flex flex-col gap-6">
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

          <FilterSection label="Time">
            <TimeRangeFilter />
          </FilterSection>

          <FilterSection label="Academic Level">
            <AcademicLevelFilter />
          </FilterSection>
        </div>
      </ScrollArea>

      {hasFilters && (
        <div className="shrink-0 pt-3">
          <Button
            className="w-full"
            onClick={() =>
              setFilters({
                termCodes: [],
                departmentPrefixes: [],
                professorExternalIds: [],
                days: [],
                academicLevels: [],
                timeStart: SEARCH_DEFAULTS.ts,
                timeEnd: SEARCH_DEFAULTS.te,
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
