import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function TermFilter() {
  const { filters, setTermCodes, options } = useExploreFilters();
  const terms = options.terms ?? [];

  return (
    <Combobox<string, true>
      multiple
      onValueChange={setTermCodes}
      value={filters.termCodes}
    >
      <ComboboxChips>
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((code) => (
                <ComboboxChip key={code}>
                  {terms.find((t) => t.code === code)?.name ?? code}
                </ComboboxChip>
              ))}
              <ComboboxInput
                placeholder={values.length > 0 ? "" : "Select terms..."}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxList>
          {terms.map((term) => (
            <ComboboxItem key={term.code} value={term.code}>
              {term.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
