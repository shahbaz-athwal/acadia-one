import { XIcon } from "lucide-react";
import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { cn } from "@/lib/utils";

export function FilterPanel({ className }: { className?: string }) {
  const { clearFilters, filters } = useExploreFilters();
  const hasFilters = Object.values(filters).some((f) => f.length > 0);
  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-6 overflow-y-auto p-4",
        className
      )}
    >
      <CardHeader className="flex items-start justify-between gap-2 px-0">
        <CardTitle className="font-semibold text-base">Filters</CardTitle>
        {hasFilters && (
          <Button onClick={clearFilters} size="icon-xs" variant="outline">
            <XIcon className="size-4" />
          </Button>
        )}
      </CardHeader>
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
    </Card>
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
