"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { academicLevelOptions } from "@/features/explore/constants";
import { useExploreQueryState } from "@/features/explore/query-state";

function AcademicLevelMultiSelect() {
  const { state, setFilters } = useExploreQueryState();
  const value = state.filters.academicLevels;

  return (
    <ToggleGroup
      className="flex w-full flex-wrap gap-2"
      multiple
      onValueChange={(next) => {
        const parsed = next
          .map((entry) => Number.parseInt(entry, 10))
          .filter((entry) => Number.isFinite(entry));
        setFilters((prev) => ({ ...prev, academicLevels: parsed }));
      }}
      size="sm"
      value={value.map((entry) => entry.toString())}
      variant="outline"
    >
      {academicLevelOptions.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value.toString()}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { AcademicLevelMultiSelect };
