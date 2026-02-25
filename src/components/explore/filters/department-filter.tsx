import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import { useExploreFilters } from "@/hooks/use-explore-filters";

interface FilterOption {
  value: string;
  label: string;
}

export function DepartmentFilter() {
  const { filters, setDepartmentPrefixes, options } = useExploreFilters();

  const items: FilterOption[] = (options.departments ?? []).map((d) => ({
    value: d.prefix,
    label: `${d.prefix} - ${d.name}`,
  }));

  const selected = items.filter((i) =>
    filters.departmentPrefixes.includes(i.value)
  );

  return (
    <Combobox<FilterOption, true>
      isItemEqualToValue={(a, b) => a.value === b.value}
      items={items}
      multiple
      onValueChange={(s) => setDepartmentPrefixes(s.map((x) => x.value))}
      value={selected}
    >
      <ComboboxChips>
        <ComboboxValue>
          {(values: FilterOption[]) => (
            <>
              {values.map((dept) => (
                <ComboboxChip key={dept.value}>{dept.label}</ComboboxChip>
              ))}
              <ComboboxInput
                className="text-sm sm:text-xs"
                placeholder={values.length > 0 ? "" : "Search departments..."}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>No departments found</ComboboxEmpty>
        <ComboboxList>
          {(dept: FilterOption) => (
            <ComboboxItem
              className="min-h-7 py-0.5 text-sm sm:min-h-6 sm:text-xs"
              key={dept.value}
              value={dept}
            >
              {dept.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
