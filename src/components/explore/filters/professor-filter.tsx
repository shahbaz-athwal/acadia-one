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

export function ProfessorFilter() {
  const { filters, setProfessorExternalIds, options } = useExploreFilters();

  const items: FilterOption[] = (options.professors ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const selected = items.filter((i) =>
    filters.professorExternalIds.includes(i.value)
  );

  return (
    <Combobox<FilterOption, true>
      isItemEqualToValue={(a, b) => a.value === b.value}
      items={items}
      multiple
      onValueChange={(s) => setProfessorExternalIds(s.map((x) => x.value))}
      value={selected}
    >
      <ComboboxChips>
        <ComboboxValue>
          {(values: FilterOption[]) => (
            <>
              {values.map((prof) => (
                <ComboboxChip key={prof.value}>{prof.label}</ComboboxChip>
              ))}
              <ComboboxInput
                placeholder={values.length > 0 ? "" : "Search professors..."}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>No professors found</ComboboxEmpty>
        <ComboboxList>
          {(prof: FilterOption) => (
            <ComboboxItem key={prof.value} value={prof}>
              {prof.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
