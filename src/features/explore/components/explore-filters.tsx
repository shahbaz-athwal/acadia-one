"use client";

import { useQuery } from "convex/react";
import { Field, FieldItem, FieldLabel } from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AcademicLevelMultiSelect } from "@/features/explore/components/academic-level-multiselect";
import { MultiCombobox } from "@/features/explore/components/multi-combobox";
import { TermMultiSelect } from "@/features/explore/components/term-multiselect";
import { TimeRangeFilter } from "@/features/explore/components/time-range-filter";
import { useExploreQueryState } from "@/features/explore/query-state";
import { api } from "../../../../convex/_generated/api";

function ExploreFilters() {
  const { state, setFilters } = useExploreQueryState();
  const { filters } = state;
  const professors = useQuery(api.professors.list, {});
  const departments = useQuery(api.departments.list, {});
  const professorOptions =
    professors?.map((professor) => ({
      value: professor.id,
      label: professor.name,
    })) ?? [];
  const subjectOptions =
    departments?.map((department) => ({
      value: department.prefix,
      label: department.name,
    })) ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <Fieldset>
          <FieldsetLegend className="text-base">Filters</FieldsetLegend>
          <Separator />
          <Field>
            <FieldLabel>Term</FieldLabel>
            <FieldItem>
              <TermMultiSelect />
            </FieldItem>
          </Field>
          <Field>
            <FieldLabel>Professors</FieldLabel>
            <FieldItem>
              <MultiCombobox
                onChange={(next) => {
                  setFilters((prev) => ({ ...prev, professorIds: next }));
                }}
                options={professorOptions}
                placeholder="Select professors"
                searchPlaceholder="Search professors"
                value={filters.professorIds}
              />
            </FieldItem>
          </Field>
          <Field>
            <FieldLabel>Subjects</FieldLabel>
            <FieldItem>
              <MultiCombobox
                onChange={(next) => {
                  setFilters((prev) => ({ ...prev, subjectIds: next }));
                }}
                options={subjectOptions}
                placeholder="Select subjects"
                searchPlaceholder="Search subjects"
                value={filters.subjectIds}
              />
            </FieldItem>
          </Field>
          <Field>
            <FieldLabel>Academic level</FieldLabel>
            <FieldItem>
              <AcademicLevelMultiSelect />
            </FieldItem>
          </Field>
          <Field>
            <FieldLabel>Time Range</FieldLabel>
            <FieldItem>
              <TimeRangeFilter />
            </FieldItem>
          </Field>
        </Fieldset>
      </div>
    </ScrollArea>
  );
}

export { ExploreFilters };
