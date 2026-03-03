import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import {
  GRAD_LEVEL_OPTIONS,
  STANDALONE_LEVEL_OPTIONS,
  UNDERGRAD_LEVEL_OPTIONS,
} from "@/lib/explore-filter-constants";

const ACADEMIC_LEVEL_OPTIONS = [
  ...UNDERGRAD_LEVEL_OPTIONS,
  ...GRAD_LEVEL_OPTIONS,
  ...STANDALONE_LEVEL_OPTIONS,
].map((level) => ({
  value: String(level.value),
  label: `${level.value}000`,
}));

export function AcademicLevelFilter() {
  const { filters, setAcademicLevels } = useExploreFilters();
  const selectedValues = filters.academicLevels.map(String);

  return (
    <ToggleGroup
      aria-label="Academic levels"
      className="w-full flex-wrap gap-2"
      multiple
      onValueChange={(nextValues) =>
        setAcademicLevels(nextValues.map(Number).sort((a, b) => a - b))
      }
      size="sm"
      value={selectedValues}
      variant="default"
    >
      {ACADEMIC_LEVEL_OPTIONS.map((level) => (
        <ToggleGroupItem
          aria-label={`${level.label} level`}
          className="border border-input bg-background px-2 text-[10px] font-normal shadow-xs/5 data-[pressed]:bg-input/64 data-[pressed]:text-accent-foreground"
          key={level.value}
          value={level.value}
        >
          {level.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
