import { AcademicLevelFilter } from "@/components/explore/filters/academic-level-filter";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { TimeRangeFilter } from "@/components/explore/filters/time-range-filter";

export function FiltersTab() {
  return (
    <div className="flex h-full flex-col gap-4 px-4">
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
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}
