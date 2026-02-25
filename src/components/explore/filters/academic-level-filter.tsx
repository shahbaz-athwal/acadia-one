import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import {
  GRAD_LEVEL_OPTIONS,
  STANDALONE_LEVEL_OPTIONS,
  UNDERGRAD_LEVEL_OPTIONS,
} from "@/lib/explore-filter-constants";

export function AcademicLevelFilter() {
  const { filters, setAcademicLevels } = useExploreFilters();
  const undergradValues = UNDERGRAD_LEVEL_OPTIONS.map((level) =>
    String(level.value)
  );
  const gradValues = GRAD_LEVEL_OPTIONS.map((level) => String(level.value));
  const selectedValues = filters.academicLevels.map(String);
  const selectedSet = new Set(selectedValues);

  const updateLevelsFromSet = (values: Set<string>) => {
    setAcademicLevels([...values].map(Number).sort((a, b) => a - b));
  };

  const toggleOne = (value: string, isChecked: boolean) => {
    const next = new Set(selectedSet);
    if (isChecked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    updateLevelsFromSet(next);
  };

  const toggleMany = (values: string[], isChecked: boolean) => {
    const next = new Set(selectedSet);
    for (const value of values) {
      if (isChecked) {
        next.add(value);
      } else {
        next.delete(value);
      }
    }
    updateLevelsFromSet(next);
  };

  const undergradSelectedCount = undergradValues.filter((value) =>
    selectedSet.has(value)
  ).length;
  const gradSelectedCount = gradValues.filter((value) =>
    selectedSet.has(value)
  ).length;
  const undergradChecked = undergradSelectedCount === undergradValues.length;
  const gradChecked = gradSelectedCount === gradValues.length;
  const undergradIndeterminate =
    undergradSelectedCount > 0 && !undergradChecked;
  const gradIndeterminate = gradSelectedCount > 0 && !gradChecked;

  return (
    <div className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <Checkbox
          checked={undergradChecked}
          indeterminate={undergradIndeterminate}
          onCheckedChange={(checked) =>
            toggleMany(undergradValues, checked === true)
          }
        />
        Undergraduate
      </Label>
      {UNDERGRAD_LEVEL_OPTIONS.map((level) => (
        <Label className="ms-4 flex items-center gap-2" key={level.value}>
          <Checkbox
            checked={selectedSet.has(String(level.value))}
            name={`lvl-${level.value}`}
            onCheckedChange={(checked) =>
              toggleOne(String(level.value), checked === true)
            }
          />
          {level.label}
        </Label>
      ))}

      <Label className="flex items-center gap-2">
        <Checkbox
          checked={gradChecked}
          indeterminate={gradIndeterminate}
          onCheckedChange={(checked) => toggleMany(gradValues, checked === true)}
        />
        Graduate
      </Label>
      {GRAD_LEVEL_OPTIONS.map((level) => (
        <Label className="ms-4 flex items-center gap-2" key={level.value}>
          <Checkbox
            checked={selectedSet.has(String(level.value))}
            name={`lvl-${level.value}`}
            onCheckedChange={(checked) =>
              toggleOne(String(level.value), checked === true)
            }
          />
          {level.label}
        </Label>
      ))}

      {STANDALONE_LEVEL_OPTIONS.map((level) => (
        <Label className="flex items-center gap-2" key={level.value}>
          <Checkbox
            checked={selectedSet.has(String(level.value))}
            name={`lvl-${level.value}`}
            onCheckedChange={(checked) =>
              toggleOne(String(level.value), checked === true)
            }
          />
          {level.label}
        </Label>
      ))}
    </div>
  );
}
