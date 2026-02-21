import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Label } from "@/components/ui/label";
import { useExploreFilters } from "@/hooks/use-explore-filters";

const ACADEMIC_LEVELS = [
  { value: 0, label: "Pre-University" },
  { value: 1, label: "First Year" },
  { value: 2, label: "Second Year" },
  { value: 3, label: "Third Year" },
  { value: 4, label: "Fourth Year" },
  { value: 5, label: "Graduate 5000-level" },
  { value: 6, label: "Graduate 6000-level" },
  { value: 7, label: "Graduate 7000-level" },
  { value: 8, label: "Post-Baccalaureate 8000-level" },
  { value: 9, label: "Transfer Course 9000-level" },
] as const;

export function AcademicLevelFilter() {
  const { filters, setAcademicLevels } = useExploreFilters();

  return (
    <CheckboxGroup
      onValueChange={(next) => setAcademicLevels(next.map(Number))}
      value={filters.academicLevels.map(String)}
    >
      {ACADEMIC_LEVELS.map((level) => (
        <Label className="flex items-center gap-2" key={level.value}>
          <Checkbox
            name={`academic-level-${level.value}`}
            value={`${level.value}`}
          />
          {level.label}
        </Label>
      ))}
    </CheckboxGroup>
  );
}
