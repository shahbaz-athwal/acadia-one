import { DaysFilter } from "@/components/explore/filters/days-filter";
import { DepartmentFilter } from "@/components/explore/filters/department-filter";
import { ProfessorFilter } from "@/components/explore/filters/professor-filter";
import { TermFilter } from "@/components/explore/filters/term-filter";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FilterPanel({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-6 overflow-y-auto p-4",
        className,
      )}
    >
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
